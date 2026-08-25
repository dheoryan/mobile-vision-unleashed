-- MEUTUALS Tribe Room: production SQL-editor verification.
--
-- First run:
--   supabase/migrations/20260825010000_tribe_room.sql
--   supabase/migrations/20260825011000_tribe_chat_reactions.sql
--
-- Then run this file. It is read-only and returns booleans suitable for a
-- screenshot. Every row must be true before the Tribe Room code is deployed.

select 'room_kind_ready' as check_name,
       exists (
         select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = 'tribe_messages'
           and column_name = 'room_kind'
       ) as passed
union all
select 'room_metadata_ready', exists (
  select 1 from information_schema.columns
  where table_schema = 'public'
    and table_name = 'tribe_messages'
    and column_name = 'room_metadata'
)
union all
select 'reactions_ready', to_regclass('public.tribe_room_reactions') is not null
union all
select 'chat_reaction_values_ready', exists (
  select 1
  from pg_constraint
  where conname = 'tribe_room_reactions_reaction_check'
    and pg_get_constraintdef(oid) ilike '%heart%'
    and pg_get_constraintdef(oid) ilike '%laugh%'
    and pg_get_constraintdef(oid) ilike '%support%'
)
union all
select 'read_pointer_ready', to_regclass('public.tribe_room_reads') is not null
union all
select 'reaction_read_policy_ready', exists (
  select 1 from pg_policies
  where schemaname = 'public'
    and tablename = 'tribe_room_reactions'
    and policyname = 'Members read Tribe Room reactions'
    and cmd = 'SELECT'
    and qual ilike '%can_access_tribe_room_message%'
)
union all
select 'reaction_insert_policy_ready', exists (
  select 1 from pg_policies
  where schemaname = 'public'
    and tablename = 'tribe_room_reactions'
    and policyname = 'Members add own Tribe Room reactions'
    and cmd = 'INSERT'
    and with_check ilike '%user_id = auth.uid()%'
)
union all
select 'read_owner_policy_ready', exists (
  select 1 from pg_policies
  where schemaname = 'public'
    and tablename = 'tribe_room_reads'
    and policyname = 'Members update own Tribe Room pointer'
    and cmd = 'UPDATE'
    and qual ilike '%user_id = auth.uid()%'
)
union all
select 'membership_helper_ready', has_function_privilege(
  'authenticated',
  'public.can_access_tribe_room_message(uuid, uuid)',
  'EXECUTE'
)
union all
select 'helper_hidden_from_anon', not has_function_privilege(
  'anon',
  'public.can_access_tribe_room_message(uuid, uuid)',
  'EXECUTE'
)
union all
select 'adult_write_guard_reactions', exists (
  select 1
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'tribe_room_reactions'
    and t.tgname = 'require_adult_before_write'
    and not t.tgisinternal
)
union all
select 'adult_write_guard_reads', exists (
  select 1
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'tribe_room_reads'
    and t.tgname = 'require_adult_before_write'
    and not t.tgisinternal
)
union all
select 'venture_announcement_guard_ready', exists (
  select 1
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'tribe_messages'
    and t.tgname = 'enforce_tribe_room_message'
    and not t.tgisinternal
)
union all
select 'reaction_kind_guard_ready', exists (
  select 1
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'tribe_room_reactions'
    and t.tgname = 'enforce_tribe_room_reaction'
    and not t.tgisinternal
);
