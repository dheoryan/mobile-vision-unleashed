-- Run in Lovable Cloud's SQL editor after
-- 20260906010000_venture_journey_consistency.sql.
-- Every row should return true.

select 'cancelled_at_exists' as check_name,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ventures' and column_name = 'cancelled_at'
  ) as ok
union all
select 'venture_reads_exists', to_regclass('public.venture_room_reads') is not null
union all
select 'venture_reads_rls', coalesce((
  select relrowsecurity from pg_class where oid = 'public.venture_room_reads'::regclass
), false)
union all
select 'venture_reads_three_policies', (
  select count(*) = 3 from pg_policies
  where schemaname = 'public' and tablename = 'venture_room_reads'
)
union all
select 'venture_reads_member_safe', not exists (
  select 1 from public.venture_room_reads r
  where not public.is_venture_member(r.venture_id, r.user_id)
)
union all
select 'existing_hosts_have_pointer', not exists (
  select 1 from public.ventures v
  left join public.venture_room_reads r
    on r.venture_id = v.id and r.user_id = v.user_id
  where r.user_id is null
)
union all
select 'existing_members_have_pointer', not exists (
  select 1 from public.venture_applications a
  left join public.venture_room_reads r
    on r.venture_id = a.venture_id and r.user_id = a.applicant_id
  where a.status = 'accepted' and r.user_id is null
)
union all
select 'read_pointer_triggers_exist', (
  select count(*) = 2 from pg_trigger
  where not tgisinternal
    and tgname in ('initialize_host_venture_read_pointer', 'initialize_member_venture_read_pointer')
)
union all
select 'future_completion_guard_exists', exists (
  select 1 from pg_trigger
  where not tgisinternal and tgname = 'enforce_venture_outcome_timing'
)
union all
select 'joinable_closes_at_start', position('starts_at' in (
  select prosrc from pg_proc
  where oid = 'public.is_venture_joinable(uuid)'::regprocedure
)) > 0
union all
select 'application_notifications_updated', position('venture_invite_accept' in (
  select prosrc from pg_proc
  where oid = 'public.notify_on_venture_application()'::regprocedure
)) > 0
union all
select 'profile_stats_exclude_cancelled', position('cancelled_at' in (
  select prosrc from pg_proc
  where oid = 'public.get_profile_stats(uuid)'::regprocedure
)) > 0
union all
select 'journey_notification_kinds_allowed', (
  select pg_get_constraintdef(oid) like '%venture_decline%'
    and pg_get_constraintdef(oid) like '%venture_invite_accept%'
    and pg_get_constraintdef(oid) like '%venture_withdraw%'
  from pg_constraint
  where conrelid = 'public.notifications'::regclass
    and conname = 'notifications_kind_check'
);
