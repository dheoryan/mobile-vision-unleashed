-- Rich profile matching plus privacy-safe nearby discovery.
-- Coordinates live outside public.profiles, are readable only by their owner,
-- and are rounded by application code before storage. Other members receive
-- only a coarse distance band and a 0-100 similarity score through the RPC.

alter table public.profiles
  add column if not exists interests text[] not null default '{}',
  add column if not exists social_intents text[] not null default '{}',
  add column if not exists availability text[] not null default '{}';

alter table public.profiles
  add constraint profiles_interests_allowed check (
    cardinality(interests) <= 8 and
    interests <@ array['outdoors','fitness','books','music','art','food','coffee','nightlife','tech','business','wellness','games']::text[]
  ),
  add constraint profiles_social_intents_allowed check (
    cardinality(social_intents) <= 3 and
    social_intents <@ array['make_friends','activity_partner','casual_hangouts','local_exploration','networking','creative_collab']::text[]
  ),
  add constraint profiles_availability_allowed check (
    cardinality(availability) <= 4 and
    availability <@ array['weekday_mornings','weekday_evenings','weekends','spontaneous']::text[]
  );

create table public.profile_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m integer not null default 0 check (accuracy_m between 0 and 100000),
  discoverable boolean not null default true,
  radius_km smallint not null default 15 check (radius_km in (5, 15, 50)),
  updated_at timestamptz not null default now()
);

alter table public.profile_locations enable row level security;

create policy "Users read their own location"
  on public.profile_locations for select to authenticated
  using (auth.uid() = user_id);

create policy "Users insert their own location"
  on public.profile_locations for insert to authenticated
  with check (auth.uid() = user_id and public.is_verified_adult(auth.uid()));

create policy "Users update their own location"
  on public.profile_locations for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.is_verified_adult(auth.uid()));

create policy "Users delete their own location"
  on public.profile_locations for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.touch_profile_location()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profile_locations_touch_updated_at
before update on public.profile_locations
for each row execute function public.touch_profile_location();

create or replace function public.list_nearby_profile_matches(_limit integer default 20)
returns table(profile_id uuid, distance_band text, match_score integer)
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
    join public.profile_locations l on l.user_id = p.id
    where p.id = auth.uid()
      and p.adult_verified_at is not null
      and p.suspended_at is null
      and l.discoverable
  ),
  candidates as (
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
    join public.profile_locations l on l.user_id = p.id
    where p.id <> auth.uid()
      and p.adult_verified_at is not null
      and p.suspended_at is null
      and cardinality(p.tribe_ids) > 0
      and l.discoverable
      and not public.has_blocked(auth.uid(), p.id)
  ),
  measured as (
    select
      c.*,
      m.tribe_ids as my_tribes,
      m.interests as my_interests,
      m.social_intents as my_social_intents,
      m.availability as my_availability,
      6371.0 * 2.0 * asin(sqrt(
        power(sin(radians(c.latitude - m.latitude) / 2.0), 2) +
        cos(radians(m.latitude)) * cos(radians(c.latitude)) *
        power(sin(radians(c.longitude - m.longitude) / 2.0), 2)
      )) as distance_km,
      least(c.radius_km, m.radius_km) as mutual_radius_km
    from candidates c cross join me m
  ),
  scored as (
    select
      id,
      distance_km,
      case
        when distance_km <= 2 then 'Within 2 km'
        when distance_km <= 5 then 'Within 5 km'
        when distance_km <= 15 then 'Within 15 km'
        else 'Within 50 km'
      end as distance_band,
      (
        case when tribe_ids && my_tribes then 20 else 0 end +
        least(20, 10 * (select count(*)::integer from unnest(interests) item where item = any(my_interests))) +
        case when social_intents && my_social_intents then 25 else 0 end +
        case when availability && my_availability then 20 else 0 end +
        case when distance_km <= 5 then 15 when distance_km <= 15 then 10 else 5 end
      )::integer as score
    from measured
    where distance_km <= mutual_radius_km
  )
  select id, distance_band, least(score, 100)
  from scored
  order by score desc, distance_km asc, id
  limit least(greatest(coalesce(_limit, 20), 1), 50);
$$;

revoke all on function public.list_nearby_profile_matches(integer) from public, anon;
grant execute on function public.list_nearby_profile_matches(integer) to authenticated, service_role;

create index profile_locations_discoverable_idx
  on public.profile_locations (discoverable, updated_at desc)
  where discoverable;
