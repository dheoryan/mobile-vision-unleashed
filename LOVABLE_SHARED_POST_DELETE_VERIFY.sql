-- Read-only checks after applying 20260905020000_fix_shared_post_deletion.sql.
-- Expect two rows, with every boolean true. No test posts are created.
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
  coalesce(d.definition like '%pg_trigger_depth() > 1%', false) as nested_cleanup_only,
  coalesce(d.definition like '%old.shared_post_id is not null%new.shared_post_id is null%', false) as only_clear_reference,
  coalesce(d.definition like '%(to_jsonb(new) - ''shared_post_id'') = (to_jsonb(old) - ''shared_post_id'')%', false) as other_fields_preserved,
  coalesce(d.definition like '%new.shared_post_id is distinct from old.shared_post_id%', false) as direct_edits_still_guarded,
  exists (
    select 1 from pg_trigger t
    where t.tgrelid = to_regclass('public.' || d.table_name)
      and t.tgfoid = d.function_oid and t.tgenabled in ('O', 'A')
  ) as guard_enabled,
  exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = to_regclass('public.' || d.table_name)
      and c.contype = 'f' and c.confrelid = 'public.posts'::regclass
      and a.attname = 'shared_post_id' and c.confdeltype = 'n'
  ) as reference_clears_on_post_delete
from definitions d;
