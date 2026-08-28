-- Today's Five freshness (user decision, 2026-08-28).
--
-- curateForMood (client, explore-moods.ts) already rotates the daily pick
-- deterministically within a window of the top 8 ranked candidates. That
-- rotation is real, but the *pool* it rotates through was static: the same
-- top-8-by-score people forever, for anyone whose interests/intents don't
-- change day to day - which is most people. Below that window, nobody ever
-- surfaces in Today's Five no matter how many days pass.
--
-- Fix: remember who's been shown recently, and let that pull them down the
-- ranking - a soft penalty, not a hard exclusion, so a genuinely strong
-- match can still surface even if shown yesterday, and a small Tribe with
-- few candidates never runs dry.

-- ---------- 1. remember what's been shown ----------

create table if not exists public.explore_impressions (
  user_id uuid not null references auth.users(id) on delete cascade,
  shown_id uuid not null references auth.users(id) on delete cascade,
  shown_at timestamptz not null default now(),
  primary key (user_id, shown_id)
);

create index if not exists explore_impressions_recency_idx
  on public.explore_impressions(user_id, shown_at desc);

alter table public.explore_impressions enable row level security;

create policy "Users manage their own explore impressions"
  on public.explore_impressions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.explore_impressions from public, anon;
grant select, insert, update on public.explore_impressions to authenticated;

-- ---------- 2. let it pull the ranking, not gate it ----------

-- Same function as 20260820190650, with one addition: a left join to this
-- user's own impressions, and a tiered penalty subtracted from score before
-- the final least(score, 100). Everything else - the me/candidates shape,
-- the distance math, the venture lateral join, the ORDER BY/pagination
-- contract - is unchanged on purpose, so this is reviewable as a diff
-- against the last known-good version rather than a rewrite.
create or replace function public.list_explore_matches(_limit integer default 20, _offset integer default 0)
returns table (
  profile_id uuid, score integer, shared_interests text[], shared_intents text[],
  shared_availability text[], same_tribe boolean, distance_band text,
  open_venture_id uuid, open_venture_title text
)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id, p.tribe_ids, p.interests, p.social_intents, p.availability, l.latitude, l.longitude, l.radius_km
    from public.profiles p
    left join public.profile_locations l on l.user_id = p.id and l.discoverable
    where p.id = auth.uid()
  ),
  candidates as (
    select p.id, p.tribe_ids, p.interests, p.social_intents, p.availability, p.updated_at,
      l.latitude, l.longitude, l.radius_km, ei.shown_at
    from public.profiles p
    left join public.profile_locations l on l.user_id = p.id and l.discoverable
    left join public.explore_impressions ei on ei.user_id = auth.uid() and ei.shown_id = p.id
    where p.id <> auth.uid() and p.suspended_at is null and cardinality(p.tribe_ids) > 0
      and not public.has_blocked(auth.uid(), p.id)
  ),
  measured as (
    select c.id, c.updated_at, c.shown_at,
      (c.tribe_ids && m.tribe_ids) as same_tribe,
      array(select i from unnest(c.interests) i where i = any (m.interests)) as shared_interests,
      array(select i from unnest(c.social_intents) i where i = any (m.social_intents)) as shared_intents,
      array(select i from unnest(c.availability) i where i = any (m.availability)) as shared_availability,
      case when c.latitude is null or m.latitude is null then null
        else 6371.0 * 2.0 * asin(sqrt(
          power(sin(radians(c.latitude - m.latitude) / 2.0), 2) +
          cos(radians(m.latitude)) * cos(radians(c.latitude)) *
          power(sin(radians(c.longitude - m.longitude) / 2.0), 2)))
      end as distance_km,
      least(c.radius_km, m.radius_km) as mutual_radius_km,
      ov.id as open_venture_id, ov.title as open_venture_title
    from candidates c cross join me m
    left join lateral (
      select v.id, v.title from public.ventures v
      where v.user_id = c.id and v.status = 'open' and v.ended_at is null
        and v.filled_slots < v.max_slots and (v.scope = 'all' or c.tribe_ids && m.tribe_ids)
      order by v.created_at desc limit 1
    ) ov on true
  ),
  scored as (
    select id, updated_at, same_tribe, shared_interests, shared_intents, shared_availability,
      open_venture_id, open_venture_title,
      case
        when distance_km is null then null
        when mutual_radius_km is null then null
        when distance_km > mutual_radius_km then null
        when distance_km <= 2 then 'Within 2 km'
        when distance_km <= 5 then 'Within 5 km'
        when distance_km <= 15 then 'Within 15 km'
        else 'Within 50 km'
      end as distance_band,
      (
        (
          case when cardinality(shared_intents) > 0 then 30 else 0 end +
          least(30, 10 * cardinality(shared_interests)) +
          case when cardinality(shared_availability) > 0 then 15 else 0 end +
          case when open_venture_id is not null then 15 else 0 end +
          case when distance_km is not null and mutual_radius_km is not null and distance_km <= mutual_radius_km then 10 else 0 end
        )
        -
        case
          when shown_at is null then 0
          when shown_at >= now() - interval '3 days' then 40
          when shown_at >= now() - interval '14 days' then 15
          else 0
        end
      )::integer as score
    from measured
  )
  select id, greatest(least(score, 100), 0), shared_interests, shared_intents, shared_availability,
    same_tribe, distance_band, open_venture_id, open_venture_title
  from scored
  order by score desc, updated_at desc nulls last, id
  offset greatest(coalesce(_offset, 0), 0)
  limit least(greatest(coalesce(_limit, 20), 1), 50);
$$;

revoke all on function public.list_explore_matches(integer, integer) from public, anon;
grant execute on function public.list_explore_matches(integer, integer) to authenticated, service_role;

comment on table public.explore_impressions is
  'Last time each candidate was shown to a user in Today''s Five, so list_explore_matches can push recently-shown people down the ranking instead of showing the same top scorers forever.';
