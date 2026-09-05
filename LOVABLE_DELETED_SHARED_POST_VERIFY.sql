-- Run after 20260905030000_deleted_shared_post_placeholder.sql.
-- Read-only: expect two rows, every boolean true.
with guards(table_name, function_name) as (
  values ('messages', 'enforce_dm_message_edit_fields'),
         ('tribe_messages', 'enforce_tribe_message_edit_fields')
), definitions as (
  select g.*, p.oid as function_oid, pg_get_functiondef(p.oid) as definition
  from guards g
  left join pg_namespace n on n.nspname = 'public'
  left join pg_proc p on p.pronamespace = n.oid and p.proname = g.function_name and p.pronargs = 0
)
select d.table_name,
  exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = d.table_name
      and c.column_name = 'shared_post_deleted' and c.data_type = 'boolean'
      and c.is_nullable = 'NO' and c.column_default = 'false'
  ) as durable_marker_present,
  coalesce(d.definition like '%new.shared_post_deleted := false%', false) as insert_marker_initialized,
  coalesce(d.definition like '%pg_trigger_depth() > 1%new.shared_post_deleted := true%', false) as deletion_marks_shared_message,
  coalesce(d.definition like '%new.shared_post_deleted is distinct from old.shared_post_deleted%', false) as marker_edits_guarded,
  exists (
    select 1 from pg_trigger t
    where t.tgrelid = to_regclass('public.' || d.table_name)
      and t.tgfoid = d.function_oid and t.tgenabled in ('O', 'A')
      and (t.tgtype::integer & 23) = 23
  ) as insert_and_update_guard_enabled
from definitions d;
