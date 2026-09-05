-- Read-only verification after applying 20260905040000_share_events.sql.
-- Every column in the single result row should be true.
select
  to_regclass('public.share_events') is not null as share_events_table_exists,
  coalesce((select c.relrowsecurity from pg_class c where c.oid = 'public.share_events'::regclass), false)
    as share_events_rls_enabled,
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.share_events'::regclass and contype = 'p'
  ) as request_identity_primary_key_exists,
  exists (
    select 1
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'public.share_events'::regclass
      and c.contype = 'f'
      and a.attname = 'post_id'
      and c.confdeltype = 'c'
  ) as post_delete_cascades_events,
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'share_events'
      and policyname = 'share_events_own'
  ) as own_event_read_policy_exists,
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'share_events'
      and policyname = 'share_events_external_insert'
  ) as external_event_insert_policy_exists,
  not has_table_privilege('anon', 'public.share_events', 'SELECT')
    and not has_table_privilege('anon', 'public.share_events', 'INSERT')
    as anonymous_access_revoked,
  has_table_privilege('authenticated', 'public.share_events', 'SELECT')
    and has_table_privilege('authenticated', 'public.share_events', 'INSERT')
    as authenticated_access_granted,
  to_regprocedure('public.record_external_share(uuid,uuid,text)') is not null
    as external_share_rpc_exists,
  not has_function_privilege('anon', 'public.record_external_share(uuid,uuid,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.record_external_share(uuid,uuid,text)', 'EXECUTE')
    as external_share_rpc_grants_are_safe,
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.messages'::regclass
      and tgname = 'record_dm_share_event' and tgenabled <> 'D'
  ) as dm_share_trigger_active,
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.tribe_messages'::regclass
      and tgname = 'record_tribe_share_event' and tgenabled <> 'D'
  ) as tribe_share_trigger_active,
  exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'anonymize_share_events' and tgenabled <> 'D'
  ) as account_delete_anonymization_active,
  not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.shares'::regclass
      and tgname in ('shares_bump_count', 'shares_count') and tgenabled <> 'D'
  ) as legacy_counter_triggers_disabled,
  not exists (
    select 1 from public.shares s
    join public.posts p on p.id = s.post_id
    where not exists (
      select 1 from public.share_events e
      where e.user_id = s.user_id and e.request_id = s.post_id
        and e.post_id = s.post_id and e.channel = 'legacy'
    )
  ) as legacy_share_baseline_preserved,
  not exists (
    select 1 from public.posts p
    where p.shares_count is distinct from (
      select count(*) from public.share_events e where e.post_id = p.id
    )
  ) as all_post_share_counts_reconciled;
