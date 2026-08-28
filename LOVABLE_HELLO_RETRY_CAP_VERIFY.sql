-- Run after 20260828040000_hello_retry_and_split_cap.sql in Lovable SQL Editor.
-- Every returned row must be true before publishing the matching application code.

select 'old_unique_constraint_gone' as check_name,
  not exists (
    select 1 from pg_constraint
    where conname = 'hellos_one_per_pair'
      and conrelid = to_regclass('public.hellos')
  ) as passed

union all
select 'one_pending_per_pair_index_ready',
  exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'hellos'
      and indexname = 'hellos_one_pending_per_pair'
  )

union all
select 'status_check_allows_expired',
  exists (
    select 1 from pg_constraint
    where conname = 'hellos_status_check'
      and conrelid = to_regclass('public.hellos')
      and pg_get_constraintdef(oid) like '%''expired''%'
  )

union all
select 'retry_window_trigger_ready',
  exists (
    select 1 from pg_trigger
    where not tgisinternal
      and tgname = 'trg_hellos_retry_window'
      and tgrelid = to_regclass('public.hellos')
  )

union all
select 'hello_is_capped_ready',
  to_regprocedure('public.hello_is_capped(uuid, uuid)') is not null
  and has_function_privilege('authenticated', 'public.hello_is_capped(uuid, uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.hello_is_capped(uuid, uuid)', 'EXECUTE')

union all
select 'capped_count_fn_ready',
  to_regprocedure('public.hellos_capped_sent_this_month(uuid)') is not null
  and has_function_privilege('authenticated', 'public.hellos_capped_sent_this_month(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.hellos_capped_sent_this_month(uuid)', 'EXECUTE')

union all
select 'monthly_cap_trigger_still_attached',
  exists (
    select 1 from pg_trigger
    where not tgisinternal
      and tgname = 'trg_hellos_monthly_cap'
      and tgrelid = to_regclass('public.hellos')
  )

union all
select 'cap_is_now_30_not_5',
  pg_get_functiondef('public.hellos_enforce_monthly_cap()'::regprocedure) like '%monthly_cap constant int := 30%'

order by check_name;
