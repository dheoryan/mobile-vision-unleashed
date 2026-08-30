-- Run after 20260830030000_harden_like_share_counters.sql in Lovable SQL Editor.
-- Every returned row must be true before publishing matching application code.

with trigger_state as (
  select
    c.relname as table_name,
    t.tgname as trigger_name,
    t.tgenabled <> 'D' as enabled,
    p.proname as function_name,
    p.prosecdef,
    coalesce(p.proconfig, array[]::text[]) @> array['search_path=public'] as search_path_pinned
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal
    and n.nspname = 'public'
    and c.relname in ('likes', 'shares')
), counter_truth as (
  select
    p.id,
    p.likes_count,
    p.shares_count,
    (select count(*)::integer from public.likes l where l.post_id = p.id) as actual_likes,
    (select count(*)::integer from public.shares s where s.post_id = p.id) as actual_shares
  from public.posts p
)
select 'likes_trigger_hardened' as check_name,
  count(*) = 1 as passed
from trigger_state
where table_name = 'likes'
  and trigger_name = 'likes_count'
  and function_name = 'sync_likes_count'
  and enabled
  and prosecdef
  and search_path_pinned

union all

select 'shares_trigger_hardened',
  count(*) = 1
from trigger_state
where table_name = 'shares'
  and trigger_name = 'shares_count'
  and function_name = 'sync_shares_count'
  and enabled
  and prosecdef
  and search_path_pinned

union all

select 'legacy_counter_triggers_absent',
  count(*) = 0
from trigger_state
where trigger_name in ('likes_bump_count', 'shares_bump_count')

union all

select 'trigger_functions_not_user_callable',
  not has_function_privilege('anon', 'public.sync_likes_count()', 'execute')
  and not has_function_privilege('authenticated', 'public.sync_likes_count()', 'execute')
  and not has_function_privilege('anon', 'public.sync_shares_count()', 'execute')
  and not has_function_privilege('authenticated', 'public.sync_shares_count()', 'execute')

union all

select 'likes_counts_reconciled',
  count(*) filter (where likes_count is distinct from actual_likes) = 0
from counter_truth

union all

select 'shares_counts_reconciled',
  count(*) filter (where shares_count is distinct from actual_shares) = 0
from counter_truth

union all

select 'stored_counts_nonnegative',
  count(*) filter (where likes_count < 0 or shares_count < 0) = 0
from counter_truth

order by check_name;
