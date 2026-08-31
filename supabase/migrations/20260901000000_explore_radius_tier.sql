-- Today's Five: rank in-radius candidates first, only reach outside the
-- mutual radius to fill remaining slots (user decision, 2026-09-01).
--
-- The 20260828 version already computes distance_band as null whenever a
-- candidate is outside the mutual radius or distance can't be measured -
-- deliberately, so the *label* never leaks a radius someone chose to keep
-- private (see that comment, preserved below). But distance itself was only
-- ever a +10 addend inside one flat score alongside shared interests/intents
-- (worth up to 30 each), so someone hundreds or thousands of km away with
-- strong interest overlap could out-rank someone genuinely nearby with
-- weaker overlap - while the client shows a "50 km" radius control at the
-- top of the deck that reads as a scope, not a soft preference. That
-- mismatch between what the control implies and what the ranking actually
-- does is the real bug being fixed here, reported directly by two accounts
-- (Medan and Kudus) surfacing in a Jakarta-area account's Today's Five with
-- a 50 km radius set.
--
-- Fix: sort by "confirmed within the mutual radius" first, existing score
-- second. This is a strict ordering tier, not a WHERE filter - nobody is
-- newly excluded, so it does not reintroduce the empty-deck risk a hard
-- radius gate would create for a tight radius in a small Tribe. In-radius
-- candidates simply always sort ahead of everyone else; out-of-radius or
-- distance-unknown candidates only ever fill remaining slots once the
-- in-radius pool is exhausted.
--
-- Also adds `outside_radius`: true only when both people's locations and
-- radii are known AND the distance is confirmed to exceed the mutual
-- radius - distinct from "distance unknown" (never opted into Nearby),
-- which stays false. The client uses this to label a fallback card
-- honestly ("Outside your radius") instead of just silently omitting the
-- distance chip, which is what let this go unnoticed until a user reported
-- it by hand.
--
-- Everything else - the me/candidates shape, the distance math, the
-- impressions freshness penalty, the venture lateral join, the pagination
-- contract - is unchanged on purpose, so this is reviewable as a diff
-- against the last known-good version rather than a rewrite. Signature
-- changed (new output column), so this needs an explicit drop first;
-- `create or replace` cannot add an output column to an existing function.

drop function if exists public.list_explore_matches(integer, integer);

create function public.list_explore_matches(_limit integer default 20, _offset integer default 0)
returns table (
  profile_id uuid, score integer, shared_interests text[], shared_intents text[],
  shared_availability text[], same_tribe boolean, distance_band text,
  open_venture_id uuid, open_venture_title text, outside_radius boolean
)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id, p.tribe_ids, p.interests, p.social_intents, p.availability, l.latitude, l.longitude, l.radius_km
    from public.profiles p
    -- LEFT, and this is the whole point: no location means no proximity bonus,
    -- not an empty result set.
    left join public.profile_locations l on l.user_id = p.id and l.discoverable
    where p.id = auth.uid()
  ),
  candidates as (
    select p.id, p.tribe_ids, p.interests, p.social_intents, p.availability, p.updated_at,
      l.latitude, l.longitude, l.radius_km, ei.shown_at
    from public.profiles p
    left join public.profile_locations l on l.user_id = p.id and l.discoverable
    left join public.explore_impressions ei on ei.user_id = auth.uid() and ei.shown_id = p.id
    where p.id <> auth.uid() and p.suspended_at is null
      -- Someone with no Tribe has not finished onboarding; they have nothing
      -- to be discovered by yet.
      and cardinality(p.tribe_ids) > 0
      and not public.has_blocked(auth.uid(), p.id)
  ),
  measured as (
    select c.id, c.updated_at, c.shown_at,
      (c.tribe_ids && m.tribe_ids) as same_tribe,
      array(select i from unnest(c.interests) i where i = any (m.interests)) as shared_interests,
      array(select i from unnest(c.social_intents) i where i = any (m.social_intents)) as shared_intents,
      array(select i from unnest(c.availability) i where i = any (m.availability)) as shared_availability,
      -- Null distance when either side has no discoverable location. Nulls
      -- compare false in the band CASE below, so they simply score no
      -- proximity points rather than dropping out.
      case when c.latitude is null or m.latitude is null then null
        else 6371.0 * 2.0 * asin(sqrt(
          power(sin(radians(c.latitude - m.latitude) / 2.0), 2) +
          cos(radians(m.latitude)) * cos(radians(c.latitude)) *
          power(sin(radians(c.longitude - m.longitude) / 2.0), 2)))
      end as distance_km,
      least(c.radius_km, m.radius_km) as mutual_radius_km,
      ov.id as open_venture_id, ov.title as open_venture_title
    from candidates c cross join me m
    -- Their most recent open Venture with a seat left, and only one this
    -- viewer is actually allowed to see. A 'mine' Venture is Tribe-scoped, so
    -- advertising it to someone who would be refused at the door is a dead
    -- end dressed up as an invitation.
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
      -- True only when we positively know they're too far, so the client can
      -- tell "confirmed outside your radius" apart from "distance unknown"
      -- (never opted into Nearby) - very different honest labels.
      (distance_km is not null and mutual_radius_km is not null and distance_km > mutual_radius_km)
        as outside_radius,
      (
        (
          -- Wanting the same kind of company is the strongest single signal.
          case when cardinality(shared_intents) > 0 then 30 else 0 end +
          -- Each shared interest is worth something, but a long identical list
          -- is not three times the introduction that one is.
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
    same_tribe, distance_band, open_venture_id, open_venture_title, outside_radius
  from scored
  -- Confirmed-in-radius candidates first, full stop - then the existing
  -- score as before, then recency, then id for deterministic pagination.
  -- This is the one substantive behavior change in this migration.
  order by (distance_band is not null) desc, score desc, updated_at desc nulls last, id
  offset greatest(coalesce(_offset, 0), 0)
  limit least(greatest(coalesce(_limit, 20), 1), 50);
$$;

revoke all on function public.list_explore_matches(integer, integer) from public, anon;
grant execute on function public.list_explore_matches(integer, integer) to authenticated, service_role;
