-- Open-party Ventures: hosts create party listings, explorers apply, accepted members chat.

alter table public.ventures
  add column if not exists title text not null default 'Open Venture',
  add column if not exists note text not null default '',
  add column if not exists max_slots int not null default 4,
  add column if not exists filled_slots int not null default 1,
  add column if not exists status text not null default 'open',
  add column if not exists closed_at timestamp with time zone;

do $$
begin
  begin
    alter table public.ventures
      add constraint ventures_scope_check check (scope in ('mine', 'all'));
  exception when duplicate_object then null; end;

  begin
    alter table public.ventures
      add constraint ventures_status_check check (status in ('open', 'full', 'closed'));
  exception when duplicate_object then null; end;

  begin
    alter table public.ventures
      add constraint ventures_max_slots_check check (max_slots between 2 and 20);
  exception when duplicate_object then null; end;

  begin
    alter table public.ventures
      add constraint ventures_filled_slots_check check (filled_slots between 1 and max_slots);
  exception when duplicate_object then null; end;
end $$;

create index if not exists ventures_status_created_idx on public.ventures(status, created_at desc);

create table if not exists public.venture_applications (
  id uuid primary key default gen_random_uuid(),
  venture_id uuid not null references public.ventures(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'invited')),
  message text not null default '',
  created_at timestamp with time zone not null default now(),
  decided_at timestamp with time zone,
  unique (venture_id, applicant_id)
);

create index if not exists venture_applications_venture_idx
  on public.venture_applications(venture_id, status, created_at desc);
create index if not exists venture_applications_applicant_idx
  on public.venture_applications(applicant_id, created_at desc);

create table if not exists public.venture_messages (
  id uuid primary key default gen_random_uuid(),
  venture_id uuid not null references public.ventures(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamp with time zone not null default now()
);

create index if not exists venture_messages_venture_time_idx
  on public.venture_messages(venture_id, created_at);

alter table public.venture_applications enable row level security;
alter table public.venture_messages enable row level security;

create or replace function public.is_venture_host(_venture_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ventures v
    where v.id = _venture_id and v.user_id = _user_id
  )
$$;

create or replace function public.has_venture_application(_venture_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.venture_applications va
    where va.venture_id = _venture_id and va.applicant_id = _user_id
  )
$$;

create or replace function public.is_venture_member(_venture_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_venture_host(_venture_id, _user_id)
    or exists (
      select 1 from public.venture_applications va
      where va.venture_id = _venture_id
        and va.applicant_id = _user_id
        and va.status = 'accepted'
    )
$$;

create or replace function public.is_venture_joinable(_venture_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ventures v
    where v.id = _venture_id
      and v.status = 'open'
      and v.filled_slots < v.max_slots
  )
$$;

drop policy if exists "Users see their own ventures" on public.ventures;
drop policy if exists "Users create their own ventures" on public.ventures;
drop policy if exists "Users end their own ventures" on public.ventures;

create policy "Users read open or related ventures"
on public.ventures for select to authenticated
using (
  user_id = auth.uid()
  or status = 'open'
  or public.has_venture_application(id, auth.uid())
);

create policy "Users create hosted ventures"
on public.ventures for insert to authenticated
with check (user_id = auth.uid());

create policy "Hosts update their ventures"
on public.ventures for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Applicants and hosts read applications" on public.venture_applications;
drop policy if exists "Users apply to open ventures" on public.venture_applications;
drop policy if exists "Hosts create venture invites" on public.venture_applications;
drop policy if exists "Hosts decide venture applications" on public.venture_applications;
drop policy if exists "Applicants cancel own applications" on public.venture_applications;
drop policy if exists "Applicants respond to own venture invites" on public.venture_applications;

create policy "Applicants and hosts read applications"
on public.venture_applications for select to authenticated
using (
  applicant_id = auth.uid()
  or public.is_venture_host(venture_id, auth.uid())
);

create policy "Users apply to open ventures"
on public.venture_applications for insert to authenticated
with check (
  applicant_id = auth.uid()
  and status = 'pending'
  and not public.is_venture_host(venture_id, auth.uid())
  and public.is_venture_joinable(venture_id)
);

create policy "Hosts create venture invites"
on public.venture_applications for insert to authenticated
with check (
  status = 'invited'
  and applicant_id <> auth.uid()
  and public.is_venture_host(venture_id, auth.uid())
  and public.is_venture_joinable(venture_id)
);

create policy "Hosts decide venture applications"
on public.venture_applications for update to authenticated
using (public.is_venture_host(venture_id, auth.uid()))
with check (public.is_venture_host(venture_id, auth.uid()));

create policy "Applicants cancel own applications"
on public.venture_applications for update to authenticated
using (applicant_id = auth.uid())
with check (applicant_id = auth.uid() and status = 'cancelled');

create policy "Applicants respond to own venture invites"
on public.venture_applications for update to authenticated
using (applicant_id = auth.uid() and status = 'invited')
with check (applicant_id = auth.uid() and status in ('accepted', 'declined'));

drop policy if exists "Venture members read party chat" on public.venture_messages;
drop policy if exists "Venture members send party chat" on public.venture_messages;

create policy "Venture members read party chat"
on public.venture_messages for select to authenticated
using (public.is_venture_member(venture_id, auth.uid()));

create policy "Venture members send party chat"
on public.venture_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.is_venture_member(venture_id, auth.uid())
);

alter table public.notifications
  add column if not exists venture_id uuid;

create index if not exists idx_notifications_venture on public.notifications(venture_id);

create or replace function public.sync_venture_slots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_venture uuid;
  accepted_count int;
  next_filled int;
  max_count int;
  current_status text;
begin
  target_venture := coalesce(new.venture_id, old.venture_id);

  select count(*) into accepted_count
  from public.venture_applications
  where venture_id = target_venture and status = 'accepted';

  select max_slots, status into max_count, current_status
  from public.ventures
  where id = target_venture;

  next_filled := least(1 + accepted_count, max_count);

  update public.ventures
  set
    filled_slots = next_filled,
    status = case
      when current_status = 'closed' then 'closed'
      when next_filled >= max_count then 'full'
      else 'open'
    end
  where id = target_venture;

  return null;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_sync_venture_slots'
      and tgrelid = 'public.venture_applications'::regclass
  ) then
    create trigger trg_sync_venture_slots
    after insert or update or delete on public.venture_applications
    for each row execute function public.sync_venture_slots();
  end if;
end $$;

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
    values (host_id, new.applicant_id, 'message', new.venture_id, left(coalesce(nullif(new.message, ''), venture_title), 140));
  elsif tg_op = 'INSERT' and new.status = 'invited' and host_id <> new.applicant_id then
    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (new.applicant_id, host_id, 'message', new.venture_id, left('Invite: ' || coalesce(venture_title, 'Venture'), 140));
  elsif tg_op = 'UPDATE'
    and old.status is distinct from new.status
    and new.status = 'invited'
    and host_id <> new.applicant_id then
    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (new.applicant_id, host_id, 'message', new.venture_id, left('Invite: ' || coalesce(venture_title, 'Venture'), 140));
  elsif tg_op = 'UPDATE'
    and old.status is distinct from new.status
    and new.status = 'accepted'
    and host_id <> new.applicant_id then
    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (new.applicant_id, host_id, 'message', new.venture_id, left(coalesce(venture_title, 'Your Venture'), 140));
  end if;

  return null;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_notify_on_venture_application'
      and tgrelid = 'public.venture_applications'::regclass
  ) then
    create trigger trg_notify_on_venture_application
    after insert or update on public.venture_applications
    for each row execute function public.notify_on_venture_application();
  end if;
end $$;

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
    values (recipient, new.sender_id, 'message', new.venture_id, left(new.content, 140));
  end loop;

  return null;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_notify_on_venture_message'
      and tgrelid = 'public.venture_messages'::regclass
  ) then
    create trigger trg_notify_on_venture_message
    after insert on public.venture_messages
    for each row execute function public.notify_on_venture_message();
  end if;
end $$;

do $$
begin
  begin alter publication supabase_realtime add table public.ventures; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.venture_applications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.venture_messages; exception when duplicate_object then null; end;
end $$;

notify pgrst, 'reload schema';
