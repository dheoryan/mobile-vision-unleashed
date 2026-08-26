-- Venture party-chat coordination: arrival states, one pinned host update,
-- and server-authored system messages for material Venture changes.
--
-- RED under CHANGE_PROTOCOL: this adds authenticated table access and replaces
-- the venture_messages INSERT policy. Apply manually in Lovable SQL only after
-- review. The application degrades to the existing chat until this is applied.

create table if not exists public.venture_participant_statuses (
  venture_id uuid not null references public.ventures(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('on_my_way', 'arrived', 'running_late', 'cant_make_it')),
  updated_at timestamptz not null default now(),
  primary key (venture_id, user_id)
);

create index if not exists venture_participant_statuses_venture_updated_idx
  on public.venture_participant_statuses (venture_id, updated_at desc);

create table if not exists public.venture_announcements (
  venture_id uuid primary key references public.ventures(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 280),
  updated_at timestamptz not null default now()
);

alter table public.venture_participant_statuses enable row level security;
alter table public.venture_announcements enable row level security;

drop policy if exists "Venture members read arrival states" on public.venture_participant_statuses;
create policy "Venture members read arrival states"
on public.venture_participant_statuses for select to authenticated
using (
  public.is_verified_adult(auth.uid())
  and public.is_venture_member(venture_id, auth.uid())
);

drop policy if exists "Members set own arrival state" on public.venture_participant_statuses;
create policy "Members set own arrival state"
on public.venture_participant_statuses for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_verified_adult(auth.uid())
  and public.is_venture_member(venture_id, auth.uid())
  and public.is_venture_chat_open(venture_id)
);

drop policy if exists "Members update own arrival state" on public.venture_participant_statuses;
create policy "Members update own arrival state"
on public.venture_participant_statuses for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_verified_adult(auth.uid())
  and public.is_venture_member(venture_id, auth.uid())
  and public.is_venture_chat_open(venture_id)
);

drop policy if exists "Members clear own arrival state" on public.venture_participant_statuses;
create policy "Members clear own arrival state"
on public.venture_participant_statuses for delete to authenticated
using (
  user_id = auth.uid()
  and public.is_venture_chat_open(venture_id)
);

drop policy if exists "Venture members read host update" on public.venture_announcements;
create policy "Venture members read host update"
on public.venture_announcements for select to authenticated
using (
  public.is_verified_adult(auth.uid())
  and public.is_venture_member(venture_id, auth.uid())
);

drop policy if exists "Hosts pin Venture update" on public.venture_announcements;
create policy "Hosts pin Venture update"
on public.venture_announcements for insert to authenticated
with check (
  author_id = auth.uid()
  and public.is_verified_adult(auth.uid())
  and public.is_venture_host(venture_id, auth.uid())
  and public.is_venture_chat_open(venture_id)
);

drop policy if exists "Hosts edit Venture update" on public.venture_announcements;
create policy "Hosts edit Venture update"
on public.venture_announcements for update to authenticated
using (author_id = auth.uid() and public.is_venture_host(venture_id, auth.uid()))
with check (
  author_id = auth.uid()
  and public.is_verified_adult(auth.uid())
  and public.is_venture_host(venture_id, auth.uid())
  and public.is_venture_chat_open(venture_id)
);

drop policy if exists "Hosts remove Venture update" on public.venture_announcements;
create policy "Hosts remove Venture update"
on public.venture_announcements for delete to authenticated
using (
  author_id = auth.uid()
  and public.is_venture_host(venture_id, auth.uid())
  and public.is_venture_chat_open(venture_id)
);

grant select, insert, update, delete on public.venture_participant_statuses to authenticated;
grant select, insert, update, delete on public.venture_announcements to authenticated;
grant all on public.venture_participant_statuses, public.venture_announcements to service_role;

alter table public.venture_messages
  add column if not exists message_kind text not null default 'user',
  add column if not exists system_event text,
  add column if not exists system_key text;

alter table public.venture_messages drop constraint if exists venture_messages_kind_check;
alter table public.venture_messages
  add constraint venture_messages_kind_check check (message_kind in ('user', 'system'));

alter table public.venture_messages drop constraint if exists venture_messages_system_shape;
alter table public.venture_messages
  add constraint venture_messages_system_shape check (
    (message_kind = 'user' and system_event is null and system_key is null)
    or (
      message_kind = 'system'
      and system_event is not null
      and attachment_url is null
      and attachment_type is null
      and reply_to_id is null
    )
  );

create unique index if not exists venture_messages_system_key_unique
  on public.venture_messages (venture_id, system_key)
  where system_key is not null;

drop policy if exists "Venture members send party chat" on public.venture_messages;
create policy "Venture members send party chat"
on public.venture_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and message_kind = 'user'
  and system_event is null
  and system_key is null
  and public.is_venture_member(venture_id, auth.uid())
  and public.is_venture_chat_open(venture_id)
);

create or replace function public.touch_venture_coordination_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_venture_coordination_updated_at()
  from public, anon, authenticated;

drop trigger if exists touch_venture_arrival_updated_at on public.venture_participant_statuses;
create trigger touch_venture_arrival_updated_at
before update on public.venture_participant_statuses
for each row execute function public.touch_venture_coordination_updated_at();

drop trigger if exists touch_venture_announcement_updated_at on public.venture_announcements;
create trigger touch_venture_announcement_updated_at
before update on public.venture_announcements
for each row execute function public.touch_venture_coordination_updated_at();

create or replace function public.reject_blocked_venture_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.content_is_blocked(new.content) then
    raise exception 'Content violates community safety filters';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_blocked_venture_announcement()
  from public, anon, authenticated;

drop trigger if exists reject_blocked_text_before_write on public.venture_announcements;
create trigger reject_blocked_text_before_write
before insert or update of content on public.venture_announcements
for each row execute function public.reject_blocked_venture_announcement();

create or replace function public.emit_venture_system_message(
  _venture_id uuid,
  _sender_id uuid,
  _event text,
  _content text,
  _system_key text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _venture_id is null or _sender_id is null or nullif(btrim(_content), '') is null then
    return;
  end if;

  insert into public.venture_messages (
    venture_id,
    sender_id,
    content,
    message_kind,
    system_event,
    system_key
  ) values (
    _venture_id,
    _sender_id,
    left(btrim(_content), 2000),
    'system',
    left(_event, 60),
    _system_key
  )
  on conflict (venture_id, system_key) where system_key is not null do nothing;
end;
$$;

revoke all on function public.emit_venture_system_message(uuid, uuid, text, text, text)
  from public, anon, authenticated;

create or replace function public.announce_venture_arrival_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  target_venture uuid;
  actor_name text;
  state_label text;
begin
  if tg_op = 'DELETE' then
    actor_id := old.user_id;
    target_venture := old.venture_id;
  else
    actor_id := new.user_id;
    target_venture := new.venture_id;
  end if;

  select coalesce(nullif(btrim(display_name), ''), nullif(handle, ''), 'A participant')
    into actor_name
  from public.profiles
  where id = actor_id;

  if tg_op = 'DELETE' then
    perform public.emit_venture_system_message(
      target_venture, actor_id, 'arrival_status', actor_name || ' cleared their arrival update.'
    );
    return old;
  end if;

  state_label := case new.status
    when 'on_my_way' then 'is on the way.'
    when 'arrived' then 'has arrived.'
    when 'running_late' then 'is running late.'
    when 'cant_make_it' then 'can no longer make it.'
  end;

  if tg_op = 'INSERT' or old.status is distinct from new.status then
    perform public.emit_venture_system_message(
      target_venture, actor_id, 'arrival_status', actor_name || ' ' || state_label
    );
  end if;
  return new;
end;
$$;

revoke all on function public.announce_venture_arrival_state()
  from public, anon, authenticated;

drop trigger if exists announce_venture_arrival_state on public.venture_participant_statuses;
create trigger announce_venture_arrival_state
after insert or update of status or delete on public.venture_participant_statuses
for each row execute function public.announce_venture_arrival_state();

create or replace function public.announce_venture_application_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;

  select coalesce(nullif(btrim(display_name), ''), nullif(handle, ''), 'A participant')
    into actor_name
  from public.profiles
  where id = new.applicant_id;

  if new.status = 'accepted' then
    perform public.emit_venture_system_message(
      new.venture_id, new.applicant_id, 'participant_joined', actor_name || ' joined the Venture.'
    );
  elsif tg_op = 'UPDATE' and old.status = 'accepted' and new.status <> 'accepted' then
    perform public.emit_venture_system_message(
      new.venture_id, new.applicant_id, 'participant_left', actor_name || ' left the Venture.'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.announce_venture_application_change()
  from public, anon, authenticated;

drop trigger if exists announce_venture_application_change on public.venture_applications;
create trigger announce_venture_application_change
after insert or update of status on public.venture_applications
for each row execute function public.announce_venture_application_change();

create or replace function public.announce_venture_details_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.starts_at is distinct from new.starts_at
    or old.ends_at is distinct from new.ends_at
    or old.venue_tz is distinct from new.venue_tz then
    perform public.emit_venture_system_message(
      new.id, new.user_id, 'schedule_updated', 'The host updated the Venture time.'
    );
  end if;

  if old.venue_place_id is distinct from new.venue_place_id then
    perform public.emit_venture_system_message(
      new.id, new.user_id, 'venue_updated', 'The host updated the meeting place.'
    );
  end if;

  if coalesce(old.status, 'open') <> 'closed' and coalesce(new.status, 'open') = 'closed' then
    perform public.emit_venture_system_message(
      new.id, new.user_id, 'venture_closed', 'This Venture has ended. The room is now a memory.'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.announce_venture_details_change()
  from public, anon, authenticated;

drop trigger if exists announce_venture_details_change on public.ventures;
create trigger announce_venture_details_change
after update of starts_at, ends_at, venue_tz, venue_place_id, status on public.ventures
for each row execute function public.announce_venture_details_change();

create or replace function public.announce_private_venue_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_venture uuid;
  host_id uuid;
begin
  target_venture := case when tg_op = 'DELETE' then old.venture_id else new.venture_id end;
  select user_id into host_id from public.ventures where id = target_venture;
  if host_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'DELETE' then
    perform public.emit_venture_system_message(
      target_venture, host_id, 'arrival_details_updated', 'The host removed the arrival instructions.'
    );
  elsif tg_op = 'INSERT' or old.arrival_details is distinct from new.arrival_details then
    perform public.emit_venture_system_message(
      target_venture, host_id, 'arrival_details_updated', 'The host updated the arrival instructions.'
    );
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function public.announce_private_venue_change()
  from public, anon, authenticated;

drop trigger if exists announce_private_venue_change on public.venture_venues;
create trigger announce_private_venue_change
after insert or update of arrival_details or delete on public.venture_venues
for each row execute function public.announce_private_venue_change();

create or replace function public.announce_venture_pin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_venture uuid;
  actor_id uuid;
begin
  if tg_op = 'DELETE' then
    target_venture := old.venture_id;
    actor_id := old.author_id;
  else
    target_venture := new.venture_id;
    actor_id := new.author_id;
  end if;
  if tg_op = 'DELETE' then
    perform public.emit_venture_system_message(
      target_venture, actor_id, 'announcement_removed', 'The host removed the pinned update.'
    );
    return old;
  end if;

  if tg_op = 'INSERT' or old.content is distinct from new.content then
    perform public.emit_venture_system_message(
      target_venture, actor_id, 'announcement_updated', 'The host pinned an update.'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.announce_venture_pin_change()
  from public, anon, authenticated;

drop trigger if exists announce_venture_pin_change on public.venture_announcements;
create trigger announce_venture_pin_change
after insert or update of content or delete on public.venture_announcements
for each row execute function public.announce_venture_pin_change();

-- System messages are useful inside the room but must not fan out as a push
-- every time somebody changes an arrival chip or the host edits a detail.
create or replace function public.notify_on_venture_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
begin
  if coalesce(new.message_kind, 'user') <> 'user' then return null; end if;

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

revoke all on function public.notify_on_venture_message()
  from public, anon, authenticated;

comment on table public.venture_participant_statuses is
  'Ephemeral member-authored arrival coordination for an active Venture.';
comment on table public.venture_announcements is
  'At most one host-authored update pinned above a Venture party chat.';
comment on column public.venture_messages.message_kind is
  'User messages are client-authored; system messages are emitted only by database triggers.';
