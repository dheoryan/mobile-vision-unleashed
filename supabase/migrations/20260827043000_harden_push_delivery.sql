-- Harden Web Push ownership and make delivery health observable.
--
-- Applying this migration changes no notification fan-out rules. It lets a
-- browser that still owns a PushSubscription safely move that endpoint to the
-- currently authenticated account, caps endpoint abuse, and records the final
-- Worker outcome on the source notification.

alter table public.notifications
  add column if not exists push_attempted_at timestamptz,
  add column if not exists push_status text not null default 'pending',
  add column if not exists push_delivered_count integer not null default 0,
  add column if not exists push_failed_count integer not null default 0;

alter table public.notifications
  drop constraint if exists notifications_push_status_check;
alter table public.notifications
  add constraint notifications_push_status_check
  check (push_status = any (array['pending', 'skipped', 'delivered', 'partial', 'failed']));

alter table public.notifications
  drop constraint if exists notifications_push_counts_check;
alter table public.notifications
  add constraint notifications_push_counts_check
  check (push_delivered_count >= 0 and push_failed_count >= 0);

-- Historical rows predate delivery telemetry and must not look like a live
-- queue backlog after this migration is applied.
update public.notifications
set push_status = 'skipped'
where push_status = 'pending' and push_attempted_at is null;

create index if not exists idx_notifications_push_pending
  on public.notifications (created_at)
  where push_status = 'pending';

-- Direct INSERT/UPDATE made it possible for one signed-in account to create an
-- unbounded number of endpoints, while RLS prevented a legitimate new account
-- on the same installed app from reclaiming an endpoint left by an interrupted
-- logout. Subscription writes now go through one bounded capability function.
drop policy if exists "own subs insert" on public.push_subscriptions;
drop policy if exists "own subs update" on public.push_subscriptions;

create or replace function public.claim_push_subscription(
  _endpoint text,
  _p256dh text,
  _auth text,
  _user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if _endpoint is null or length(_endpoint) = 0 or length(_endpoint) > 2048
    or _p256dh is null or length(_p256dh) = 0 or length(_p256dh) > 512
    or _auth is null or length(_auth) = 0 or length(_auth) > 256
    or length(coalesce(_user_agent, '')) > 512 then
    raise exception 'Invalid push subscription';
  end if;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    user_agent,
    last_used_at
  )
  values (
    current_user_id,
    _endpoint,
    _p256dh,
    _auth,
    _user_agent,
    now()
  )
  on conflict (endpoint) do update
  set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    last_used_at = excluded.last_used_at;

  -- Eight active installations is generous for a person while preventing one
  -- account from turning each notification into unbounded outbound requests.
  delete from public.push_subscriptions
  where id in (
    select id
    from public.push_subscriptions
    where user_id = current_user_id
    order by coalesce(last_used_at, created_at) desc, created_at desc
    offset 8
  );
end;
$$;

revoke all on function public.claim_push_subscription(text, text, text, text) from public;
revoke execute on function public.claim_push_subscription(text, text, text, text) from anon;
grant execute on function public.claim_push_subscription(text, text, text, text) to authenticated;

-- Recipients may mark a notification read, but delivery telemetry and source
-- context are server-owned. The service-role dispatch client has no auth.uid()
-- and therefore remains able to write delivery results.
create or replace function public.guard_notification_owner_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.actor_id is distinct from old.actor_id
      or new.kind is distinct from old.kind
      or new.post_id is distinct from old.post_id
      or new.comment_id is distinct from old.comment_id
      or new.message_id is distinct from old.message_id
      or new.venture_id is distinct from old.venture_id
      or new.tribe_id is distinct from old.tribe_id
      or new.preview is distinct from old.preview
      or new.created_at is distinct from old.created_at
      or new.push_attempted_at is distinct from old.push_attempted_at
      or new.push_status is distinct from old.push_status
      or new.push_delivered_count is distinct from old.push_delivered_count
      or new.push_failed_count is distinct from old.push_failed_count then
      raise exception 'Notification source and delivery state are immutable';
    end if;
    if old.read_at is not null and new.read_at is distinct from old.read_at then
      raise exception 'A read notification cannot be changed';
    end if;
    if new.read_at is null then
      raise exception 'read_at must be set';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_notification_owner_update on public.notifications;
create trigger guard_notification_owner_update
before update on public.notifications
for each row execute function public.guard_notification_owner_update();

revoke all on function public.guard_notification_owner_update() from public, anon, authenticated;
