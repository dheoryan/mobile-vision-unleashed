-- Comment social actions: independent likes plus feed-visible reposts.
-- RED migration: new policies, triggers, notification kinds, and a counter
-- backfill. Apply manually in Lovable/Supabase SQL Editor after a backup.

alter table public.comments
  add column likes_count integer not null default 0,
  add column reposts_count integer not null default 0;

create table public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.comment_likes enable row level security;

-- Counts are public on comments; the join rows only need to tell a viewer
-- which comments they personally liked.
create policy "Users see their own comment likes"
  on public.comment_likes for select to authenticated
  using (user_id = auth.uid());

create policy "Users like visible comments as themselves"
  on public.comment_likes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.comments c
      join public.posts p on p.id = c.post_id
      where c.id = comment_id
        and (
          p.audience = 'all'
          or exists (
            select 1
            from public.profiles viewer
            where viewer.id = auth.uid()
              and p.tribe_id = any(viewer.tribe_ids)
          )
        )
    )
  );

create policy "Users remove their own comment likes"
  on public.comment_likes for delete to authenticated
  using (user_id = auth.uid());

create index comment_likes_user_created_idx
  on public.comment_likes(user_id, created_at desc);

create or replace function public.sync_comment_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments
    set likes_count = likes_count + 1
    where id = new.comment_id;
  elsif tg_op = 'DELETE' then
    update public.comments
    set likes_count = greatest(likes_count - 1, 0)
    where id = old.comment_id;
  end if;
  return null;
end;
$$;

revoke all on function public.sync_comment_likes_count() from public, anon, authenticated;

create trigger comment_likes_count
after insert or delete on public.comment_likes
for each row execute function public.sync_comment_likes_count();

-- A comment repost is a normal post so it appears in feeds and inherits
-- post comments, moderation, likes, and deletion. Like quoted_post_id, this
-- is deliberately a bare UUID: if the source comment is later deleted, the
-- reposter's post remains and renders an unavailable-source placeholder.
alter table public.posts add column quoted_comment_id uuid;

create index posts_quoted_comment_idx
  on public.posts(quoted_comment_id)
  where quoted_comment_id is not null;

create unique index posts_author_quoted_comment_unique
  on public.posts(author_id, quoted_comment_id)
  where quoted_comment_id is not null;

-- Server validation is duplicated here because authenticated users can call
-- PostgREST directly. The invoker-mode lookup intentionally passes through
-- comments/posts RLS: a hidden or blocked source is therefore not repostable.
create or replace function public.validate_comment_repost_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  source_tribe text;
  source_audience text;
  viewer_is_member boolean;
begin
  if new.quoted_comment_id is null then
    return new;
  end if;

  select p.tribe_id, p.audience
    into source_tribe, source_audience
  from public.comments c
  join public.posts p on p.id = c.post_id
  where c.id = new.quoted_comment_id;

  if not found then
    raise exception 'Comment is not available to repost';
  end if;
  if new.audience <> source_audience then
    raise exception 'Comment repost audience must match its source post';
  end if;
  if source_audience = 'tribe' and new.tribe_id <> source_tribe then
    raise exception 'A Tribe comment must stay inside its source Tribe';
  end if;
  if source_audience = 'tribe' then
    select source_tribe = any(viewer.tribe_ids)
      into viewer_is_member
    from public.profiles viewer
    where viewer.id = auth.uid();
    if coalesce(viewer_is_member, false) is not true then
      raise exception 'Only a Tribe member can repost this comment';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_comment_repost_insert() from public, anon, authenticated;

create trigger validate_comment_repost_before_insert
before insert on public.posts
for each row execute function public.validate_comment_repost_insert();

-- A repost's source is immutable. This keeps its counter and audience
-- relationship truthful even when somebody bypasses the app and calls REST.
create or replace function public.prevent_comment_repost_source_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.quoted_comment_id is distinct from old.quoted_comment_id then
    raise exception 'A comment repost source cannot be changed';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_comment_repost_source_update() from public, anon, authenticated;

create trigger protect_comment_repost_source
before update of quoted_comment_id on public.posts
for each row execute function public.prevent_comment_repost_source_update();

create or replace function public.sync_comment_reposts_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.quoted_comment_id is not null then
    update public.comments
    set reposts_count = reposts_count + 1
    where id = new.quoted_comment_id;
  elsif tg_op = 'DELETE' and old.quoted_comment_id is not null then
    update public.comments
    set reposts_count = greatest(reposts_count - 1, 0)
    where id = old.quoted_comment_id;
  end if;
  return null;
end;
$$;

revoke all on function public.sync_comment_reposts_count() from public, anon, authenticated;

create trigger comment_reposts_count
after insert or delete on public.posts
for each row execute function public.sync_comment_reposts_count();

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array[
    'like','comment','reply','mention','follow','message','new_post',
    'venture_apply','venture_invite','venture_accept','venture_message',
    'tribe_join','hello','hello_accepted','tribe_pulse','repost','quote',
    'comment_like','comment_repost'
  ]));

create or replace function public.notify_on_comment_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  comment_author uuid;
  source_post uuid;
  comment_preview text;
begin
  select c.author_id, c.post_id, left(c.content, 160)
    into comment_author, source_post, comment_preview
  from public.comments c
  where c.id = new.comment_id;

  if comment_author is not null and comment_author <> new.user_id then
    insert into public.notifications
      (user_id, actor_id, kind, post_id, comment_id, preview)
    values
      (comment_author, new.user_id, 'comment_like', source_post, new.comment_id, comment_preview);
  end if;
  return null;
end;
$$;

create or replace function public.notify_on_comment_repost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  comment_author uuid;
  comment_preview text;
begin
  if new.quoted_comment_id is null then
    return null;
  end if;

  select c.author_id, left(c.content, 160)
    into comment_author, comment_preview
  from public.comments c
  where c.id = new.quoted_comment_id;

  if comment_author is not null and comment_author <> new.author_id then
    -- Open the new repost, which contains the source comment preview.
    insert into public.notifications (user_id, actor_id, kind, post_id, preview)
    values (comment_author, new.author_id, 'comment_repost', new.id, comment_preview);
  end if;
  return null;
end;
$$;

revoke all on function public.notify_on_comment_like() from public, anon, authenticated;
revoke all on function public.notify_on_comment_repost() from public, anon, authenticated;

create trigger trg_notify_on_comment_like
after insert on public.comment_likes
for each row execute function public.notify_on_comment_like();

create trigger trg_notify_on_comment_repost
after insert on public.posts
for each row execute function public.notify_on_comment_repost();

alter table public.comment_likes replica identity full;
alter publication supabase_realtime add table public.comment_likes;
