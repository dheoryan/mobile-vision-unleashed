-- Run in Lovable Cloud's SQL editor after 20260901000000_explore_radius_tier.sql.
-- Every row should return true.

select 'single_two_arg_overload' as check_name,
  (
    select count(*) from pg_proc
    where proname = 'list_explore_matches' and pronargs = 2
  ) = 1 as ok

union all
select 'outside_radius_column_present',
  position('outside_radius' in pg_get_function_result(
    'public.list_explore_matches(integer,integer)'::regprocedure
  )) > 0

union all
select 'in_radius_tier_ordering_present',
  position('(distance_band is not null) desc' in (
    select prosrc from pg_proc
    where oid = 'public.list_explore_matches(integer,integer)'::regprocedure
  )) > 0

union all
select 'outside_radius_requires_confirmed_distance',
  position('distance_km is not null and mutual_radius_km is not null and distance_km > mutual_radius_km' in (
    select prosrc from pg_proc
    where oid = 'public.list_explore_matches(integer,integer)'::regprocedure
  )) > 0

union all
select 'anon_denied_execute',
  not has_function_privilege('anon', 'public.list_explore_matches(integer,integer)', 'execute')

union all
select 'authenticated_granted_execute',
  has_function_privilege('authenticated', 'public.list_explore_matches(integer,integer)', 'execute')

union all
select 'service_role_granted_execute',
  has_function_privilege('service_role', 'public.list_explore_matches(integer,integer)', 'execute');
