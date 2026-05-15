
-- Threaded replies + mentions on comments
alter table public.comments
  add column if not exists parent_id uuid references public.comments(id) on delete cascade,
  add column if not exists mentions uuid[] not null default '{}';

create index if not exists idx_comments_parent on public.comments(parent_id);
create index if not exists idx_comments_mentions on public.comments using gin(mentions);

-- Notifications table for in-app push
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  actor_id uuid,
  kind text not null check (kind in ('like','comment','reply','mention','follow','message')),
  post_id uuid,
  comment_id uuid,
  message_id uuid,
  preview text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users see own notifications" on public.notifications;
create policy "Users see own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users mark own notifications" on public.notifications;
create policy "Users mark own notifications"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users delete own notifications" on public.notifications;
create policy "Users delete own notifications"
  on public.notifications for delete
  to authenticated
  using (user_id = auth.uid());

-- Inserts happen via SECURITY DEFINER triggers; no direct INSERT policy

-- Trigger functions to fan out notifications
create or replace function public.notify_on_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  select author_id into author from public.posts where id = new.post_id;
  if author is not null and author <> new.user_id then
    insert into public.notifications (user_id, actor_id, kind, post_id)
    values (author, new.user_id, 'like', new.post_id);
  end if;
  return null;
end;
$$;

create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid; parent_author uuid; m uuid;
begin
  select author_id into author from public.posts where id = new.post_id;
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    if parent_author is not null and parent_author <> new.author_id then
      insert into public.notifications (user_id, actor_id, kind, post_id, comment_id, preview)
      values (parent_author, new.author_id, 'reply', new.post_id, new.id, left(new.content, 140));
    end if;
  end if;
  if author is not null and author <> new.author_id and (new.parent_id is null or author <> coalesce(parent_author, '00000000-0000-0000-0000-000000000000'::uuid)) then
    insert into public.notifications (user_id, actor_id, kind, post_id, comment_id, preview)
    values (author, new.author_id, 'comment', new.post_id, new.id, left(new.content, 140));
  end if;
  if new.mentions is not null then
    foreach m in array new.mentions loop
      if m <> new.author_id and m <> coalesce(author, '00000000-0000-0000-0000-000000000000'::uuid) and m <> coalesce(parent_author, '00000000-0000-0000-0000-000000000000'::uuid) then
        insert into public.notifications (user_id, actor_id, kind, post_id, comment_id, preview)
        values (m, new.author_id, 'mention', new.post_id, new.id, left(new.content, 140));
      end if;
    end loop;
  end if;
  return null;
end;
$$;

create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.followee_id <> new.follower_id then
    insert into public.notifications (user_id, actor_id, kind)
    values (new.followee_id, new.follower_id, 'follow');
  end if;
  return null;
end;
$$;

create or replace function public.notify_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.recipient_id <> new.sender_id then
    insert into public.notifications (user_id, actor_id, kind, message_id, preview)
    values (new.recipient_id, new.sender_id, 'message', new.id, left(new.content, 140));
  end if;
  return null;
end;
$$;

revoke execute on function public.notify_on_like() from public, anon, authenticated;
revoke execute on function public.notify_on_comment() from public, anon, authenticated;
revoke execute on function public.notify_on_follow() from public, anon, authenticated;
revoke execute on function public.notify_on_message() from public, anon, authenticated;

drop trigger if exists trg_notify_on_like on public.likes;
create trigger trg_notify_on_like after insert on public.likes
for each row execute function public.notify_on_like();

drop trigger if exists trg_notify_on_comment on public.comments;
create trigger trg_notify_on_comment after insert on public.comments
for each row execute function public.notify_on_comment();

drop trigger if exists trg_notify_on_follow on public.follows;
create trigger trg_notify_on_follow after insert on public.follows
for each row execute function public.notify_on_follow();

drop trigger if exists trg_notify_on_message on public.messages;
create trigger trg_notify_on_message after insert on public.messages
for each row execute function public.notify_on_message();

-- Realtime publications (ignore errors if already added)
do $$ begin
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.follows; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.comments; exception when duplicate_object then null; end;
end $$;

-- Public storage policies for avatars (bucket already public)
do $$ begin
  begin
    create policy "Authenticated upload own avatar"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  exception when duplicate_object then null; end;
  begin
    create policy "Authenticated update own avatar"
      on storage.objects for update to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  exception when duplicate_object then null; end;
  begin
    create policy "Authenticated delete own avatar"
      on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  exception when duplicate_object then null; end;
  begin
    create policy "Avatars are publicly readable"
      on storage.objects for select to public
      using (bucket_id = 'avatars');
  exception when duplicate_object then null; end;
end $$;
