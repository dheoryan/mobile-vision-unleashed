alter table public.profiles add column if not exists tribe_changed_at timestamptz;
update public.profiles set tribe_ids = array[tribe_ids[1]] where coalesce(array_length(tribe_ids, 1), 0) > 1;
delete from public.tribe_members tm
where not exists (
  select 1 from public.profiles p join public.tribes t on t.id = tm.tribe_id
  where (tm.user_id = p.id or tm.profile_id = p.id) and t.key = any (p.tribe_ids)
);
create or replace function public.enforce_tribe_limit()
returns trigger language plpgsql set search_path to 'public' as $function$
declare
  changed boolean;
  grace_days constant int := 7;
  cooldown_days constant int := 21;
begin
  if coalesce(array_length(new.tribe_ids, 1), 0) > 1 then
    raise exception 'A profile belongs to exactly one Tribe, got %', array_length(new.tribe_ids, 1)
      using hint = 'Switch Tribes instead of joining an additional one.';
  end if;
  changed := false;
  if tg_op = 'UPDATE' then
    changed := new.tribe_ids is distinct from old.tribe_ids and coalesce(array_length(old.tribe_ids, 1), 0) > 0;
  end if;
  if changed then
    if auth.uid() is not null
       and now() - new.created_at >= make_interval(days => grace_days)
       and old.tribe_changed_at is not null
       and now() - old.tribe_changed_at < make_interval(days => cooldown_days)
    then
      raise exception 'You can change Tribe again in % day(s)',
        ceil(extract(epoch from (old.tribe_changed_at + make_interval(days => cooldown_days) - now())) / 86400)::int
        using hint = 'Tribe changes are limited to one every 21 days.';
    end if;
    new.tribe_changed_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$function$;
create or replace function public.sync_tribe_membership_on_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tribe_ids is distinct from old.tribe_ids then
    delete from public.tribe_members tm
    where (tm.user_id = new.id or tm.profile_id = new.id)
      and not exists (
        select 1 from public.tribes t where t.id = tm.tribe_id and t.key = any (new.tribe_ids)
      );
  end if;
  return new;
end;
$$;
revoke all on function public.sync_tribe_membership_on_change() from public, anon, authenticated;
drop trigger if exists trg_sync_tribe_membership on public.profiles;
create trigger trg_sync_tribe_membership after update of tribe_ids on public.profiles
for each row execute function public.sync_tribe_membership_on_change();
create or replace function public.tribe_switch_available_at(_user_id uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select case
    when p.tribe_changed_at is null then null
    when now() - p.created_at < make_interval(days => 7) then null
    else p.tribe_changed_at + make_interval(days => 21)
  end
  from public.profiles p where p.id = _user_id;
$$;
revoke all on function public.tribe_switch_available_at(uuid) from public, anon;
grant execute on function public.tribe_switch_available_at(uuid) to authenticated;
create table if not exists public.hellos (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 280),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint hellos_no_self check (sender_id <> recipient_id),
  constraint hellos_one_per_pair unique (sender_id, recipient_id)
);
grant select, insert, update on public.hellos to authenticated;
grant all on public.hellos to service_role;
create index if not exists hellos_recipient_idx on public.hellos(recipient_id, status, created_at desc);
create index if not exists hellos_sender_idx on public.hellos(sender_id, created_at desc);
alter table public.hellos enable row level security;
drop policy if exists "Participants read their hellos" on public.hellos;
create policy "Participants read their hellos" on public.hellos for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "Senders create their own hellos" on public.hellos;
create policy "Senders create their own hellos" on public.hellos for insert to authenticated
  with check (sender_id = auth.uid() and status = 'pending' and not public.has_blocked(auth.uid(), recipient_id));
drop policy if exists "Recipients answer their hellos" on public.hellos;
create policy "Recipients answer their hellos" on public.hellos for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid() and status in ('accepted', 'declined'));
create or replace function public.hellos_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.message is distinct from old.message then
    raise exception 'A Hello''s participants and message are immutable';
  end if;
  if new.status is distinct from old.status then
    if old.status <> 'pending' then
      raise exception 'This Hello has already been answered';
    end if;
    new.decided_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists trg_hellos_guard on public.hellos;
create trigger trg_hellos_guard before update on public.hellos for each row execute function public.hellos_guard();
create or replace function public.hellos_enforce_monthly_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sent_this_month int;
  monthly_cap constant int := 5;
begin
  select count(*) into sent_this_month from public.hellos h
  where h.sender_id = new.sender_id and h.created_at >= date_trunc('month', now());
  if sent_this_month >= monthly_cap then
    raise exception 'You have used all % Hellos this month', monthly_cap
      using hint = 'Hellos reset at the start of each month.';
  end if;
  return new;
end;
$$;
revoke all on function public.hellos_enforce_monthly_cap() from public, anon, authenticated;
drop trigger if exists trg_hellos_monthly_cap on public.hellos;
create trigger trg_hellos_monthly_cap before insert on public.hellos for each row execute function public.hellos_enforce_monthly_cap();
create or replace function public.can_direct_message(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _a is not null and _b is not null and _a <> _b
    and not public.has_blocked(_a, _b)
    and (
      exists (select 1 from public.profiles pa, public.profiles pb where pa.id = _a and pb.id = _b and pa.tribe_ids && pb.tribe_ids)
      or exists (select 1 from public.hellos h where h.status = 'accepted'
        and ((h.sender_id = _a and h.recipient_id = _b) or (h.sender_id = _b and h.recipient_id = _a)))
      or exists (select 1 from public.ventures v where coalesce(v.status, 'open') <> 'closed'
        and ((v.user_id = _a and public.is_venture_member(v.id, _b))
          or (v.user_id = _b and public.is_venture_member(v.id, _a))
          or (public.is_venture_member(v.id, _a) and public.is_venture_member(v.id, _b))))
      or exists (select 1 from public.messages m
        where (m.sender_id = _a and m.recipient_id = _b) or (m.sender_id = _b and m.recipient_id = _a))
    );
$$;
revoke all on function public.can_direct_message(uuid, uuid) from public, anon;
grant execute on function public.can_direct_message(uuid, uuid) to authenticated;
drop policy if exists "Senders insert messages" on public.messages;
create policy "Senders insert messages" on public.messages for insert to authenticated
with check (
  auth.uid() = sender_id
  and not public.has_blocked(auth.uid(), recipient_id)
  and public.can_direct_message(auth.uid(), recipient_id)
);
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array['like','comment','reply','mention','follow','message','new_post','venture_apply','venture_invite','venture_accept','venture_message','tribe_join','hello','hello_accepted']));
create or replace function public.notify_on_hello()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, actor_id, kind, preview)
    values (new.recipient_id, new.sender_id, 'hello', left(new.message, 140));
  elsif new.status = 'accepted' and old.status = 'pending' then
    insert into public.notifications (user_id, actor_id, kind, preview)
    values (new.sender_id, new.recipient_id, 'hello_accepted', 'accepted your Hello');
  end if;
  return null;
end;
$$;
revoke all on function public.notify_on_hello() from public, anon, authenticated;
drop trigger if exists trg_notify_on_hello on public.hellos;
create trigger trg_notify_on_hello after insert or update of status on public.hellos
for each row execute function public.notify_on_hello();
create or replace function public.list_explore_matches(_limit integer default 20, _offset integer default 0)
returns table (
  profile_id uuid, score integer, shared_interests text[], shared_intents text[],
  shared_availability text[], same_tribe boolean, distance_band text,
  open_venture_id uuid, open_venture_title text
)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id, p.tribe_ids, p.interests, p.social_intents, p.availability, l.latitude, l.longitude, l.radius_km
    from public.profiles p
    left join public.profile_locations l on l.user_id = p.id and l.discoverable
    where p.id = auth.uid()
  ),
  candidates as (
    select p.id, p.tribe_ids, p.interests, p.social_intents, p.availability, p.updated_at, l.latitude, l.longitude, l.radius_km
    from public.profiles p
    left join public.profile_locations l on l.user_id = p.id and l.discoverable
    where p.id <> auth.uid() and p.suspended_at is null and cardinality(p.tribe_ids) > 0
      and not public.has_blocked(auth.uid(), p.id)
  ),
  measured as (
    select c.id, c.updated_at,
      (c.tribe_ids && m.tribe_ids) as same_tribe,
      array(select i from unnest(c.interests) i where i = any (m.interests)) as shared_interests,
      array(select i from unnest(c.social_intents) i where i = any (m.social_intents)) as shared_intents,
      array(select i from unnest(c.availability) i where i = any (m.availability)) as shared_availability,
      case when c.latitude is null or m.latitude is null then null
        else 6371.0 * 2.0 * asin(sqrt(
          power(sin(radians(c.latitude - m.latitude) / 2.0), 2) +
          cos(radians(m.latitude)) * cos(radians(c.latitude)) *
          power(sin(radians(c.longitude - m.longitude) / 2.0), 2)))
      end as distance_km,
      least(c.radius_km, m.radius_km) as mutual_radius_km,
      ov.id as open_venture_id, ov.title as open_venture_title
    from candidates c cross join me m
    left join lateral (
      select v.id, v.title from public.ventures v
      where v.user_id = c.id and v.status = 'open' and v.ended_at is null
        and v.filled_slots < v.max_slots and (v.scope = 'all' or c.tribe_ids && m.tribe_ids)
      order by v.created_at desc limit 1
    ) ov on true
  ),
  scored as (
    select id, updated_at, same_tribe, shared_interests, shared_intents, shared_availability,
      open_venture_id, open_venture_title,
      case
        when distance_km is null then null
        when mutual_radius_km is null then null
        when distance_km > mutual_radius_km then null
        when distance_km <= 2 then 'Within 2 km'
        when distance_km <= 5 then 'Within 5 km'
        when distance_km <= 15 then 'Within 15 km'
        else 'Within 50 km'
      end as distance_band,
      (
        case when cardinality(shared_intents) > 0 then 30 else 0 end +
        least(30, 10 * cardinality(shared_interests)) +
        case when cardinality(shared_availability) > 0 then 15 else 0 end +
        case when open_venture_id is not null then 15 else 0 end +
        case when distance_km is not null and mutual_radius_km is not null and distance_km <= mutual_radius_km then 10 else 0 end
      )::integer as score
    from measured
  )
  select id, least(score, 100), shared_interests, shared_intents, shared_availability,
    same_tribe, distance_band, open_venture_id, open_venture_title
  from scored
  order by score desc, updated_at desc nulls last, id
  offset greatest(coalesce(_offset, 0), 0)
  limit least(greatest(coalesce(_limit, 20), 1), 50);
$$;
revoke all on function public.list_explore_matches(integer, integer) from public, anon;
grant execute on function public.list_explore_matches(integer, integer) to authenticated, service_role;
create index if not exists profiles_active_updated_idx on public.profiles (updated_at desc) where suspended_at is null;
create index if not exists ventures_host_open_idx on public.ventures (user_id, created_at desc) where status = 'open' and ended_at is null;
create or replace function public.enforce_venture_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  max_count int;
  venture_status text;
  accepted_count int;
begin
  if new.status is distinct from 'accepted' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'accepted' then
    return new;
  end if;
  select v.max_slots, v.status into max_count, venture_status
  from public.ventures v where v.id = new.venture_id for update;
  if not found then
    raise exception 'Venture % no longer exists', new.venture_id;
  end if;
  if venture_status = 'closed' then
    raise exception 'This Venture is closed' using hint = 'Reopen it before accepting anyone else.';
  end if;
  select count(*) into accepted_count from public.venture_applications
  where venture_id = new.venture_id and status = 'accepted' and id is distinct from new.id;
  if 1 + accepted_count + 1 > max_count then
    raise exception 'This Venture is already full (% of % seats taken)', 1 + accepted_count, max_count
      using hint = 'Someone else took the last spot.';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_venture_capacity() from public, anon, authenticated;
drop trigger if exists trg_enforce_venture_capacity on public.venture_applications;
create trigger trg_enforce_venture_capacity before insert or update on public.venture_applications
for each row execute function public.enforce_venture_capacity();
create or replace function public.sync_venture_slots()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_venture uuid;
  accepted_count int;
  next_filled int;
  max_count int;
  current_status text;
begin
  target_venture := coalesce(new.venture_id, old.venture_id);
  select count(*) into accepted_count from public.venture_applications
  where venture_id = target_venture and status = 'accepted';
  select max_slots, status into max_count, current_status from public.ventures where id = target_venture;
  if max_count is null then
    return null;
  end if;
  next_filled := 1 + accepted_count;
  update public.ventures
  set filled_slots = next_filled,
    status = case
      when current_status = 'closed' then 'closed'
      when next_filled >= max_count then 'full'
      else 'open'
    end
  where id = target_venture;
  return null;
end;
$$;
with ranked as (
  select va.id,
    row_number() over (partition by va.venture_id order by coalesce(va.decided_at, va.created_at), va.id) as seat,
    v.max_slots
  from public.venture_applications va
  join public.ventures v on v.id = va.venture_id
  where va.status = 'accepted'
)
update public.venture_applications va
set status = 'rejected'
from ranked
where ranked.id = va.id and ranked.seat + 1 > ranked.max_slots;
update public.ventures v
set filled_slots = 1 + (select count(*) from public.venture_applications va where va.venture_id = v.id and va.status = 'accepted'),
    status = case
      when v.status = 'closed' then 'closed'
      when 1 + (select count(*) from public.venture_applications va where va.venture_id = v.id and va.status = 'accepted') >= v.max_slots then 'full'
      else 'open'
    end;
create or replace function public.bump_host_venture_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set venture_count = venture_count + 1 where id = new.user_id;
  return null;
end;
$$;
revoke all on function public.bump_host_venture_count() from public, anon, authenticated;
drop trigger if exists trg_bump_host_venture_count on public.ventures;
create trigger trg_bump_host_venture_count after insert on public.ventures
for each row execute function public.bump_host_venture_count();
update public.profiles p
set venture_count = coalesce((select count(*) from public.ventures v where v.user_id = p.id), 0);
alter table public.ventures add column if not exists image_url text;
drop policy if exists "Users read accessible venture images" on storage.objects;
create policy "Users read accessible venture images" on storage.objects for select to authenticated
using (
  bucket_id = 'venture-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.ventures v
      where v.image_url = storage.objects.name
        and (v.user_id = auth.uid()
          or public.has_venture_application(v.id, auth.uid())
          or public.is_venture_scope_visible(v.id, auth.uid()))
    )
  )
);
drop policy if exists "Users upload own venture images" on storage.objects;
create policy "Users upload own venture images" on storage.objects for insert to authenticated
with check (bucket_id = 'venture-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users delete own venture images" on storage.objects;
create policy "Users delete own venture images" on storage.objects for delete to authenticated
using (bucket_id = 'venture-images' and (storage.foldername(name))[1] = auth.uid()::text);
create or replace function public.enforce_venture_image_owner()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.image_url is not null
     and (tg_op = 'INSERT' or new.image_url is distinct from old.image_url)
     and new.image_url !~ ('^' || new.user_id::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'venture images must be stored in the host''s venture-images prefix';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_venture_image_owner on public.ventures;
create trigger enforce_venture_image_owner before insert or update of image_url on public.ventures
for each row execute function public.enforce_venture_image_owner();
create or replace function public.cleanup_venture_image()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.image_url is not null then
    delete from storage.objects where bucket_id = 'venture-images' and name = old.image_url;
  end if;
  return old;
end;
$$;
revoke all on function public.cleanup_venture_image() from public, anon, authenticated;
drop trigger if exists trg_cleanup_venture_image on public.ventures;
create trigger trg_cleanup_venture_image after delete on public.ventures
for each row execute function public.cleanup_venture_image();
create or replace function public.enforce_venture_host_edits()
returns trigger language plpgsql set search_path = public as $$
declare
  accepted_count int;
  occupancy int;
begin
  if auth.uid() is null or pg_trigger_depth() > 1 then
    return new;
  end if;
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'id, user_id and created_at cannot be changed';
  end if;
  if old.status = 'closed' and new.status = 'closed' then
    raise exception 'This Venture is closed' using hint = 'Reopen it before making changes.';
  end if;
  if new.filled_slots is distinct from old.filled_slots then
    raise exception 'filled_slots is maintained automatically'
      using hint = 'Accept or remove applicants to change the count.';
  end if;
  if new.status is distinct from old.status and new.status not in ('open', 'closed') then
    raise exception 'a host may only open or close a Venture, got %', new.status;
  end if;
  select count(*) into accepted_count from public.venture_applications
  where venture_id = new.id and status = 'accepted';
  occupancy := 1 + accepted_count;
  if new.max_slots < occupancy then
    raise exception 'There are already % people in this Venture', occupancy
      using hint = 'You can raise the number of slots, but not below who has joined.';
  end if;
  if new.scope is distinct from old.scope
     and exists (select 1 from public.venture_applications va
       where va.venture_id = new.id and va.status in ('pending', 'invited', 'accepted')) then
    raise exception 'Audience is locked once people have applied'
      using hint = 'Close this Venture and host a new one to change who it is for.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_enforce_venture_host_edits on public.ventures;
create trigger trg_enforce_venture_host_edits before update on public.ventures
for each row execute function public.enforce_venture_host_edits();
create or replace function public.cleanup_replaced_venture_image()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.image_url is not null and new.image_url is distinct from old.image_url then
    delete from storage.objects where bucket_id = 'venture-images' and name = old.image_url;
  end if;
  return null;
end;
$$;
revoke all on function public.cleanup_replaced_venture_image() from public, anon, authenticated;
drop trigger if exists trg_cleanup_replaced_venture_image on public.ventures;
create trigger trg_cleanup_replaced_venture_image after update of image_url on public.ventures
for each row execute function public.cleanup_replaced_venture_image();
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
insert into public.app_settings (key, value)
values ('adult_gate_enabled', 'false'::jsonb)
on conflict (key) do nothing;
create or replace function public.adult_gate_enabled()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select value::text::boolean from public.app_settings where key = 'adult_gate_enabled'), false)
$$;
revoke all on function public.adult_gate_enabled() from public, anon;
grant execute on function public.adult_gate_enabled() to authenticated, service_role;
create or replace function public.is_verified_adult(profile_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select not public.adult_gate_enabled()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.adult_verified_at is not null
        and p.age >= 21 and p.suspended_at is null
    )
$$;
revoke all on function public.is_verified_adult(uuid) from public;
revoke execute on function public.is_verified_adult(uuid) from anon;
grant execute on function public.is_verified_adult(uuid) to authenticated, service_role;