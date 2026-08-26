-- Run after 20260826020000_tribe_plan_availability.sql.
-- Every returned row must be true before releasing the matching application.

with checks as (
  select
    'availability_reactions_allowed'::text as check_name,
    exists (
      select 1
      from pg_constraint
      where conrelid = 'public.tribe_room_reactions'::regclass
        and conname = 'tribe_room_reactions_reaction_check'
        and pg_get_constraintdef(oid) ilike '%time_1%'
        and pg_get_constraintdef(oid) ilike '%time_2%'
        and pg_get_constraintdef(oid) ilike '%time_3%'
    ) as passed
  union all
  select
    'plan_timing_shape_ready',
    exists (
      select 1
      from pg_constraint
      where conrelid = 'public.tribe_messages'::regclass
        and conname = 'tribe_plan_timing_shape'
        and pg_get_constraintdef(oid) ilike '%timing_mode%'
        and pg_get_constraintdef(oid) ilike '%time_options%'
    )
  union all
  select
    'availability_trigger_ready',
    exists (
      select 1
      from pg_trigger
      where tgrelid = 'public.tribe_room_reactions'::regclass
        and tgname = 'enforce_tribe_room_reaction'
        and not tgisinternal
    )
    and pg_get_functiondef(
      'public.enforce_tribe_room_reaction()'::regprocedure
    ) ilike '%time_options%'
  union all
  select
    'availability_function_pinned',
    exists (
      select 1
      from pg_proc
      where oid = 'public.enforce_tribe_room_reaction()'::regprocedure
        and prosecdef
        and coalesce(proconfig, array[]::text[]) @> array['search_path=public']
    )
  union all
  select
    'availability_function_private',
    not has_function_privilege('anon', 'public.enforce_tribe_room_reaction()', 'EXECUTE')
    and not has_function_privilege(
      'authenticated',
      'public.enforce_tribe_room_reaction()',
      'EXECUTE'
    )
  union all
  select
    'member_reaction_policies_preserved',
    (
      select count(*)
      from pg_policies
      where schemaname = 'public'
        and tablename = 'tribe_room_reactions'
        and policyname in (
          'Members read Tribe Room reactions',
          'Members add own Tribe Room reactions',
          'Members remove own Tribe Room reactions'
        )
    ) = 3
)
select check_name, passed
from checks
order by check_name;
