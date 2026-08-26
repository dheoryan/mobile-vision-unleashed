-- Extend the structured Tribe Room reaction table to ordinary chat messages.
-- Run after 20260825010000_tribe_room.sql.

alter table public.tribe_room_reactions
  drop constraint if exists tribe_room_reactions_reaction_check;

alter table public.tribe_room_reactions
  add constraint tribe_room_reactions_reaction_check
  check (reaction in ('spark', 'interested', 'heart', 'laugh', 'support'));

create or replace function public.enforce_tribe_room_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  message_kind text;
  message_attachment_type text;
begin
  select room_kind, attachment_type
    into message_kind, message_attachment_type
  from public.tribe_messages
  where id = new.message_id;

  if not found then
    raise exception 'Message not found';
  end if;

  if (new.reaction = 'spark' and message_kind is distinct from 'pulse_answer')
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
