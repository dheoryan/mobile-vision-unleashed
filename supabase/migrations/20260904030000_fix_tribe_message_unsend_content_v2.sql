-- Fix, take 2: unsending a Tribe message still fails, now on a different
-- constraint.
--
-- 20260904020000 switched unsend to content := null, on the assumption
-- tribe_messages.content was nullable there like messages/venture_messages
-- (matching this repo's own create_tribe_messages.sql, which shows no NOT
-- NULL on that column). Production disagrees: "null value in column
-- ''content'' ... violates not-null constraint" confirms it's actually
-- NOT NULL live - another change made directly against production outside
-- any tracked migration, same as tribe_messages_content_check itself
-- (20260904010000's own commit message already noted that one couldn't be
-- found in this repo's history either). So neither '' (rejected by the
-- check) nor null (rejected by not-null) can ever work here.
--
-- The client already renders the "Message removed" tombstone purely from
-- deleted_at - see the `if (m.deleted_at) { ... }` branch in both
-- TribeScreen.tsx and MessagesPanel.tsx - it never reads a deleted
-- message's content at all. That makes the actual stored value irrelevant
-- to what anyone sees, so a real, non-empty placeholder string satisfies
-- both constraints (NOT NULL, and whatever "must have visible content"
-- shape tribe_messages_content_check turns out to enforce) without ever
-- reaching a screen.
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
    -- Never actually rendered - the client shows the tombstone purely from
    -- deleted_at being set, never by reading this value.
    new.content := '[message removed]';
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
