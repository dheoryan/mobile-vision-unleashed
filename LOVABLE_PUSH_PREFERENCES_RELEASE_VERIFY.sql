-- Run after 20260828020000_push_notification_preferences.sql in Lovable SQL Editor.
-- Every returned row must be true before publishing the matching application code.

select 'preference_table_ready' as check_name,
  to_regclass('public.push_notification_preferences') is not null as passed

union all
select 'category_columns_ready',
  count(*) = 5
from information_schema.columns
where table_schema = 'public'
  and table_name = 'push_notification_preferences'
  and column_name in (
    'messages_mentions',
    'venture_activity',
    'social_activity',
    'tribe_activity',
    'new_posts'
  )

union all
select 'new_posts_default_off',
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'push_notification_preferences'
      and column_name = 'new_posts'
      and column_default = 'false'
  )

union all
select 'preference_rls_ready',
  coalesce((
    select relrowsecurity
    from pg_class
    where oid = to_regclass('public.push_notification_preferences')
  ), false)

union all
select 'owner_policies_ready',
  count(*) = 3
from pg_policies
where schemaname = 'public'
  and tablename = 'push_notification_preferences'
  and policyname in (
    'Users read own push preferences',
    'Users create own push preferences',
    'Users update own push preferences'
  )

union all
select 'authenticated_grants_ready',
  has_table_privilege('authenticated', 'public.push_notification_preferences', 'SELECT')
  and has_table_privilege('authenticated', 'public.push_notification_preferences', 'INSERT')
  and has_table_privilege('authenticated', 'public.push_notification_preferences', 'UPDATE')
  and not has_table_privilege('anon', 'public.push_notification_preferences', 'SELECT')

union all
select 'updated_at_trigger_ready',
  exists (
    select 1
    from pg_trigger
    where not tgisinternal
      and tgname = 'touch_push_notification_preferences_updated_at'
      and tgrelid = to_regclass('public.push_notification_preferences')
  )

order by check_name;
