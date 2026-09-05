-- Allow deleting posts that have been shared into DM or Tribe chat.
-- The previous immutable shared_post_id guard rejected PostgreSQL's own
-- ON DELETE SET NULL update, rolling back the entire post deletion.
-- Run this function-only migration after 20260905010000_shared_post_messages.
-- No data, policies, grants, or constraints change. All ordinary edit and
-- unsend checks remain, including for messages whose post reference is gone.
create or replace function public.enforce_dm_message_edit_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- A post DELETE invokes ON DELETE SET NULL in a nested FK trigger.
  -- Permit only that reference cleanup, with every other column unchanged.
  -- Direct edits, retargeting, and nested content/identity changes still fail.
  if pg_trigger_depth() > 1
     and old.shared_post_id is not null
     and new.shared_post_id is null
     and (to_jsonb(new) - 'shared_post_id') = (to_jsonb(old) - 'shared_post_id') then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.created_at is distinct from old.created_at
     or new.reply_to_id is distinct from old.reply_to_id
     or new.shared_post_id is distinct from old.shared_post_id then
    raise exception 'only a message''s content, its attachment on unsend, and the read receipt can change';
  end if;

  -- Read-receipt path: the one thing a recipient may change on a message
  -- they didn't send. Same rules guard_message_read_update enforced.
  if new.content is not distinct from old.content
     and new.deleted_at is not distinct from old.deleted_at
     and new.attachment_url is not distinct from old.attachment_url
     and new.attachment_type is not distinct from old.attachment_type then
    if new.read_at is distinct from old.read_at then
      if auth.uid() is distinct from old.recipient_id then
        raise exception 'only the recipient can mark a message read';
      end if;
      if old.read_at is not null then
        raise exception 'a read message cannot be marked unread or re-timestamped';
      end if;
      if new.read_at is null then
        raise exception 'read_at must be set, not cleared';
      end if;
    end if;
    return new;
  end if;

  -- Anything reaching here changes content/deleted_at/attachment - sender only.
  if auth.uid() is distinct from old.sender_id then
    raise exception 'only the sender may edit or unsend a message';
  end if;
  if old.deleted_at is not null then
    raise exception 'message has already been removed';
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

create or replace function public.enforce_tribe_message_edit_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- A post DELETE invokes ON DELETE SET NULL in a nested FK trigger.
  -- Permit only that reference cleanup, with every other column unchanged.
  -- Direct edits, retargeting, and nested content/identity changes still fail.
  if pg_trigger_depth() > 1
     and old.shared_post_id is not null
     and new.shared_post_id is null
     and (to_jsonb(new) - 'shared_post_id') = (to_jsonb(old) - 'shared_post_id') then
    return new;
  end if;

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
     or new.mentions is distinct from old.mentions
     or new.shared_post_id is distinct from old.shared_post_id then
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
