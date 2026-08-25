-- Run after 20260825020000_chat_capability_parity.sql in Lovable SQL Editor.
-- Every returned row must be true before enabling rich DM/Venture chat in prod.

select 'dm_rich_columns_ready' as check_name,
  count(*) = 3 as passed
from information_schema.columns
where table_schema = 'public'
  and table_name = 'messages'
  and column_name in ('attachment_url', 'attachment_type', 'reply_to_id')

union all
select 'venture_rich_columns_ready',
  count(*) = 3
from information_schema.columns
where table_schema = 'public'
  and table_name = 'venture_messages'
  and column_name in ('attachment_url', 'attachment_type', 'reply_to_id')

union all
select 'reaction_table_ready',
  to_regclass('public.chat_message_reactions') is not null

union all
select 'reaction_rls_ready',
  coalesce((
    select relrowsecurity
    from pg_class
    where oid = 'public.chat_message_reactions'::regclass
  ), false)

union all
select 'reaction_policies_ready',
  count(*) = 3
from pg_policies
where schemaname = 'public'
  and tablename = 'chat_message_reactions'
  and policyname in (
    'Participants read chat reactions',
    'Participants add own chat reactions',
    'Participants remove own chat reactions'
  )

union all
select 'reply_guards_ready',
  count(*) = 2
from pg_trigger
where not tgisinternal
  and tgname = 'enforce_chat_reply_scope'
  and tgrelid in ('public.messages'::regclass, 'public.venture_messages'::regclass)

union all
select 'reaction_guard_ready',
  exists (
    select 1 from pg_trigger
    where not tgisinternal
      and tgname = 'enforce_chat_message_reaction'
      and tgrelid = 'public.chat_message_reactions'::regclass
  )

union all
select 'chat_bucket_private',
  exists (
    select 1 from storage.buckets
    where id = 'chat-attachments' and public = false
  )

union all
select 'chat_storage_policies_ready',
  count(*) = 3
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'Participants read chat attachments',
    'Users upload own chat attachments',
    'Users delete own unused chat attachments'
  )

union all
select 'access_helpers_locked_down',
  has_function_privilege('authenticated', 'public.can_access_chat_message(text,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.can_access_chat_message(text,uuid,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.can_read_chat_attachment(text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.can_read_chat_attachment(text,uuid)', 'EXECUTE')

order by check_name;
