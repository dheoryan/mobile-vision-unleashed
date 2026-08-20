create extension if not exists pgcrypto with schema extensions;
do $$
declare
  v_id uuid;
  v_new text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select id into v_id from vault.secrets where name = 'push_dispatch_secret';
  if v_id is null then
    perform vault.create_secret(v_new, 'push_dispatch_secret', 'Shared secret for push dispatch trigger');
  else
    perform vault.update_secret(v_id, v_new);
  end if;
end $$;
drop policy if exists "Applicants cancel own applications" on public.venture_applications;
drop policy if exists "Applicants respond to own venture invites" on public.venture_applications;
drop policy if exists "Applicants update own applications" on public.venture_applications;
create policy "Applicants update own applications"
on public.venture_applications
for update
to authenticated
using (applicant_id = auth.uid())
with check (
  applicant_id = auth.uid()
  and status in ('cancelled', 'accepted', 'declined')
);
create or replace function public.venture_applications_guard_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.applicant_id is distinct from old.applicant_id
     or new.venture_id is distinct from old.venture_id
     or new.id is distinct from old.id then
    raise exception 'applicant_id, venture_id and id cannot be changed';
  end if;
  if auth.uid() is null then
    return new;
  end if;
  if public.is_venture_host(new.venture_id, auth.uid()) then
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'cancelled' then
      null;
    elsif old.status = 'invited' and new.status in ('accepted', 'declined') then
      null;
    else
      raise exception
        'applicants cannot move an application from % to %', old.status, new.status
        using hint = 'Only the host can accept or reject an application.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_venture_applications_guard on public.venture_applications;
create trigger trg_venture_applications_guard
before update on public.venture_applications
for each row execute function public.venture_applications_guard_immutable_fields();
create index if not exists follows_followee_idx on public.follows(followee_id);
create index if not exists likes_user_idx on public.likes(user_id);
create index if not exists shares_post_idx on public.shares(post_id);
create index if not exists blocks_blocked_idx on public.blocks(blocked_id);
create index if not exists profiles_tribe_ids_gin on public.profiles using gin(tribe_ids);
create index if not exists profiles_created_idx on public.profiles(created_at desc);
create index if not exists posts_tribe_created_idx on public.posts(tribe_id, created_at desc);
create index if not exists posts_author_created_idx on public.posts(author_id, created_at desc);
create extension if not exists pg_trgm;
create index if not exists profiles_display_name_trgm
  on public.profiles using gin(display_name gin_trgm_ops);
create index if not exists profiles_handle_trgm
  on public.profiles using gin(handle gin_trgm_ops);
create index if not exists profiles_city_trgm
  on public.profiles using gin(city gin_trgm_ops);
create or replace function public.dispatch_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  dispatch_url text;
  dispatch_secret text;
begin
  select decrypted_secret into dispatch_url
  from vault.decrypted_secrets
  where name = 'push_dispatch_url'
  limit 1;
  if dispatch_url is null or length(trim(dispatch_url)) = 0 then
    raise log '[push] push_dispatch_url is not set in Vault; skipping dispatch for notification %', new.id;
    return new;
  end if;
  select decrypted_secret into dispatch_secret
  from vault.decrypted_secrets
  where name = 'push_dispatch_secret'
  limit 1;
  if dispatch_secret is null or length(trim(dispatch_secret)) = 0 then
    raise log '[push] push_dispatch_secret is not set in Vault; skipping dispatch for notification %', new.id;
    return new;
  end if;
  perform net.http_post(
    url := dispatch_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-push-secret', dispatch_secret
    )
  );
  return new;
exception when others then
  raise log '[push] dispatch failed for notification %: % (%)', new.id, sqlerrm, sqlstate;
  return new;
end;
$func$;
revoke all on function public.dispatch_push_for_notification() from public;
revoke all on function public.dispatch_push_for_notification() from anon;
revoke all on function public.dispatch_push_for_notification() from authenticated;
create or replace function public.has_blocked(_viewer uuid, _target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _viewer = auth.uid()
    and exists (
      select 1
      from public.blocks
      where (blocker_id = _viewer and blocked_id = _target)
         or (blocker_id = _target and blocked_id = _viewer)
    )
$$;
revoke execute on function public.has_blocked(uuid, uuid) from public, anon;
grant execute on function public.has_blocked(uuid, uuid) to authenticated;
drop policy if exists "Posts visible by audience and not blocked" on public.posts;
create policy "Posts visible by audience and not blocked"
on public.posts
for select
to authenticated
using (
  not public.has_blocked(auth.uid(), author_id)
  and (
    author_id = auth.uid()
    or audience = 'all'
    or (
      audience = 'tribe'
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and posts.tribe_id = any (p.tribe_ids)
      )
    )
  )
);
drop policy if exists "Comments visible if post visible and author not blocked" on public.comments;
create policy "Comments visible if post visible and author not blocked"
on public.comments
for select
to authenticated
using (
  not public.has_blocked(auth.uid(), author_id)
  and exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and (
        p.author_id = auth.uid()
        or p.audience = 'all'
        or (
          p.audience = 'tribe'
          and exists (
            select 1
            from public.profiles pr
            where pr.id = auth.uid()
              and p.tribe_id = any (pr.tribe_ids)
          )
        )
      )
  )
);
drop policy if exists "Senders insert messages" on public.messages;
create policy "Senders insert messages"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and not public.has_blocked(auth.uid(), recipient_id)
);
update public.posts
set image_url = split_part(image_url, '/storage/v1/object/public/post-images/', 2)
where image_url like '%/storage/v1/object/public/post-images/%';
drop policy if exists "Post images are publicly readable" on storage.objects;
drop policy if exists "Owners list own post-image files" on storage.objects;
drop policy if exists "Users read accessible post images" on storage.objects;
create policy "Users read accessible post images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'post-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.posts p
      where p.image_url = storage.objects.name
    )
  )
);
create or replace function public.enforce_post_image_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.image_url is not null
     and (tg_op = 'INSERT' or new.image_url is distinct from old.image_url)
     and new.image_url !~ ('^' || new.author_id::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'post images must be stored in the author''s post-images prefix';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_post_image_owner on public.posts;
create trigger enforce_post_image_owner
before insert or update of image_url on public.posts
for each row execute function public.enforce_post_image_owner();
drop policy if exists "Participants delete own messages" on public.messages;
drop policy if exists "Senders delete own messages" on public.messages;
create policy "Senders delete own messages"
on public.messages
for delete
to authenticated
using (auth.uid() = sender_id);
create or replace function public.is_venture_scope_visible(
  _venture_id uuid,
  _viewer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _viewer_id = auth.uid()
    and exists (
      select 1
      from public.ventures v
      where v.id = _venture_id
        and (
          v.scope = 'all'
          or (
            v.scope = 'mine'
            and exists (
              select 1
              from public.profiles host
              join public.profiles viewer on viewer.id = _viewer_id
              where host.id = v.user_id
                and host.tribe_ids && viewer.tribe_ids
            )
          )
        )
    )
$$;
revoke execute on function public.is_venture_scope_visible(uuid, uuid) from public, anon;
grant execute on function public.is_venture_scope_visible(uuid, uuid) to authenticated;
drop policy if exists "Users read open or related ventures" on public.ventures;
create policy "Users read open or related ventures"
on public.ventures
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_venture_application(id, auth.uid())
  or (
    status = 'open'
    and public.is_venture_scope_visible(id, auth.uid())
  )
);
drop policy if exists "Users apply to open ventures" on public.venture_applications;
create policy "Users apply to open ventures"
on public.venture_applications
for insert
to authenticated
with check (
  applicant_id = auth.uid()
  and status = 'pending'
  and not public.is_venture_host(venture_id, auth.uid())
  and public.is_venture_joinable(venture_id)
  and public.is_venture_scope_visible(venture_id, auth.uid())
);
alter table public.reports
  add column if not exists reporter_deleted_at timestamptz,
  add column if not exists target_deleted_at timestamptz;
alter table public.reports
  alter column reporter_id drop not null;
alter table public.reports
  drop constraint if exists reports_reporter_id_fkey;
alter table public.reports
  add constraint reports_reporter_id_fkey
  foreign key (reporter_id)
  references public.profiles(id)
  on delete set null;
create or replace function public.mark_reports_for_deleted_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reports
  set reporter_deleted_at = coalesce(reporter_deleted_at, now())
  where reporter_id = old.id;
  update public.reports r
  set target_deleted_at = coalesce(r.target_deleted_at, now())
  where r.target_deleted_at is null
    and (
      (r.target_kind = 'user' and r.target_id = old.id::text)
      or (
        r.target_kind = 'post'
        and exists (
          select 1
          from public.posts p
          where p.id::text = r.target_id
            and p.author_id = old.id
        )
      )
      or (
        r.target_kind = 'comment'
        and exists (
          select 1
          from public.comments c
          where c.id::text = r.target_id
            and c.author_id = old.id
        )
      )
    );
  return old;
end;
$$;
revoke all on function public.mark_reports_for_deleted_profile() from public;
revoke execute on function public.mark_reports_for_deleted_profile() from anon, authenticated;
drop trigger if exists mark_reports_before_profile_delete on public.profiles;
create trigger mark_reports_before_profile_delete
before delete on public.profiles
for each row execute function public.mark_reports_for_deleted_profile();
alter table public.profiles
  add column if not exists date_of_birth date,
  add column if not exists adult_verified_at timestamptz,
  add column if not exists age_verification_locked_at timestamptz;
create or replace function public.age_in_years(value date)
returns integer
language sql
stable
set search_path = public
as $$
  select extract(year from age(current_date, value))::integer
$$;
revoke all on function public.age_in_years(date) from public;
grant execute on function public.age_in_years(date) to authenticated, service_role;
create or replace function public.apply_profile_age_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  years integer;
begin
  if new.date_of_birth is distinct from old.date_of_birth then
    if old.date_of_birth is not null then
      raise exception 'Date of birth cannot be changed after verification';
    end if;
    if new.date_of_birth is null
      or new.date_of_birth > current_date
      or new.date_of_birth < (current_date - interval '120 years')::date then
      raise exception 'Invalid date of birth';
    end if;
    years := public.age_in_years(new.date_of_birth);
    if years >= 21 then
      new.age := years;
      new.adult_verified_at := now();
      new.age_verification_locked_at := null;
    else
      new.age := null;
      new.adult_verified_at := null;
      new.age_verification_locked_at := now();
    end if;
  elsif new.age is distinct from old.age
    or new.adult_verified_at is distinct from old.adult_verified_at
    or new.age_verification_locked_at is distinct from old.age_verification_locked_at then
    raise exception 'Age verification fields cannot be edited directly';
  end if;
  return new;
end;
$$;
revoke all on function public.apply_profile_age_verification() from public;
revoke execute on function public.apply_profile_age_verification() from anon, authenticated;
drop trigger if exists apply_profile_age_verification_before_update on public.profiles;
create trigger apply_profile_age_verification_before_update
before update on public.profiles
for each row execute function public.apply_profile_age_verification();
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dob_text text;
  dob date;
  years integer;
begin
  dob_text := nullif(new.raw_user_meta_data->>'date_of_birth', '');
  if dob_text is not null then
    begin
      dob := dob_text::date;
    exception when others then
      raise exception 'Invalid date of birth';
    end;
    if dob > current_date or dob < (current_date - interval '120 years')::date then
      raise exception 'Invalid date of birth';
    end if;
    years := public.age_in_years(dob);
  end if;
  insert into public.profiles (
    id,
    display_name,
    date_of_birth,
    age,
    adult_verified_at,
    age_verification_locked_at
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    dob,
    case when years >= 21 then years else null end,
    case when years >= 21 then now() else null end,
    case when years is not null and years < 21 then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
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
  )
$$;
revoke all on function public.is_verified_adult(uuid) from public;
revoke execute on function public.is_verified_adult(uuid) from anon;
grant execute on function public.is_verified_adult(uuid) to authenticated, service_role;
create or replace function public.require_verified_adult()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_verified_adult(auth.uid()) then
    raise exception 'Adult verification is required';
  end if;
  return new;
end;
$$;
revoke all on function public.require_verified_adult() from public;
revoke execute on function public.require_verified_adult() from anon, authenticated;
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'posts',
    'comments',
    'messages',
    'tribe_messages',
    'ventures',
    'venture_applications',
    'venture_messages'
  ] loop
    execute format('drop trigger if exists require_adult_before_write on public.%I', table_name);
    execute format(
      'create trigger require_adult_before_write before insert or update on public.%I for each row execute function public.require_verified_adult()',
      table_name
    );
  end loop;
end
$$;
drop policy if exists "Only verified adults read profiles" on public.profiles;
create policy "Only verified adults read profiles"
on public.profiles as restrictive
for select to authenticated
using (id = auth.uid() or public.is_verified_adult(auth.uid()));
drop policy if exists "Only verified adults read posts" on public.posts;
create policy "Only verified adults read posts"
on public.posts as restrictive
for select to authenticated
using (public.is_verified_adult(auth.uid()));
drop policy if exists "Only verified adults read comments" on public.comments;
create policy "Only verified adults read comments"
on public.comments as restrictive
for select to authenticated
using (public.is_verified_adult(auth.uid()));
drop policy if exists "Only verified adults read messages" on public.messages;
create policy "Only verified adults read messages"
on public.messages as restrictive
for select to authenticated
using (public.is_verified_adult(auth.uid()));
drop policy if exists "Only verified adults read Tribe chat" on public.tribe_messages;
create policy "Only verified adults read Tribe chat"
on public.tribe_messages as restrictive
for select to authenticated
using (public.is_verified_adult(auth.uid()));
drop policy if exists "Only verified adults read Ventures" on public.ventures;
create policy "Only verified adults read Ventures"
on public.ventures as restrictive
for select to authenticated
using (public.is_verified_adult(auth.uid()));
drop policy if exists "Only verified adults read Venture applications" on public.venture_applications;
create policy "Only verified adults read Venture applications"
on public.venture_applications as restrictive
for select to authenticated
using (public.is_verified_adult(auth.uid()));
drop policy if exists "Only verified adults read Venture chat" on public.venture_messages;
create policy "Only verified adults read Venture chat"
on public.venture_messages as restrictive
for select to authenticated
using (public.is_verified_adult(auth.uid()));
drop policy if exists "Only verified adults upload social images" on storage.objects;
create policy "Only verified adults upload social images"
on storage.objects as restrictive
for insert to authenticated
with check (
  bucket_id not in ('avatars', 'post-images', 'tribe-chat-attachments')
  or public.is_verified_adult(auth.uid())
);
with counts as (
  select
    p.id,
    coalesce(l.total, 0)::integer as likes_count,
    coalesce(c.total, 0)::integer as replies_count,
    coalesce(s.total, 0)::integer as shares_count
  from public.posts p
  left join (
    select post_id, count(*) as total from public.likes group by post_id
  ) l on l.post_id = p.id
  left join (
    select post_id, count(*) as total from public.comments group by post_id
  ) c on c.post_id = p.id
  left join (
    select post_id, count(*) as total from public.shares group by post_id
  ) s on s.post_id = p.id
)
update public.posts p
set
  likes_count = counts.likes_count,
  replies_count = counts.replies_count,
  shares_count = counts.shares_count
from counts
where p.id = counts.id;
create or replace function public.sync_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set likes_count = likes_count + 1
    where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts
    set likes_count = greatest(likes_count - 1, 0)
    where id = old.post_id;
  end if;
  return null;
end;
$$;
create or replace function public.sync_replies_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set replies_count = replies_count + 1
    where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts
    set replies_count = greatest(replies_count - 1, 0)
    where id = old.post_id;
  end if;
  return null;
end;
$$;
create or replace function public.sync_shares_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set shares_count = shares_count + 1
    where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts
    set shares_count = greatest(shares_count - 1, 0)
    where id = old.post_id;
  end if;
  return null;
end;
$$;
revoke all on function public.sync_likes_count() from public, anon, authenticated;
revoke all on function public.sync_replies_count() from public, anon, authenticated;
revoke all on function public.sync_shares_count() from public, anon, authenticated;
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