-- Venture journey consistency: lifecycle outcomes, room read pointers and
-- transition-specific notifications.
--
-- RED under CHANGE_PROTOCOL: this migration changes RLS policies/triggers and
-- grants. Review and apply it through Lovable's SQL editor before publishing
-- the matching UI. It is additive for data; no existing rows are rewritten.

alter table public.ventures
  add column if not exists cancelled_at timestamptz;

comment on column public.ventures.cancelled_at is
  'Set when a host cancels a Venture that did not happen. Null for completed Ventures and active plans.';

-- Applications and invitations close at the advertised start time. Legacy
-- Ventures without a real start retain the old behaviour.
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
      and v.cancelled_at is null
      and v.filled_slots < v.max_slots
      and (v.starts_at is null or v.starts_at > now())
      and (v.ends_at is null or v.ends_at > now())
  )
$$;

revoke all on function public.is_venture_joinable(uuid) from public, anon;
grant execute on function public.is_venture_joinable(uuid) to authenticated;

-- A future plan cannot become profile proof by being labelled complete early.
-- Hosts can still cancel at any time by setting cancelled_at in the same write.
create or replace function public.enforce_venture_outcome_timing()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
    and coalesce(old.status, 'open') <> 'closed'
    and coalesce(new.status, 'open') = 'closed'
    and new.cancelled_at is null
    and old.starts_at is not null
    and old.starts_at > now() then
    raise exception 'A Venture cannot be completed before it starts'
      using hint = 'Cancel the plan instead.';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_venture_outcome_timing()
  from public, anon, authenticated;

drop trigger if exists enforce_venture_outcome_timing on public.ventures;
create trigger enforce_venture_outcome_timing
before update of status, cancelled_at on public.ventures
for each row execute function public.enforce_venture_outcome_timing();

-- One read pointer per member, matching Tribe Room read semantics.
create table if not exists public.venture_room_reads (
  venture_id uuid not null references public.ventures(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (venture_id, user_id)
);

create index if not exists venture_room_reads_user_idx
  on public.venture_room_reads (user_id, last_read_at desc);

alter table public.venture_room_reads enable row level security;

drop policy if exists "Members read own Venture room pointer" on public.venture_room_reads;
create policy "Members read own Venture room pointer"
on public.venture_room_reads for select to authenticated
using (user_id = auth.uid() and public.is_venture_member(venture_id, auth.uid()));

drop policy if exists "Members create own Venture room pointer" on public.venture_room_reads;
create policy "Members create own Venture room pointer"
on public.venture_room_reads for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_verified_adult(auth.uid())
  and public.is_venture_member(venture_id, auth.uid())
);

drop policy if exists "Members update own Venture room pointer" on public.venture_room_reads;
create policy "Members update own Venture room pointer"
on public.venture_room_reads for update to authenticated
using (user_id = auth.uid() and public.is_venture_member(venture_id, auth.uid()))
with check (
  user_id = auth.uid()
  and public.is_verified_adult(auth.uid())
  and public.is_venture_member(venture_id, auth.uid())
);

drop trigger if exists require_adult_before_write on public.venture_room_reads;
create trigger require_adult_before_write
before insert or update on public.venture_room_reads
for each row execute function public.require_verified_adult();

grant select, insert, update on public.venture_room_reads to authenticated;

-- Existing rooms start clean at rollout. Future hosts and newly accepted
-- members receive a baseline immediately, so their first genuinely new
-- message can produce an unread badge even before they open the room once.
insert into public.venture_room_reads (venture_id, user_id, last_read_at)
select v.id, v.user_id, now() from public.ventures v
union
select a.venture_id, a.applicant_id, now()
from public.venture_applications a
where a.status = 'accepted'
on conflict (venture_id, user_id) do nothing;

create or replace function public.initialize_venture_room_read_pointer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'ventures' then
    insert into public.venture_room_reads (venture_id, user_id, last_read_at)
    values (new.id, new.user_id, now())
    on conflict (venture_id, user_id) do nothing;
  elsif new.status = 'accepted'
    and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.venture_room_reads (venture_id, user_id, last_read_at)
    values (new.venture_id, new.applicant_id, now())
    on conflict (venture_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.initialize_venture_room_read_pointer()
  from public, anon, authenticated;

drop trigger if exists initialize_host_venture_read_pointer on public.ventures;
create trigger initialize_host_venture_read_pointer
after insert on public.ventures
for each row execute function public.initialize_venture_room_read_pointer();

drop trigger if exists initialize_member_venture_read_pointer on public.venture_applications;
create trigger initialize_member_venture_read_pointer
after insert or update of status on public.venture_applications
for each row execute function public.initialize_venture_room_read_pointer();

-- Make application state changes say what actually happened and notify the
-- person who needs to act. In particular, accepting an invite informs the
-- host rather than sending the invitee a redundant acceptance notification.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array[
    'like','comment','reply','mention','follow','message','new_post',
    'venture_apply','venture_invite','venture_accept','venture_decline',
    'venture_invite_accept','venture_invite_decline','venture_withdraw','venture_leave',
    'venture_message','tribe_join','hello','hello_accepted','tribe_pulse',
    'repost','quote','comment_like','comment_repost'
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
  from public.ventures v where v.id = new.venture_id;
  if host_id is null or host_id = new.applicant_id then return null; end if;

  if (tg_op = 'INSERT' or old.status is distinct from new.status) and new.status = 'pending' then
    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (host_id, new.applicant_id, 'venture_apply', new.venture_id,
      left(coalesce(nullif(new.message, ''), venture_title), 140));
  elsif (tg_op = 'INSERT' or old.status is distinct from new.status) and new.status = 'invited' then
    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (new.applicant_id, host_id, 'venture_invite', new.venture_id,
      left(coalesce(venture_title, 'Venture'), 140));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (new.applicant_id, host_id, 'venture_accept', new.venture_id,
      left(coalesce(venture_title, 'Your Venture'), 140));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'declined' then
    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (new.applicant_id, host_id, 'venture_decline', new.venture_id,
      left(coalesce(venture_title, 'Your Venture'), 140));
  elsif tg_op = 'UPDATE' and old.status = 'invited' and new.status = 'accepted' then
    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (host_id, new.applicant_id, 'venture_invite_accept', new.venture_id,
      left(coalesce(venture_title, 'Your Venture'), 140));
  elsif tg_op = 'UPDATE' and old.status = 'invited' and new.status = 'declined' then
    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (host_id, new.applicant_id, 'venture_invite_decline', new.venture_id,
      left(coalesce(venture_title, 'Your Venture'), 140));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'cancelled' then
    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (host_id, new.applicant_id, 'venture_withdraw', new.venture_id,
      left(coalesce(venture_title, 'Your Venture'), 140));
  elsif tg_op = 'UPDATE' and old.status = 'accepted' and new.status = 'cancelled' then
    insert into public.notifications (user_id, actor_id, kind, venture_id, preview)
    values (host_id, new.applicant_id, 'venture_leave', new.venture_id,
      left(coalesce(venture_title, 'Your Venture'), 140));
  end if;
  return null;
end;
$$;

revoke all on function public.notify_on_venture_application() from public, anon, authenticated;

-- Completed counts include naturally elapsed Ventures. Cancelled plans never
-- become profile proof or Venture Memories.
create or replace function public.get_profile_stats(_target_id uuid)
returns table(moots_count integer, hosted_count integer, joined_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.hellos h
      where h.status = 'accepted'
        and (h.sender_id = _target_id or h.recipient_id = _target_id)),
    (select count(*)::int from public.ventures v
      where v.user_id = _target_id
        and v.cancelled_at is null
        and (v.status = 'closed' or (v.ends_at is not null and v.ends_at <= now()))),
    (select count(*)::int from public.venture_applications a
      join public.ventures v on v.id = a.venture_id
      where a.applicant_id = _target_id
        and a.status = 'accepted'
        and v.cancelled_at is null
        and (v.status = 'closed' or (v.ends_at is not null and v.ends_at <= now())));
$$;

revoke all on function public.get_profile_stats(uuid) from public, anon;
grant execute on function public.get_profile_stats(uuid) to authenticated;

-- Keep the durable party-room message accurate for each outcome.
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
    if new.cancelled_at is not null then
      perform public.emit_venture_system_message(
        new.id, new.user_id, 'venture_cancelled', 'The host cancelled this Venture. The room is now read-only.'
      );
    else
      perform public.emit_venture_system_message(
        new.id, new.user_id, 'venture_closed', 'This Venture is complete. The room is now a memory.'
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.announce_venture_details_change() from public, anon, authenticated;

drop trigger if exists announce_venture_details_change on public.ventures;
create trigger announce_venture_details_change
after update of starts_at, ends_at, venue_tz, venue_place_id, status, cancelled_at on public.ventures
for each row execute function public.announce_venture_details_change();
