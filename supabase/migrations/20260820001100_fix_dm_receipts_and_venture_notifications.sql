-- Durable DM read receipts and semantically correct Venture notifications.

alter table public.messages
  add column if not exists read_at timestamptz;

create index if not exists idx_messages_recipient_unread
  on public.messages (recipient_id, sender_id, created_at desc)
  where read_at is null;

drop policy if exists "Recipients mark messages read" on public.messages;
create policy "Recipients mark messages read"
on public.messages
for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid() and read_at is not null);

create or replace function public.guard_message_read_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is distinct from old.recipient_id then
    raise exception 'Only the recipient can mark a message read';
  end if;

  if new.id is distinct from old.id
    or new.sender_id is distinct from old.sender_id
    or new.recipient_id is distinct from old.recipient_id
    or new.content is distinct from old.content
    or new.created_at is distinct from old.created_at then
    raise exception 'Message content is immutable';
  end if;

  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'A read message cannot be marked unread or re-timestamped';
  end if;

  if new.read_at is null then
    raise exception 'read_at must be set';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_message_read_update on public.messages;
create trigger guard_message_read_update
before update on public.messages
for each row execute function public.guard_message_read_update();

revoke all on function public.guard_message_read_update() from public, anon, authenticated;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array[
    'like', 'comment', 'reply', 'mention', 'follow', 'message', 'new_post',
    'venture_apply', 'venture_invite', 'venture_accept', 'venture_message', 'tribe_join'
  ]));

create or replace function public.notify_on_venture_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  host_id uuid;
  venture_title text;
begin
  select v.user_id, v.title into host_id, venture_title
  from public.ventures v
  where v.id = new.venture_id;

  if host_id is null then
    return null;
  end if;

  if tg_op = 'INSERT' and new.status = 'pending' and host_id <> new.applicant_id then
    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (host_id, new.applicant_id, 'venture_apply', new.venture_id,
      left(coalesce(nullif(new.message, ''), venture_title), 140));
  elsif tg_op = 'INSERT' and new.status = 'invited' and host_id <> new.applicant_id then
    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (new.applicant_id, host_id, 'venture_invite', new.venture_id,
      left(coalesce(venture_title, 'Venture'), 140));
  elsif tg_op = 'UPDATE'
    and old.status is distinct from new.status
    and new.status = 'invited'
    and host_id <> new.applicant_id then
    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (new.applicant_id, host_id, 'venture_invite', new.venture_id,
      left(coalesce(venture_title, 'Venture'), 140));
  elsif tg_op = 'UPDATE'
    and old.status is distinct from new.status
    and new.status = 'accepted'
    and host_id <> new.applicant_id then
    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (new.applicant_id, host_id, 'venture_accept', new.venture_id,
      left(coalesce(venture_title, 'Your Venture'), 140));
  end if;

  return null;
end;
$$;

create or replace function public.notify_on_venture_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
begin
  for recipient in
    select distinct uid from (
      select user_id as uid from public.ventures where id = new.venture_id
      union
      select applicant_id as uid
      from public.venture_applications
      where venture_id = new.venture_id and status = 'accepted'
    ) members
    where uid <> new.sender_id
  loop
    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (recipient, new.sender_id, 'venture_message', new.venture_id, left(new.content, 140));
  end loop;

  return null;
end;
$$;

revoke all on function public.notify_on_venture_application() from public, anon, authenticated;
revoke all on function public.notify_on_venture_message() from public, anon, authenticated;
