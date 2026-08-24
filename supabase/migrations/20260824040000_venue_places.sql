-- Ventures get a public place and a private coordinate source.
--
-- RED under CHANGE_PROTOCOL: this creates RLS policies, grants, and a
-- SECURITY DEFINER function. It is additive, but it must still be reviewed and
-- explicitly applied by Kila. Do not label it Green merely because the tables
-- are new; access changes are Red by definition.
--
-- Google's place_id may be retained. Coordinates are kept for at most 30 days.
-- Google-provided names and addresses are never persisted: host_label and area
-- are always the host's own words.

create table if not exists public.venue_places (
  id                uuid primary key default gen_random_uuid(),
  google_place_id   text,
  host_label        text not null,
  area              text not null default '',
  -- Audit/insert ownership only. Deliberately not an FK: profile deletion must
  -- not cascade into a place row while its Venture is being cleaned up.
  created_by        uuid not null default auth.uid(),
  created_at        timestamptz not null default now(),
  constraint venue_places_label_present
    check (char_length(btrim(host_label)) between 1 and 120)
);

-- Coordinates are deliberately not columns on the client-readable place row.
-- The only read path is list_venture_distance_bands(), which returns a coarse
-- band and never a latitude or longitude.
create table if not exists public.venue_place_coordinates (
  venue_place_id uuid primary key references public.venue_places(id) on delete cascade,
  latitude       double precision not null check (latitude between -90 and 90),
  longitude      double precision not null check (longitude between -180 and 180),
  fetched_at     timestamptz not null default now()
);

create index if not exists venue_places_google_idx
  on public.venue_places (google_place_id, created_at desc)
  where google_place_id is not null;

alter table public.venue_places enable row level security;
alter table public.venue_place_coordinates enable row level security;

drop policy if exists "Signed-in members read venue places" on public.venue_places;
create policy "Signed-in members read venue places"
  on public.venue_places for select to authenticated
  using (true);

drop policy if exists "Hosts add venue places" on public.venue_places;
create policy "Hosts add venue places"
  on public.venue_places for insert to authenticated
  with check (created_by = auth.uid());

-- No SELECT policy exists for coordinates. A member may insert coordinates
-- only for a place row they just created under their own identity.
drop policy if exists "Hosts add own venue coordinates" on public.venue_place_coordinates;
create policy "Hosts add own venue coordinates"
  on public.venue_place_coordinates for insert to authenticated
  with check (
    exists (
      select 1
      from public.venue_places vp
      where vp.id = venue_place_id
        and vp.created_by = auth.uid()
    )
  );

grant select, insert on public.venue_places to authenticated;
grant insert on public.venue_place_coordinates to authenticated;
grant all on public.venue_places, public.venue_place_coordinates to service_role;

alter table public.ventures
  add column if not exists venue_place_id uuid references public.venue_places(id);

comment on column public.ventures.venue_place_id is
  'Public venue identity and host-authored area. Coordinates remain server-only and expire after 30 days.';

create index if not exists ventures_venue_place_idx
  on public.ventures (venue_place_id)
  where venue_place_id is not null;

create or replace function public.list_venture_distance_bands(_venture_ids uuid[])
returns table(venture_id uuid, distance_band text)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select latitude, longitude
    from public.profile_locations
    where user_id = auth.uid()
  ), distances as (
    select
      v.id,
      6371 * acos(
        least(1, greatest(-1,
          cos(radians(me.latitude)) * cos(radians(c.latitude))
          * cos(radians(c.longitude) - radians(me.longitude))
          + sin(radians(me.latitude)) * sin(radians(c.latitude))
        ))
      ) as distance_km
    from public.ventures v
    join public.venue_place_coordinates c on c.venue_place_id = v.venue_place_id
    cross join me
    where v.id = any(coalesce(_venture_ids, '{}'::uuid[]))
      and cardinality(_venture_ids) between 1 and 80
      and (
        v.user_id = auth.uid()
        or public.has_venture_application(v.id, auth.uid())
        or (
          v.status = 'open'
          and public.is_venture_scope_visible(v.id, auth.uid())
        )
      )
  )
  select
    id,
    case
      when distance_km < 2 then 'Within 2 km'
      when distance_km < 5 then 'Within 5 km'
      when distance_km < 15 then 'Within 15 km'
      when distance_km < 50 then 'Within 50 km'
      else '50+ km away'
    end
  from distances
$$;

revoke all on function public.list_venture_distance_bands(uuid[]) from public, anon;
grant execute on function public.list_venture_distance_bands(uuid[])
  to authenticated, service_role;

create or replace function public.expire_venue_coordinates()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  swept integer;
begin
  delete from public.venue_place_coordinates
   where fetched_at < now() - interval '30 days';
  get diagnostics swept = row_count;
  return swept;
end;
$$;

revoke all on function public.expire_venue_coordinates() from public, anon, authenticated;
grant execute on function public.expire_venue_coordinates() to service_role;

comment on function public.expire_venue_coordinates() is
  'Deletes cached Google venue coordinates after 30 days. Public place identity and host-authored labels remain.';
