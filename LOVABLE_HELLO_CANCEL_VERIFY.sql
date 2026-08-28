-- Run after 20260828070000_hello_cancel_and_refund.sql in Lovable SQL Editor.
-- Every returned row must be true before publishing the matching application code.

select 'status_check_allows_cancelled' as check_name,
  exists (
    select 1 from pg_constraint
    where conname = 'hellos_status_check'
      and conrelid = to_regclass('public.hellos')
      and pg_get_constraintdef(oid) like '%''cancelled''%'
  ) as passed

union all
select 'single_update_policy_on_hellos',
  count(*) = 1
from pg_policies
where schemaname = 'public'
  and tablename = 'hellos'
  and cmd = 'UPDATE'

union all
select 'update_policy_covers_both_participants',
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hellos'
      and policyname = 'Participants update their own side of a hello'
  )

union all
select 'guard_trigger_still_attached',
  exists (
    select 1 from pg_trigger
    where not tgisinternal
      and tgname = 'trg_hellos_guard'
      and tgrelid = to_regclass('public.hellos')
  )

union all
select 'guard_checks_actor_for_transitions',
  pg_get_functiondef('public.hellos_guard()'::regprocedure) like '%Only the recipient can answer a Hello%'
  and pg_get_functiondef('public.hellos_guard()'::regprocedure) like '%Only the sender can cancel a Hello%'

union all
select 'capped_count_excludes_cancelled',
  pg_get_functiondef('public.hellos_capped_sent_this_month(uuid)'::regprocedure)
    like '%h.status <> ''cancelled''%'

order by check_name;
