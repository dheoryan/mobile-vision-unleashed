-- RED / MANUAL MIGRATION
--
-- Expands the shared durable chat vocabulary without changing reaction
-- ownership, participant authorization, or the one-row-per-reaction model.

alter table public.chat_message_reactions
  drop constraint if exists chat_message_reactions_reaction_check;

alter table public.chat_message_reactions
  add constraint chat_message_reactions_reaction_check
  check (reaction in ('heart', 'laugh', 'wow', 'sad', 'like', 'support'));

alter table public.tribe_room_reactions
  drop constraint if exists tribe_room_reactions_reaction_check;

alter table public.tribe_room_reactions
  add constraint tribe_room_reactions_reaction_check
  check (
    reaction in (
      'spark', 'interested',
      'heart', 'laugh', 'wow', 'sad', 'like', 'support',
      'time_1', 'time_2', 'time_3'
    )
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
       new.reaction in ('heart', 'laugh', 'wow', 'sad', 'like', 'support')
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

comment on constraint chat_message_reactions_reaction_check
  on public.chat_message_reactions is
  'Durable DM and Venture reactions use the bounded shared six-reaction vocabulary.';

comment on constraint tribe_room_reactions_reaction_check
  on public.tribe_room_reactions is
  'Tribe chat uses the shared six reactions; pulse, plan-interest, and time votes remain contextual.';
