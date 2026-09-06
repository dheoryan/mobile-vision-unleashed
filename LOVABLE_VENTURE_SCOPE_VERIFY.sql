-- Run after 20260820000600_enforce_venture_scope.sql in Lovable SQL Editor.
-- Every returned row must be true before relying on Tribe-only ("mine" scope)
-- Ventures being actually private at the database layer (finding S5).

select 'scope_function_exists_stable_definer' as check_name,
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_venture_scope_visible'
      and p.pronargs = 2
      and p.prosecdef = true
      and p.provolatile = 's'
  ) as passed

union all
select 'scope_function_search_path_pinned',
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_venture_scope_visible'
      and p.proconfig is not null
      and 'search_path=public' = any (p.proconfig)
  )

union all
select 'anon_denied_authenticated_granted_execute',
  not has_function_privilege('anon', 'public.is_venture_scope_visible(uuid,uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.is_venture_scope_visible(uuid,uuid)', 'execute')

union all
select 'single_permissive_select_policy_on_ventures',
  count(*) = 1
from pg_policies
where schemaname = 'public'
  and tablename = 'ventures'
  and cmd = 'SELECT'
  and permissive = 'PERMISSIVE'

union all
-- Sits alongside the permissive scope check above, not instead of it: this
-- one is RESTRICTIVE (AND, not OR), from 20260820000900_enforce_adult_verification.sql.
-- A verified adult still has to also pass the scope check to see a row; this
-- table intentionally ends up with 2 SELECT policies total, not 1.
select 'restrictive_adult_gate_still_present_on_ventures',
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ventures'
      and cmd = 'SELECT'
      and permissive = 'RESTRICTIVE'
      and policyname = 'Only verified adults read Ventures'
  )

union all
select 'ventures_select_policy_calls_scope_function',
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ventures'
      and policyname = 'Users read open or related ventures'
      and cmd = 'SELECT'
      and qual like '%is_venture_scope_visible%'
  )

union all
select 'venture_applications_insert_policy_calls_scope_function',
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'venture_applications'
      and policyname = 'Users apply to open ventures'
      and cmd = 'INSERT'
      and with_check like '%is_venture_scope_visible%'
  )

order by check_name;
