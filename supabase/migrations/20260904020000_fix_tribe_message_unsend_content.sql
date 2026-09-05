-- Fix: unsending a Tribe message fails a check constraint.
--
-- enforce_tribe_message_edit_fields (20260904010000) set content := '' on
-- unsend, based on the assumption tribe_messages.content was NOT NULL like
-- some other chat tables' content columns - it's actually nullable, same
-- as messages/venture_messages, and production carries a constraint named
-- tribe_messages_content_check (not present in this repo's migration
-- history, so presumably added directly against production at some point)
-- that a live "new row ... violates check constraint
-- tribe_messages_content_check" error confirms rejects an empty string.
-- The exact expression isn't available to write against here, but content
-- IS null-safe throughout this table (tribe_messages_has_content_or_
-- attachment already treats null the same as empty via
-- nullif(trim(coalesce(content, '')), '')), and null is the same "cleared"
-- value messages/venture_messages already use on unsend without issue -
-- switching to it sidesteps the constraint rather than needing to know its
-- exact shape.
--
-- Function replacement only - no table/constraint change, so this is
-- additive/safe the same way every function-only fix in this project is.

create or replace function public.enforce_tribe_message_edit_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if old.room_kind is not null then
    raise exception 'structured Tribe Room items cannot be edited or unsent here';
  end if;
  if auth.uid() is distinct from old.sender_id then
    raise exception 'only the sender may edit or unsend a message';
  end if;
  if old.deleted_at is not null then
    raise exception 'message has already been removed';
  end if;

  if new.sender_id is distinct from old.sender_id
     or new.tribe_id is distinct from old.tribe_id
     or new.created_at is distinct from old.created_at
     or new.reply_to_id is distinct from old.reply_to_id
     or new.room_kind is distinct from old.room_kind
     or new.room_metadata is distinct from old.room_metadata
     or new.mentions is distinct from old.mentions then
    raise exception 'only a message''s content can be edited';
  end if;

  if new.deleted_at is not null and old.deleted_at is null then
    new.content := null;
    new.attachment_url := null;
    new.attachment_type := null;
  elsif new.attachment_url is distinct from old.attachment_url
     or new.attachment_type is distinct from old.attachment_type then
    raise exception 'a message''s attachment cannot be changed after sending';
  else
    new.edited_at := now();
  end if;

  return new;
end;
$$;
