-- Run after 20260828060000_explore_impressions_freshness.sql in Lovable SQL Editor.
-- Every returned row must be true before publishing the matching application code.

select 'impressions_table_ready' as check_name,
  to_regclass('public.explore_impressions') is not null as passed

union all
select 'impressions_pk_is_user_and_shown',
  (
    select array_agg(a.attname::text order by a.attname)
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indrelid = to_regclass('public.explore_impressions')
      and i.indisprimary
  ) = array['shown_id', 'user_id']

union all
select 'impressions_recency_index_ready',
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'explore_impressions'
      and indexname = 'explore_impressions_recency_idx'
  )

union all
select 'impressions_rls_ready',
  coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.explore_impressions')), false)

union all
select 'impressions_owner_only_policy_ready',
  count(*) = 1
from pg_policies
where schemaname = 'public'
  and tablename = 'explore_impressions'
  and policyname = 'Users manage their own explore impressions'

union all
select 'impressions_grants_ready',
  has_table_privilege('authenticated', 'public.explore_impressions', 'SELECT')
  and has_table_privilege('authenticated', 'public.explore_impressions', 'INSERT')
  and has_table_privilege('authenticated', 'public.explore_impressions', 'UPDATE')
  and not has_table_privilege('anon', 'public.explore_impressions', 'SELECT')

union all
select 'ranking_function_reads_impressions',
  pg_get_functiondef('public.list_explore_matches(integer, integer)'::regprocedure)
    like '%explore_impressions%'

union all
select 'ranking_function_grants_unchanged',
  has_function_privilege('authenticated', 'public.list_explore_matches(integer, integer)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.list_explore_matches(integer, integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.list_explore_matches(integer, integer)', 'EXECUTE')

order by check_name;
