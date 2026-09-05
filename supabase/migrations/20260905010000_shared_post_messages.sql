-- Share system, phase 1: let a post be forwarded into a DM or Tribe chat as
-- its own message, rendered as a rich preview card (author, snippet, image)
-- that opens the post on tap - same concept as `quoted_post_id` on posts
-- (20260830020000), just pointed at a chat message instead of another post.
--
-- Deliberately a bare nullable FK with `on delete set null`, no new CHECK
-- constraints and no RLS changes:
--   - `on delete set null` is what makes a shared-post message survive the
--     original post being deleted (renders "post no longer available" from
--     the client, exactly like a dangling quoted_post_id already does).
--   - The app layer always writes real, non-empty `content` for a shared-post
--     message (the sender's caption, or a fallback string) - so it already
--     satisfies every existing "has content or attachment" constraint on
--     both tables without needing to touch them. That sidesteps re-opening
--     tribe_messages' check constraints at all, which is exactly the kind of
--     guess this session got burned on twice already (see
--     20260904020000/20260904030000) - not touching them is the safe move.
--   - INSERT/SELECT policies on both tables are already keyed on
--     sender/participant identity, not on which columns are populated, so a
--     new decorate-only column needs no policy change (same reasoning as
--     `reply_to_id` before it).
--
-- Venture chat is intentionally excluded - the confirmed v1 scope for share
-- targets is DMs and Tribes only.

alter table public.messages
  add column if not exists shared_post_id uuid references public.posts(id) on delete set null;
comment on column public.messages.shared_post_id is
  'Post shared into this DM as a rich preview card. Null once the shared post is deleted - the card then renders unavailable, same as a quoted post.';

alter table public.tribe_messages
  add column if not exists shared_post_id uuid references public.posts(id) on delete set null;
comment on column public.tribe_messages.shared_post_id is
  'Post shared into this Tribe chat as a rich preview card. Null once the shared post is deleted - the card then renders unavailable, same as a quoted post.';

create index if not exists messages_shared_post_idx
  on public.messages(shared_post_id) where shared_post_id is not null;
create index if not exists tribe_messages_shared_post_idx
  on public.tribe_messages(shared_post_id) where shared_post_id is not null;

-- Add shared_post_id to both edit triggers' immutable-column list - same
-- treatment as reply_to_id: settable at insert, locked forever after.

create or replace function public.enforce_dm_message_edit_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
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
