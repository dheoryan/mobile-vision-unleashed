-- Run after 20260828050000_profile_stats_completed_ventures_only.sql in Lovable SQL Editor.
-- Every returned row must be true before relying on the updated Hosted/Joined counts.

select 'function_still_ready' as check_name,
  to_regprocedure('public.get_profile_stats(uuid)') is not null as passed

union all
select 'authenticated_grant_ready',
  has_function_privilege('authenticated', 'public.get_profile_stats(uuid)', 'EXECUTE')

union all
select 'anon_has_no_grant',
  not has_function_privilege('anon', 'public.get_profile_stats(uuid)', 'EXECUTE')

union all
select 'hosted_now_requires_closed',
  pg_get_functiondef('public.get_profile_stats(uuid)'::regprocedure) like '%v.user_id = _target_id%and v.status = ''closed''%'

union all
select 'joined_now_requires_closed',
  pg_get_functiondef('public.get_profile_stats(uuid)'::regprocedure) like '%a.status = ''accepted''%and v.status = ''closed''%'

union all
select 'function_returns_zeroes_for_unknown_user',
  (
    select moots_count = 0 and hosted_count = 0 and joined_count = 0
    from public.get_profile_stats('00000000-0000-0000-0000-000000000000'::uuid)
  )

order by check_name;
