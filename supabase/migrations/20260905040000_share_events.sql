-- Share actions, not unique sharers. Apply manually before publishing.
-- Historical unique shares are retained as a baseline; past repeat sends
-- were not recorded and cannot be reconstructed accurately.
create table if not exists public.share_events (
  user_id uuid not null,
  request_id uuid not null,
  post_id uuid not null references public.posts(id) on delete cascade,
  channel text not null check (channel in ('legacy', 'dm', 'tribe', 'native', 'clipboard')),
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
create index if not exists share_events_post_idx on public.share_events(post_id);
alter table public.share_events enable row level security;
revoke all on public.share_events from anon, authenticated;
grant select, insert on public.share_events to authenticated;
drop policy if exists share_events_own on public.share_events;
create policy share_events_own on public.share_events for select to authenticated
using (user_id = auth.uid());
drop policy if exists share_events_external_insert on public.share_events;
create policy share_events_external_insert on public.share_events for insert to authenticated
with check (user_id = auth.uid() and channel in ('native', 'clipboard')
  and exists (select 1 from public.posts p where p.id = post_id));

-- Deterministic baseline identity makes replay safe. No guess at lost history.
insert into public.share_events(user_id, request_id, post_id, channel, created_at)
select user_id, post_id, post_id, 'legacy', created_at from public.shares
on conflict do nothing;

-- Old toggle writes must never reduce or double-increment the event total.
drop trigger if exists shares_bump_count on public.shares;
drop trigger if exists shares_count on public.shares;

create or replace function public.sync_share_event_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.posts set shares_count = coalesce(shares_count, 0) + 1 where id = new.post_id;
  return new;
end;
$$;
revoke all on function public.sync_share_event_count() from public, anon, authenticated;
drop trigger if exists share_event_count on public.share_events;
create trigger share_event_count after insert on public.share_events
for each row execute function public.sync_share_event_count();

-- A committed chat message and its count are one transaction. No second,
-- best-effort HTTP request that can silently fail after the message sends.
create or replace function public.record_chat_share_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.shared_post_id is not null then
    insert into public.share_events(user_id, request_id, post_id, channel)
    values (new.sender_id, new.id, new.shared_post_id, TG_ARGV[0])
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.record_chat_share_event() from public, anon, authenticated;
drop trigger if exists record_dm_share_event on public.messages;
create trigger record_dm_share_event after insert on public.messages
for each row execute function public.record_chat_share_event('dm');
drop trigger if exists record_tribe_share_event on public.tribe_messages;
create trigger record_tribe_share_event after insert on public.tribe_messages
for each row execute function public.record_chat_share_event('tribe');

create or replace function public.record_external_share(_post_id uuid, _request_id uuid, _channel text)
returns integer language plpgsql security invoker set search_path = public as $$
declare result integer;
begin
  if auth.uid() is null or _channel not in ('native', 'clipboard') then
    raise exception 'Invalid share request';
  end if;
  insert into public.share_events(user_id, request_id, post_id, channel)
  values (auth.uid(), _request_id, _post_id, _channel) on conflict do nothing;
  if not exists (select 1 from public.share_events where user_id = auth.uid()
    and request_id = _request_id and post_id = _post_id and channel = _channel) then
    raise exception 'Share request does not match its original action';
  end if;
  select shares_count into result from public.posts where id = _post_id;
  if result is null then raise exception 'Post is no longer available'; end if;
  return result;
end;
$$;
revoke all on function public.record_external_share(uuid, uuid, text) from public, anon;
grant execute on function public.record_external_share(uuid, uuid, text) to authenticated;

-- Preserve completed-share totals on message unsend/delete. Only deleting the
-- original post removes its events. Account erasure removes actor identifiers.
create or replace function public.anonymize_share_events_on_account_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- A random per-event actor preserves the primary key and total without
  -- retaining the deleted account id or linking its historical shares.
  update public.share_events set user_id = gen_random_uuid() where user_id = old.id;
  return old;
end;
$$;
revoke all on function public.anonymize_share_events_on_account_delete() from public, anon, authenticated;
drop trigger if exists anonymize_share_events on auth.users;
create trigger anonymize_share_events before delete on auth.users
for each row execute function public.anonymize_share_events_on_account_delete();

update public.posts p set shares_count = (select count(*) from public.share_events e where e.post_id = p.id)
where shares_count is distinct from (select count(*) from public.share_events e where e.post_id = p.id);
