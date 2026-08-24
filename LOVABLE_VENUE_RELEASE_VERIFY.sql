-- MEUTUALS venue release: production SQL-editor verification
--
-- Run the three migration files below in this exact order, one at a time:
--   1. supabase/migrations/20260824040000_venue_places.sql
--   2. supabase/migrations/20260824050000_venture_private_venues.sql
--   3. supabase/migrations/20260824060000_rotate_exposed_push_dispatch_secret.sql
--
-- Then run this file. It returns booleans only and is safe to screenshot.

select
  to_regclass('public.venue_places') is not null as venue_places_ready,
  to_regclass('public.venue_place_coordinates') is not null as private_coordinates_ready,
  to_regclass('public.venture_venues') is not null as accepted_arrival_ready,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ventures'
      and column_name = 'venue_place_id'
  ) as venture_link_ready,
  to_regprocedure('public.list_venture_distance_bands(uuid[])') is not null
    as distance_bands_ready,
  to_regprocedure('public.expire_venue_coordinates()') is not null
    as coordinate_expiry_ready;

select
  count(*) filter (
    where tablename = 'venue_places'
      and policyname = 'Signed-in members read venue places'
      and cmd = 'SELECT'
  ) = 1 as public_venue_read_policy_ready,
  count(*) filter (
    where tablename = 'venue_places'
      and policyname = 'Hosts add venue places'
      and cmd = 'INSERT'
  ) = 1 as host_venue_insert_policy_ready,
  count(*) filter (
    where tablename = 'venue_place_coordinates'
      and policyname = 'Hosts add own venue coordinates'
      and cmd = 'INSERT'
  ) = 1 as coordinate_insert_policy_ready,
  count(*) filter (
    where tablename = 'venture_venues'
      and policyname = 'Host and accepted members read private venue'
      and cmd = 'SELECT'
  ) = 1 as accepted_arrival_read_policy_ready,
  count(*) filter (
    where tablename = 'venture_venues'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  ) = 3 as host_arrival_write_policies_ready
from pg_policies
where schemaname = 'public'
  and tablename in ('venue_places', 'venue_place_coordinates', 'venture_venues');

select
  exists (
    select 1
    from vault.secrets
    where name = 'push_dispatch_secret'
      and updated_at >= now() - interval '15 minutes'
  ) as push_secret_rotated_recently;
