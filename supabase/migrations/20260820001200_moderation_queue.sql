-- Minimum operational moderation: 24-hour report queue, privileged review,
-- auditable decisions, content hiding, and account suspension.

create table if not exists public.moderators (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id) on delete set null
);

alter table public.moderators enable row level security;

drop policy if exists "Moderators see own role" on public.moderators;
create policy "Moderators see own role"
on public.moderators for select to authenticated
using (user_id = auth.uid());

create or replace function public.current_user_is_moderator()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.moderators m where m.user_id = auth.uid()
  )
$$;

revoke all on function public.current_user_is_moderator() from public, anon;
grant execute on function public.current_user_is_moderator() to authenticated, service_role;

alter table public.reports
  add column if not exists status text not null default 'pending',
  add column if not exists due_at timestamptz not null default (now() + interval '24 hours'),
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists action text,
  add column if not exists moderator_notes text;

alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check
  check (status in ('pending', 'resolved', 'dismissed'));

create index if not exists idx_reports_queue
  on public.reports (status, due_at, created_at);

drop policy if exists "Moderators read report queue" on public.reports;
create policy "Moderators read report queue"
on public.reports for select to authenticated
using (public.current_user_is_moderator());

alter table public.posts
  add column if not exists moderation_hidden_at timestamptz,
  add column if not exists moderation_hidden_by uuid references public.profiles(id) on delete set null;

alter table public.comments
  add column if not exists moderation_hidden_at timestamptz,
  add column if not exists moderation_hidden_by uuid references public.profiles(id) on delete set null;

alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references public.profiles(id) on delete set null;

-- Suspension becomes part of the existing verified-adult gate, so all guarded
-- social writes stop without duplicating policies across every table.
create or replace function public.is_verified_adult(profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = profile_id
      and p.adult_verified_at is not null
      and p.age >= 21
      and p.suspended_at is null
  )
$$;

revoke all on function public.is_verified_adult(uuid) from public;
revoke execute on function public.is_verified_adult(uuid) from anon;
grant execute on function public.is_verified_adult(uuid) to authenticated, service_role;

create policy "Hidden posts stay in moderation"
on public.posts as restrictive
for select to authenticated
using (moderation_hidden_at is null or public.current_user_is_moderator());

create policy "Hidden comments stay in moderation"
on public.comments as restrictive
for select to authenticated
using (moderation_hidden_at is null or public.current_user_is_moderator());

create policy "Suspended profiles stay in moderation"
on public.profiles as restrictive
for select to authenticated
using (
  suspended_at is null
  or id = auth.uid()
  or public.current_user_is_moderator()
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  moderator_id uuid references public.profiles(id) on delete set null,
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.moderation_actions enable row level security;

drop policy if exists "Moderators read action log" on public.moderation_actions;
create policy "Moderators read action log"
on public.moderation_actions for select to authenticated
using (public.current_user_is_moderator());

create or replace function public.moderate_report(
  report_id uuid,
  decision text,
  notes text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  report_row public.reports;
  target_uuid uuid;
begin
  if not public.current_user_is_moderator() then
    raise exception 'Moderator access required';
  end if;

  if decision not in ('dismiss', 'hide_content', 'suspend_user') then
    raise exception 'Unsupported moderation decision';
  end if;

  select * into report_row
  from public.reports
  where id = report_id
  for update;

  if not found then
    raise exception 'Report not found';
  end if;
  if report_row.status <> 'pending' then
    raise exception 'Report has already been reviewed';
  end if;

  begin
    target_uuid := report_row.target_id::uuid;
  exception when invalid_text_representation then
    target_uuid := null;
  end;

  if decision = 'hide_content' then
    if report_row.target_kind = 'post' and target_uuid is not null then
      update public.posts
      set moderation_hidden_at = now(), moderation_hidden_by = auth.uid()
      where id = target_uuid;
    elsif report_row.target_kind = 'comment' and target_uuid is not null then
      update public.comments
      set moderation_hidden_at = now(), moderation_hidden_by = auth.uid()
      where id = target_uuid;
    else
      raise exception 'Only post or comment reports can hide content';
    end if;
  elsif decision = 'suspend_user' then
    if report_row.target_kind <> 'user' or target_uuid is null then
      raise exception 'Only user reports can suspend an account';
    end if;
    update public.profiles
    set suspended_at = now(), suspended_by = auth.uid()
    where id = target_uuid;
  end if;

  update public.reports
  set status = case when decision = 'dismiss' then 'dismissed' else 'resolved' end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      action = decision,
      moderator_notes = nullif(left(coalesce(notes, ''), 1000), '')
  where id = report_id
  returning * into report_row;

  insert into public.moderation_actions (report_id, moderator_id, action, notes)
  values (report_id, auth.uid(), decision, nullif(left(coalesce(notes, ''), 1000), ''));

  return report_row;
end;
$$;

revoke all on function public.moderate_report(uuid, text, text) from public, anon;
grant execute on function public.moderate_report(uuid, text, text) to authenticated, service_role;

comment on table public.moderators is
  'Grant with service-role SQL only: insert into public.moderators(user_id) values (<profile uuid>).';
comment on column public.reports.due_at is
  'Operational 24-hour review deadline for the moderation queue.';
