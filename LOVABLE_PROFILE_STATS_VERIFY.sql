-- Run after 20260828030000_profile_relationship_stats.sql in Lovable SQL Editor.
-- Every returned row must be true before publishing the matching application code.

select 'function_ready' as check_name,
  to_regprocedure('public.get_profile_stats(uuid)') is not null as passed

union all
select 'authenticated_grant_ready',
  has_function_privilege('authenticated', 'public.get_profile_stats(uuid)', 'EXECUTE')

union all
select 'anon_has_no_grant',
  not has_function_privilege('anon', 'public.get_profile_stats(uuid)', 'EXECUTE')

union all
select 'function_returns_zeroes_for_unknown_user',
  (
    select moots_count = 0 and hosted_count = 0 and joined_count = 0
    from public.get_profile_stats('00000000-0000-0000-0000-000000000000'::uuid)
  )

order by check_name;
