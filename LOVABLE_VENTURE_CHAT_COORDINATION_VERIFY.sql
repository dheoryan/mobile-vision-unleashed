-- Run after 20260826010000_venture_chat_coordination.sql in Lovable SQL.
-- Every row must return passed = true before deploying the matching app code.

with checks(check_name, passed) as (
  values
    (
      'arrival_table_ready',
      to_regclass('public.venture_participant_statuses') is not null
    ),
    (
      'announcement_table_ready',
      to_regclass('public.venture_announcements') is not null
    ),
    (
      'system_message_columns_ready',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'venture_messages'
          and column_name = 'message_kind'
      )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'venture_messages'
          and column_name = 'system_event'
      )
    ),
    (
      'arrival_read_policy_ready',
      exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'venture_participant_statuses'
          and policyname = 'Venture members read arrival states'
          and cmd = 'SELECT'
          and qual ilike '%is_venture_member%'
      )
    ),
    (
      'arrival_write_policy_ready',
      exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'venture_participant_statuses'
          and policyname = 'Members set own arrival state'
          and cmd = 'INSERT'
          and with_check ilike '%is_venture_chat_open%'
      )
    ),
    (
      'host_pin_policy_ready',
      exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'venture_announcements'
          and policyname = 'Hosts pin Venture update'
          and cmd = 'INSERT'
          and with_check ilike '%is_venture_host%'
      )
    ),
    (
      'client_system_insert_blocked',
      exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'venture_messages'
          and policyname = 'Venture members send party chat'
          and cmd = 'INSERT'
          and with_check ilike '%message_kind%user%'
      )
    ),
    (
      'system_emitter_private',
      has_function_privilege('anon', 'public.emit_venture_system_message(uuid,uuid,text,text,text)', 'EXECUTE') = false
      and has_function_privilege('authenticated', 'public.emit_venture_system_message(uuid,uuid,text,text,text)', 'EXECUTE') = false
    ),
    (
      'coordination_triggers_ready',
      (
        select count(*) = 5
        from pg_trigger
        where not tgisinternal
          and tgname in (
            'announce_venture_arrival_state',
            'announce_venture_application_change',
            'announce_venture_details_change',
            'announce_private_venue_change',
            'announce_venture_pin_change'
          )
      )
    )
)
select check_name, passed from checks order by check_name;
