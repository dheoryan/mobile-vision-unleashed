-- EDIT + UNSEND for all three chat surfaces (DM, Tribe chat, Venture chat).
--
-- Same shape already proven for comments (20260901020000): add
-- edited_at/deleted_at, a sender-only UPDATE policy, and a before-update
-- trigger that stamps edited_at and locks every other column. Three tables
-- get three separate trigger functions rather than one shared one, matching
-- how this project already keeps one enforce_*_edit_fields per table
-- (comments, posts, ventures) instead of a generic version - each table's
-- immutable-column set is different (room_kind/room_metadata here,
-- message_kind/system_event/system_key there, recipient_id/read_at over
-- there), and a shared function would have to know about all of them.
--
-- Unsend is UPDATE, not DELETE - it sets deleted_at and wipes content and
-- the attachment, leaving the row (and its id) standing so replies pointing
-- at it via reply_to_id keep resolving to a real row instead of dangling.
-- The client renders a "Message removed" tombstone wherever deleted_at is
-- set, same as WhatsApp/Telegram/iMessage.
--
-- ---------- security note ----------
-- `messages` already has an UPDATE policy for RECIPIENTS marking read_at.
-- Postgres combines multiple permissive UPDATE policies with OR, and RLS
-- has no column-level granularity - so without an explicit check, a
-- recipient's own legitimately-granted UPDATE access could be used to edit
-- or unsend a message they didn't send, just by including content/
-- deleted_at in their read-receipt call. Each trigger below explicitly
-- requires auth.uid() = old.sender_id before it will touch
-- content/deleted_at/edited_at, independent of which RLS policy admitted
-- the UPDATE - the trigger is the real gate here, not the policy.

-- ---------- 1. columns ----------

alter table public.messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;
comment on column public.messages.edited_at is
  'Set by enforce_dm_message_edit_fields whenever content actually changed. Null means never edited.';
comment on column public.messages.deleted_at is
  'Set when the sender unsends this message. content/attachment_url/attachment_type are wiped at the same time; the row stays so reply_to_id references keep resolving.';

alter table public.tribe_messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;
comment on column public.tribe_messages.edited_at is
  'Set by enforce_tribe_message_edit_fields whenever content actually changed. Null means never edited. Always null on structured Room items (room_kind is not null) - those cannot be edited via this path.';
comment on column public.tribe_messages.deleted_at is
  'Set when the sender unsends this message. content is cleared to '''' (the column is not null) and the attachment is wiped; the row stays so reply_to_id references keep resolving.';

alter table public.venture_messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;
comment on column public.venture_messages.edited_at is
  'Set by enforce_venture_message_edit_fields whenever content actually changed. Null means never edited. Always null on system messages (message_kind <> ''user'') - those cannot be edited via this path.';
comment on column public.venture_messages.deleted_at is
  'Set when the sender unsends this message. content/attachment_url/attachment_type are wiped at the same time; the row stays so reply_to_id references keep resolving.';

-- All three tables already enforce "a message must have content or an
-- attachment" (chat_capability_parity for messages/venture_messages,
-- create_tribe_messages for tribe_messages) - unsend legitimately empties
-- both, so each constraint needs the same widening: also fine once
-- deleted_at is set.

alter table public.messages drop constraint if exists messages_has_content_or_attachment;
alter table public.messages add constraint messages_has_content_or_attachment check (
  deleted_at is not null
  or (content is not null and char_length(btrim(content)) between 1 and 2000)
  or (attachment_url is not null and attachment_type = 'image')
);

alter table public.tribe_messages drop constraint if exists tribe_messages_has_content_or_attachment;
alter table public.tribe_messages add constraint tribe_messages_has_content_or_attachment check (
  deleted_at is not null
  or nullif(btrim(coalesce(content, '')), '') is not null
  or attachment_url is not null
);

alter table public.venture_messages drop constraint if exists venture_messages_has_content_or_attachment;
alter table public.venture_messages add constraint venture_messages_has_content_or_attachment check (
  deleted_at is not null
  or (content is not null and char_length(btrim(content)) between 1 and 2000)
  or (attachment_url is not null and attachment_type = 'image')
);

-- ---------- 2. messages (DM) ----------
--
-- `messages` already carried a before-update trigger, guard_message_read_
-- update (20260820190349), written back when the only legitimate UPDATE was
-- a recipient marking read_at - it unconditionally required
-- auth.uid() = recipient_id and unconditionally rejected any content
-- change, both of which would reject a sender's own edit/unsend outright.
-- Retired in favor of one consolidated trigger that still enforces every
-- one of its original read-receipt rules (recipient-only, forward-only,
-- never re-timestamped once read) alongside the new sender-edit path,
-- rather than layering two triggers that would fight over the same row.

drop trigger if exists guard_message_read_update on public.messages;
drop function if exists public.guard_message_read_update();

drop policy if exists "Senders edit or unsend own messages" on public.messages;
create policy "Senders edit or unsend own messages"
on public.messages
for update
to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

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
     or new.reply_to_id is distinct from old.reply_to_id then
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

drop trigger if exists trg_enforce_dm_message_edit_fields on public.messages;
create trigger trg_enforce_dm_message_edit_fields
before update on public.messages
for each row execute function public.enforce_dm_message_edit_fields();

-- ---------- 3. tribe_messages ----------

drop policy if exists "Senders edit or unsend own tribe messages" on public.tribe_messages;
create policy "Senders edit or unsend own tribe messages"
on public.tribe_messages
for update
to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

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
    new.content := '';
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

drop trigger if exists trg_enforce_tribe_message_edit_fields on public.tribe_messages;
create trigger trg_enforce_tribe_message_edit_fields
before update on public.tribe_messages
for each row execute function public.enforce_tribe_message_edit_fields();

-- ---------- 4. venture_messages ----------

drop policy if exists "Senders edit or unsend own venture messages" on public.venture_messages;
create policy "Senders edit or unsend own venture messages"
on public.venture_messages
for update
to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

create or replace function public.enforce_venture_message_edit_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if old.message_kind is distinct from 'user' then
    raise exception 'system messages cannot be edited or unsent';
  end if;
  if auth.uid() is distinct from old.sender_id then
    raise exception 'only the sender may edit or unsend a message';
  end if;
  if old.deleted_at is not null then
    raise exception 'message has already been removed';
  end if;

  if new.sender_id is distinct from old.sender_id
     or new.venture_id is distinct from old.venture_id
     or new.created_at is distinct from old.created_at
     or new.reply_to_id is distinct from old.reply_to_id
     or new.message_kind is distinct from old.message_kind
     or new.system_event is distinct from old.system_event
     or new.system_key is distinct from old.system_key
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

drop trigger if exists trg_enforce_venture_message_edit_fields on public.venture_messages;
create trigger trg_enforce_venture_message_edit_fields
before update on public.venture_messages
for each row execute function public.enforce_venture_message_edit_fields();
