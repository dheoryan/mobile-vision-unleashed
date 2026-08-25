-- Give direct messages and Venture party chat the same durable capabilities as
-- Tribe chat: structured replies, private image attachments, and normalized
-- reactions. This is RED under CHANGE_PROTOCOL and must be applied manually.

alter table public.messages
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null;

alter table public.messages alter column content drop not null;
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages drop constraint if exists messages_has_content_or_attachment;
alter table public.messages
  add constraint messages_has_content_or_attachment check (
    (content is not null and char_length(btrim(content)) between 1 and 2000)
    or (attachment_url is not null and attachment_type = 'image')
  );
alter table public.messages drop constraint if exists messages_attachment_shape;
alter table public.messages
  add constraint messages_attachment_shape check (
    (attachment_url is null and attachment_type is null)
    or (attachment_url is not null and attachment_type = 'image')
  );

create index if not exists messages_reply_to_idx on public.messages(reply_to_id);

alter table public.venture_messages
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,
  add column if not exists reply_to_id uuid references public.venture_messages(id) on delete set null;

alter table public.venture_messages alter column content drop not null;
alter table public.venture_messages drop constraint if exists venture_messages_content_check;
alter table public.venture_messages drop constraint if exists venture_messages_has_content_or_attachment;
alter table public.venture_messages
  add constraint venture_messages_has_content_or_attachment check (
    (content is not null and char_length(btrim(content)) between 1 and 2000)
    or (attachment_url is not null and attachment_type = 'image')
  );
alter table public.venture_messages drop constraint if exists venture_messages_attachment_shape;
alter table public.venture_messages
  add constraint venture_messages_attachment_shape check (
    (attachment_url is null and attachment_type is null)
    or (attachment_url is not null and attachment_type = 'image')
  );

create index if not exists venture_messages_reply_to_idx
  on public.venture_messages(reply_to_id);

create or replace function public.enforce_chat_reply_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_sender uuid;
  target_recipient uuid;
  target_venture uuid;
begin
  if new.reply_to_id is null then return new; end if;

  if tg_table_name = 'messages' then
    select sender_id, recipient_id into target_sender, target_recipient
    from public.messages where id = new.reply_to_id;
    if not found or not (
      (target_sender = new.sender_id and target_recipient = new.recipient_id)
      or (target_sender = new.recipient_id and target_recipient = new.sender_id)
    ) then
      raise exception 'Reply target is outside this conversation';
    end if;
  elsif tg_table_name = 'venture_messages' then
    select venture_id into target_venture
    from public.venture_messages where id = new.reply_to_id;
    if not found or target_venture <> new.venture_id then
      raise exception 'Reply target is outside this Venture';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_chat_reply_scope() from public, anon, authenticated;

drop trigger if exists enforce_chat_reply_scope on public.messages;
create trigger enforce_chat_reply_scope
before insert or update of reply_to_id on public.messages
for each row execute function public.enforce_chat_reply_scope();

drop trigger if exists enforce_chat_reply_scope on public.venture_messages;
create trigger enforce_chat_reply_scope
before insert or update of reply_to_id on public.venture_messages
for each row execute function public.enforce_chat_reply_scope();

create table if not exists public.chat_message_reactions (
  channel_kind text not null check (channel_kind in ('dm', 'venture')),
  message_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('heart', 'laugh', 'support')),
  created_at timestamptz not null default now(),
  primary key (channel_kind, message_id, user_id, reaction)
);

create index if not exists chat_message_reactions_message_idx
  on public.chat_message_reactions(channel_kind, message_id, reaction);

create or replace function public.can_access_chat_message(
  _channel_kind text,
  _message_id uuid,
  _user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case _channel_kind
    when 'dm' then exists (
      select 1 from public.messages m
      where m.id = _message_id
        and _user_id in (m.sender_id, m.recipient_id)
    )
    when 'venture' then exists (
      select 1 from public.venture_messages vm
      where vm.id = _message_id
        and public.is_venture_member(vm.venture_id, _user_id)
    )
    else false
  end
$$;

revoke all on function public.can_access_chat_message(text, uuid, uuid) from public, anon;
grant execute on function public.can_access_chat_message(text, uuid, uuid) to authenticated;

create or replace function public.enforce_chat_message_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_chat_message(new.channel_kind, new.message_id, new.user_id) then
    raise exception 'Message not found or unavailable';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_chat_message_reaction() from public, anon, authenticated;

drop trigger if exists enforce_chat_message_reaction on public.chat_message_reactions;
create trigger enforce_chat_message_reaction
before insert or update on public.chat_message_reactions
for each row execute function public.enforce_chat_message_reaction();

alter table public.chat_message_reactions enable row level security;

drop policy if exists "Participants read chat reactions" on public.chat_message_reactions;
create policy "Participants read chat reactions"
on public.chat_message_reactions for select to authenticated
using (
  public.is_verified_adult(auth.uid())
  and public.can_access_chat_message(channel_kind, message_id, auth.uid())
);

drop policy if exists "Participants add own chat reactions" on public.chat_message_reactions;
create policy "Participants add own chat reactions"
on public.chat_message_reactions for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_verified_adult(auth.uid())
  and public.can_access_chat_message(channel_kind, message_id, auth.uid())
);

drop policy if exists "Participants remove own chat reactions" on public.chat_message_reactions;
create policy "Participants remove own chat reactions"
on public.chat_message_reactions for delete to authenticated
using (user_id = auth.uid());

drop trigger if exists require_adult_before_write on public.chat_message_reactions;
create trigger require_adult_before_write
before insert or update on public.chat_message_reactions
for each row execute function public.require_verified_adult();

grant select, insert, delete on public.chat_message_reactions to authenticated;

create or replace function public.delete_chat_message_reactions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.chat_message_reactions
  where channel_kind = tg_argv[0] and message_id = old.id;
  return old;
end;
$$;

revoke all on function public.delete_chat_message_reactions() from public, anon, authenticated;

drop trigger if exists delete_dm_reactions on public.messages;
create trigger delete_dm_reactions
after delete on public.messages
for each row execute function public.delete_chat_message_reactions('dm');

drop trigger if exists delete_venture_reactions on public.venture_messages;
create trigger delete_venture_reactions
after delete on public.venture_messages
for each row execute function public.delete_chat_message_reactions('venture');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_read_chat_attachment(_path text, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.messages m
    where m.attachment_url = _path
      and _user_id in (m.sender_id, m.recipient_id)
  ) or exists (
    select 1 from public.venture_messages vm
    where vm.attachment_url = _path
      and public.is_venture_member(vm.venture_id, _user_id)
  )
$$;

revoke all on function public.can_read_chat_attachment(text, uuid) from public, anon;
grant execute on function public.can_read_chat_attachment(text, uuid) to authenticated;

create or replace function public.chat_attachment_is_in_use(_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.messages where attachment_url = _path
  ) or exists (
    select 1 from public.venture_messages where attachment_url = _path
  )
$$;

revoke all on function public.chat_attachment_is_in_use(text) from public, anon;
grant execute on function public.chat_attachment_is_in_use(text) to authenticated;

drop policy if exists "Participants read chat attachments" on storage.objects;
create policy "Participants read chat attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-attachments'
  and public.is_verified_adult(auth.uid())
  and public.can_read_chat_attachment(name, auth.uid())
);

drop policy if exists "Users upload own chat attachments" on storage.objects;
create policy "Users upload own chat attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_verified_adult(auth.uid())
);

drop policy if exists "Users delete own unused chat attachments" on storage.objects;
create policy "Users delete own unused chat attachments"
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not public.chat_attachment_is_in_use(name)
);

comment on table public.chat_message_reactions is
  'Normalized Love, Funny, and Support reactions shared by DM and Venture chat.';
comment on column public.messages.attachment_url is
  'Object path in the private chat-attachments bucket.';
comment on column public.venture_messages.attachment_url is
  'Object path in the private chat-attachments bucket.';
