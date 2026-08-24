-- MEUTUALS venue release: production SQL-editor verification
--
-- Run the three migration files below in this exact order, one at a time:
--   1. supabase/migrations/20260824040000_venue_places.sql
--   2. supabase/migrations/20260824050000_venture_private_venues.sql
--   3. supabase/migrations/20260824060000_rotate_exposed_push_dispatch_secret.sql
--
-- Then run this file. It returns booleans only and is safe to screenshot.

select 'venue_places_ready' as check_name,
       to_regclass('public.venue_places') is not null as passed
union all
select 'private_coordinates_ready',
       to_regclass('public.venue_place_coordinates') is not null
union all
select 'accepted_arrival_ready',
       to_regclass('public.venture_venues') is not null
union all
select 'venture_link_ready', exists (
  select 1 from information_schema.columns
  where table_schema = 'public'
    and table_name = 'ventures'
    and column_name = 'venue_place_id'
)
union all
select 'venue_owner_ready', exists (
  select 1 from information_schema.columns
  where table_schema = 'public'
    and table_name = 'venue_places'
    and column_name = 'created_by'
)
union all
select 'public_coordinates_removed', not exists (
  select 1 from information_schema.columns
  where table_schema = 'public'
    and table_name = 'venue_places'
    and column_name in ('latitude', 'longitude', 'coords_fetched_at')
)
union all
select 'per_venture_places_ready', not exists (
  select 1
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'venue_places'
    and con.conname = 'venue_places_google_place_id_key'
)
union all
select 'distance_bands_ready', exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'list_venture_distance_bands'
)
union all
select 'coordinate_expiry_ready', exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'expire_venue_coordinates'
)
union all
select 'public_venue_read_policy_ready', exists (
  select 1 from pg_policies
  where schemaname = 'public'
    and tablename = 'venue_places'
    and policyname = 'Signed-in members read venue places'
    and cmd = 'SELECT'
)
union all
select 'host_venue_insert_policy_ready', exists (
  select 1 from pg_policies
  where schemaname = 'public'
    and tablename = 'venue_places'
    and policyname = 'Hosts add venue places'
    and cmd = 'INSERT'
    and with_check ilike '%created_by%auth.uid%'
)
union all
select 'coordinate_insert_policy_ready', exists (
  select 1 from pg_policies
  where schemaname = 'public'
    and tablename = 'venue_place_coordinates'
    and policyname = 'Hosts add own venue coordinates'
    and cmd = 'INSERT'
    and with_check ilike '%created_by%auth.uid%'
)
union all
select 'accepted_arrival_read_policy_ready', exists (
  select 1 from pg_policies
  where schemaname = 'public'
    and tablename = 'venture_venues'
    and policyname = 'Host and accepted members read private venue'
    and cmd = 'SELECT'
)
union all
select 'host_arrival_write_policies_ready', count(*) = 3
from pg_policies
where schemaname = 'public'
  and tablename = 'venture_venues'
  and cmd in ('INSERT', 'UPDATE', 'DELETE')
union all
select 'push_secret_rotated_recently', exists (
  select 1 from vault.secrets
  where name = 'push_dispatch_secret'
    and updated_at >= date_trunc('day', now())
)
order by check_name;
