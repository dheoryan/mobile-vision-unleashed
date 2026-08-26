-- RED / MANUAL MIGRATION
--
-- Adds per-option availability to Tribe plan proposals by extending the
-- existing normalized reaction table. This deliberately does not add a second
-- voting table: membership authorization, cleanup, and one-vote-per-member are
-- already enforced by tribe_room_reactions.

alter table public.tribe_room_reactions
  drop constraint if exists tribe_room_reactions_reaction_check;

alter table public.tribe_room_reactions
  add constraint tribe_room_reactions_reaction_check
  check (
    reaction in (
      'spark', 'interested', 'heart', 'laugh', 'support',
      'time_1', 'time_2', 'time_3'
    )
  );

alter table public.tribe_messages
  drop constraint if exists tribe_plan_timing_shape;

alter table public.tribe_messages
  add constraint tribe_plan_timing_shape
  check (
    case
      when room_kind is distinct from 'plan'
        or not (room_metadata ? 'timing_mode') then true
      when coalesce(room_metadata ->> 'timing_mode', '') not in ('single', 'poll')
        or jsonb_typeof(room_metadata -> 'time_options') is distinct from 'array' then false
      else
        jsonb_array_length(room_metadata -> 'time_options') between 1 and 3
        and room_metadata -> 'time_options' -> 0 ->> 'key' = 'time_1'
        and (
          jsonb_array_length(room_metadata -> 'time_options') < 2
          or room_metadata -> 'time_options' -> 1 ->> 'key' = 'time_2'
        )
        and (
          jsonb_array_length(room_metadata -> 'time_options') < 3
          or room_metadata -> 'time_options' -> 2 ->> 'key' = 'time_3'
        )
        and (
          (room_metadata ->> 'timing_mode' = 'single'
            and jsonb_array_length(room_metadata -> 'time_options') = 1)
          or (room_metadata ->> 'timing_mode' = 'poll'
            and jsonb_array_length(room_metadata -> 'time_options') between 2 and 3)
        )
    end
  );

create or replace function public.enforce_tribe_room_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  message_kind text;
  message_attachment_type text;
  message_metadata jsonb;
  option_index integer;
begin
  select room_kind, attachment_type, room_metadata
    into message_kind, message_attachment_type, message_metadata
  from public.tribe_messages
  where id = new.message_id;

  if not found then
    raise exception 'Message not found';
  end if;

  if new.reaction like 'time\_%' escape '\' then
    option_index := substring(new.reaction from '[1-3]$')::integer - 1;
    if message_kind is distinct from 'plan'
       or message_metadata ->> 'timing_mode' is distinct from 'poll'
       or jsonb_typeof(message_metadata -> 'time_options') is distinct from 'array' then
      raise exception 'Availability option does not apply to this Tribe plan';
    end if;
    if jsonb_array_length(message_metadata -> 'time_options') <= option_index
       or message_metadata -> 'time_options' -> option_index ->> 'key'
            is distinct from new.reaction then
      raise exception 'Availability option does not apply to this Tribe plan';
    end if;
  elsif (new.reaction = 'spark' and message_kind is distinct from 'pulse_answer')
     or (new.reaction = 'interested' and message_kind is distinct from 'plan')
     or (
       new.reaction in ('heart', 'laugh', 'support')
       and (
         message_kind is not null
         or coalesce(message_attachment_type, '') like 'system:%'
       )
     ) then
    raise exception 'Reaction does not apply to this room item';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_tribe_room_reaction() from public;
revoke execute on function public.enforce_tribe_room_reaction() from anon, authenticated;

comment on constraint tribe_room_reactions_reaction_check
  on public.tribe_room_reactions is
  'time_1..time_3 are per-member availability votes for bounded Tribe plan options.';
