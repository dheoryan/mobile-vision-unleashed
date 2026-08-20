-- EXPLORE RELEVANCE, DECOUPLED FROM LOCATION.
--
-- The problem this fixes:
--
-- list_nearby_profile_matches is the only scored discovery path in the app, and
-- it INNER JOINs profile_locations on both sides and requires `discoverable`.
-- So a person who has not opted into location sharing gets no scored results at
-- all — they silently fall through to listDiscoverProfiles, which is
-- `order by created_at desc`. Newest-first, with no relevance signal of any
-- kind. At launch, when almost nobody has granted geolocation, that is what
-- Explore actually is for nearly every user: a list of whoever signed up last.
--
-- Location is a *bonus signal*, not the substrate. Two people who both chose
-- 'activity_partner' and both listed 'outdoors' are a better introduction than
-- two strangers who happen to be 3 km apart. This function scores on what
-- people said about themselves, and adds proximity on top when both sides have
-- opted in.
--
-- Deliberately NOT scored: sharing a Tribe.
--
--   Under exclusive Tribe membership, Explore is the cross-Tribe bridge —
--   Global is look-but-don't-touch, and finding someone from another Tribe is
--   the whole reason to open this screen. Tribemates are already reachable
--   directly through the Tribe, so ranking them up would fill the deck with
--   people the user can already message and starve the one surface that
--   crosses Tribes. They stay in the pool (a large Tribe contains strangers)
--   but they get no boost, and `same_tribe` is returned so the UI can label
--   them honestly.
--
-- The open-Venture signal is the other addition. Someone with a live plan and
-- an empty seat is a better introduction than an identical profile with
-- nothing on. It also points Explore at Ventures, which is where the app
-- actually wants people to end up.

-- ---------- scoring surface ----------

create or replace function public.list_explore_matches(
  _limit integer default 20,
  _offset integer default 0
)
returns table (
  profile_id uuid,
  score integer,
  shared_interests text[],
  shared_intents text[],
  shared_availability text[],
  same_tribe boolean,
  distance_band text,
  open_venture_id uuid,
  open_venture_title text
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      p.id,
      p.tribe_ids,
      p.interests,
      p.social_intents,
      p.availability,
      l.latitude,
      l.longitude,
      l.radius_km
    from public.profiles p
    -- LEFT, and this is the whole point: no location means no proximity bonus,
    -- not an empty result set.
    left join public.profile_locations l
      on l.user_id = p.id and l.discoverable
    where p.id = auth.uid()
  ),
  candidates as (
    select
      p.id,
      p.tribe_ids,
      p.interests,
      p.social_intents,
      p.availability,
      p.updated_at,
      l.latitude,
      l.longitude,
      l.radius_km
    from public.profiles p
    left join public.profile_locations l
      on l.user_id = p.id and l.discoverable
    where p.id <> auth.uid()
      and p.suspended_at is null
      -- Someone with no Tribe has not finished onboarding; they have nothing
      -- to be discovered by yet.
      and cardinality(p.tribe_ids) > 0
      and not public.has_blocked(auth.uid(), p.id)
  ),
  measured as (
    select
      c.id,
      c.updated_at,
      (c.tribe_ids && m.tribe_ids) as same_tribe,
      array(select i from unnest(c.interests) i where i = any (m.interests))
        as shared_interests,
      array(select i from unnest(c.social_intents) i where i = any (m.social_intents))
        as shared_intents,
      array(select i from unnest(c.availability) i where i = any (m.availability))
        as shared_availability,
      -- Null distance when either side has no discoverable location. Nulls
      -- compare false in the band CASE below, so they simply score no
      -- proximity points rather than dropping out.
      case
        when c.latitude is null or m.latitude is null then null
        else 6371.0 * 2.0 * asin(sqrt(
          power(sin(radians(c.latitude - m.latitude) / 2.0), 2) +
          cos(radians(m.latitude)) * cos(radians(c.latitude)) *
          power(sin(radians(c.longitude - m.longitude) / 2.0), 2)
        ))
      end as distance_km,
      least(c.radius_km, m.radius_km) as mutual_radius_km,
      ov.id as open_venture_id,
      ov.title as open_venture_title
    from candidates c
    cross join me m
    -- Their most recent open Venture with a seat left, and only one this
    -- viewer is actually allowed to see. A 'mine' Venture is Tribe-scoped, so
    -- advertising it to someone who would be refused at the door is a dead
    -- end dressed up as an invitation.
    left join lateral (
      select v.id, v.title
      from public.ventures v
      where v.user_id = c.id
        and v.status = 'open'
        and v.ended_at is null
        and v.filled_slots < v.max_slots
        and (v.scope = 'all' or c.tribe_ids && m.tribe_ids)
      order by v.created_at desc
      limit 1
    ) ov on true
  ),
  scored as (
    select
      id,
      updated_at,
      same_tribe,
      shared_interests,
      shared_intents,
      shared_availability,
      open_venture_id,
      open_venture_title,
      -- Only ever disclose a band inside the MUTUAL radius. radius_km is a
      -- consent setting, not a display filter: someone who picked 5 km is
      -- saying "people further away should not be told where I am", and a
      -- 'Within 50 km' label on their card would leak exactly what they
      -- declined to share. Outside the mutual radius the band is null and the
      -- person is still listed on their profile signals alone.
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
        -- Wanting the same kind of company is the strongest single signal.
        case when cardinality(shared_intents) > 0 then 30 else 0 end +
        -- Each shared interest is worth something, but a long identical list
        -- is not three times the introduction that one is.
        least(30, 10 * cardinality(shared_interests)) +
        case when cardinality(shared_availability) > 0 then 15 else 0 end +
        case when open_venture_id is not null then 15 else 0 end +
        case
          when distance_km is not null
           and mutual_radius_km is not null
           and distance_km <= mutual_radius_km
          then 10
          else 0
        end
      )::integer as score
    from measured
  )
  select
    id,
    least(score, 100),
    shared_interests,
    shared_intents,
    shared_availability,
    same_tribe,
    distance_band,
    open_venture_id,
    open_venture_title
  from scored
  -- Recency as the tiebreak, and `updated_at` rather than `created_at` on
  -- purpose: among people who match equally well, show the ones who have
  -- touched their profile recently rather than the ones who signed up last.
  -- `id` last so pagination by offset is deterministic.
  order by score desc, updated_at desc nulls last, id
  offset greatest(coalesce(_offset, 0), 0)
  limit least(greatest(coalesce(_limit, 20), 1), 50);
$$;

revoke all on function public.list_explore_matches(integer, integer) from public, anon;
grant execute on function public.list_explore_matches(integer, integer)
  to authenticated, service_role;

comment on function public.list_explore_matches(integer, integer) is
  'Scored cross-Tribe discovery. Ranks on shared intents, interests, availability and open Ventures; proximity is an optional bonus for members who have opted into location. Returns the matched signals so the UI can explain the ranking.';

-- Supports the scan-then-sort in `candidates` once the table outgrows a seq
-- scan. Partial, because suspended profiles are never candidates.
create index if not exists profiles_active_updated_idx
  on public.profiles (updated_at desc)
  where suspended_at is null;

-- The lateral subquery looks up open Ventures by host.
create index if not exists ventures_host_open_idx
  on public.ventures (user_id, created_at desc)
  where status = 'open' and ended_at is null;
