create table if not exists public.moderators (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id) on delete set null
);
grant select on public.moderators to authenticated;
grant all on public.moderators to service_role;
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
drop policy if exists "Hidden posts stay in moderation" on public.posts;
create policy "Hidden posts stay in moderation"
on public.posts as restrictive
for select to authenticated
using (moderation_hidden_at is null or public.current_user_is_moderator());
drop policy if exists "Hidden comments stay in moderation" on public.comments;
create policy "Hidden comments stay in moderation"
on public.comments as restrictive
for select to authenticated
using (moderation_hidden_at is null or public.current_user_is_moderator());
drop policy if exists "Suspended profiles stay in moderation" on public.profiles;
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
grant select on public.moderation_actions to authenticated;
grant all on public.moderation_actions to service_role;
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
create table if not exists public.blocked_content_patterns (
  id bigint generated always as identity primary key,
  pattern text not null unique,
  category text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.blocked_content_patterns to authenticated;
grant all on public.blocked_content_patterns to service_role;
alter table public.blocked_content_patterns enable row level security;
drop policy if exists "Moderators read safety patterns" on public.blocked_content_patterns;
create policy "Moderators read safety patterns"
on public.blocked_content_patterns for select to authenticated
using (public.current_user_is_moderator());
insert into public.blocked_content_patterns (pattern, category) values
  ('(?i)\m(csam|child[[:space:]]+porn(ography)?)\M', 'sexual-safety'),
  ('(?i)\m(sex|nudes?|naked)[[:space:]]+(with|from|of)[[:space:]]+(a[[:space:]]+)?minor\M', 'sexual-safety'),
  ('(?i)\m(kill|murder|shoot|stab)\M.{0,40}\m(you|him|her|them)\M', 'credible-threat'),
  ('(?i)\mn+[i1]+g+[e3]*r+s?\M', 'hateful-slur'),
  ('(?i)\mf+[a@]+g+[o0]*t+s?\M', 'hateful-slur')
on conflict (pattern) do nothing;
create or replace function public.content_is_blocked(value text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(bool_or(coalesce(value, '') ~ p.pattern), false)
  from public.blocked_content_patterns p
  where p.active
$$;
revoke all on function public.content_is_blocked(text) from public, anon, authenticated;
create or replace function public.reject_blocked_text()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text := '';
  row_data jsonb := to_jsonb(new);
begin
  candidate := case tg_table_name
    when 'posts' then row_data->>'content'
    when 'comments' then row_data->>'content'
    when 'messages' then row_data->>'content'
    when 'tribe_messages' then row_data->>'content'
    when 'venture_messages' then row_data->>'content'
    when 'venture_applications' then row_data->>'message'
    when 'ventures' then concat_ws(' ', row_data->>'title', row_data->>'note')
    when 'profiles' then concat_ws(' ', row_data->>'display_name', row_data->>'handle', row_data->>'bio')
    else ''
  end;
  if public.content_is_blocked(candidate) then
    raise exception 'Content violates community safety filters';
  end if;
  return new;
end;
$$;
revoke all on function public.reject_blocked_text() from public, anon, authenticated;
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'posts', 'comments', 'messages', 'tribe_messages',
    'ventures', 'venture_applications', 'venture_messages'
  ] loop
    execute format('drop trigger if exists reject_blocked_text_before_write on public.%I', table_name);
    execute format(
      'create trigger reject_blocked_text_before_write before insert or update on public.%I for each row execute function public.reject_blocked_text()',
      table_name
    );
  end loop;
end
$$;
alter table public.profiles
  add column if not exists interests text[] not null default '{}',
  add column if not exists social_intents text[] not null default '{}',
  add column if not exists availability text[] not null default '{}';
alter table public.profiles drop constraint if exists profiles_interests_allowed;
alter table public.profiles drop constraint if exists profiles_social_intents_allowed;
alter table public.profiles drop constraint if exists profiles_availability_allowed;
alter table public.profiles
  add constraint profiles_interests_allowed check (
    cardinality(interests) <= 8 and
    interests <@ array['outdoors','fitness','books','music','art','food','coffee','nightlife','tech','business','wellness','games']::text[]
  ),
  add constraint profiles_social_intents_allowed check (
    cardinality(social_intents) <= 3 and
    social_intents <@ array['make_friends','activity_partner','casual_hangouts','local_exploration','networking','creative_collab']::text[]
  ),
  add constraint profiles_availability_allowed check (
    cardinality(availability) <= 4 and
    availability <@ array['weekday_mornings','weekday_evenings','weekends','spontaneous']::text[]
  );
create table if not exists public.profile_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m integer not null default 0 check (accuracy_m between 0 and 100000),
  discoverable boolean not null default true,
  radius_km smallint not null default 15 check (radius_km in (5, 15, 50)),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profile_locations to authenticated;
grant all on public.profile_locations to service_role;
alter table public.profile_locations enable row level security;
drop policy if exists "Users read their own location" on public.profile_locations;
create policy "Users read their own location"
  on public.profile_locations for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Users insert their own location" on public.profile_locations;
create policy "Users insert their own location"
  on public.profile_locations for insert to authenticated
  with check (auth.uid() = user_id and public.is_verified_adult(auth.uid()));
drop policy if exists "Users update their own location" on public.profile_locations;
create policy "Users update their own location"
  on public.profile_locations for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.is_verified_adult(auth.uid()));
drop policy if exists "Users delete their own location" on public.profile_locations;
create policy "Users delete their own location"
  on public.profile_locations for delete to authenticated
  using (auth.uid() = user_id);
create or replace function public.touch_profile_location()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists profile_locations_touch_updated_at on public.profile_locations;
create trigger profile_locations_touch_updated_at
before update on public.profile_locations
for each row execute function public.touch_profile_location();
create or replace function public.list_nearby_profile_matches(_limit integer default 20)
returns table(profile_id uuid, distance_band text, match_score integer)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      p.id,
      p.tribe_ids,
      p.interests,
      p.social_intents,
      p.availability,
      l.latitude,
      l.longitude,
      l.radius_km
    from public.profiles p
    join public.profile_locations l on l.user_id = p.id
    where p.id = auth.uid()
      and p.adult_verified_at is not null
      and p.suspended_at is null
      and l.discoverable
  ),
  candidates as (
    select
      p.id,
      p.tribe_ids,
      p.interests,
      p.social_intents,
      p.availability,
      l.latitude,
      l.longitude,
      l.radius_km
    from public.profiles p
    join public.profile_locations l on l.user_id = p.id
    where p.id <> auth.uid()
      and p.adult_verified_at is not null
      and p.suspended_at is null
      and cardinality(p.tribe_ids) > 0
      and l.discoverable
      and not public.has_blocked(auth.uid(), p.id)
  ),
  measured as (
    select
      c.*,
      m.tribe_ids as my_tribes,
      m.interests as my_interests,
      m.social_intents as my_social_intents,
      m.availability as my_availability,
      6371.0 * 2.0 * asin(sqrt(
        power(sin(radians(c.latitude - m.latitude) / 2.0), 2) +
        cos(radians(m.latitude)) * cos(radians(c.latitude)) *
        power(sin(radians(c.longitude - m.longitude) / 2.0), 2)
      )) as distance_km,
      least(c.radius_km, m.radius_km) as mutual_radius_km
    from candidates c cross join me m
  ),
  scored as (
    select
      id,
      distance_km,
      case
        when distance_km <= 2 then 'Within 2 km'
        when distance_km <= 5 then 'Within 5 km'
        when distance_km <= 15 then 'Within 15 km'
        else 'Within 50 km'
      end as distance_band,
      (
        case when tribe_ids && my_tribes then 20 else 0 end +
        least(20, 10 * (select count(*)::integer from unnest(interests) item where item = any(my_interests))) +
        case when social_intents && my_social_intents then 25 else 0 end +
        case when availability && my_availability then 20 else 0 end +
        case when distance_km <= 5 then 15 when distance_km <= 15 then 10 else 5 end
      )::integer as score
    from measured
    where distance_km <= mutual_radius_km
  )
  select id, distance_band, least(score, 100)
  from scored
  order by score desc, distance_km asc, id
  limit least(greatest(coalesce(_limit, 20), 1), 50);
$$;
revoke all on function public.list_nearby_profile_matches(integer) from public, anon;
grant execute on function public.list_nearby_profile_matches(integer) to authenticated, service_role;
create index if not exists profile_locations_discoverable_idx
  on public.profile_locations (discoverable, updated_at desc)
  where discoverable;
update public.tribes
set name = 'Mindful Koi'
where key = 'koi'
  and name is distinct from 'Mindful Koi';