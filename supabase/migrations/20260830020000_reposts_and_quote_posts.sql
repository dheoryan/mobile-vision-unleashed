-- Repost + quote-post system.
--
-- A plain repost is a toggle row in `reposts` (identical shape to `likes`/
-- `shares`) that bumps `posts.reposts_count` and notifies the original
-- author - it never creates a new post. A quote-post is the opposite: it IS
-- a normal `posts` row (created through the existing createPost path) that
-- happens to carry `quoted_post_id`, so it automatically inherits every
-- existing post capability (likes, comments, deletion, moderation, feed
-- inclusion) for free. `on delete set null` on that column is deliberate -
-- deleting the original must never destroy the quoting user's own post; the
-- app renders a "post unavailable" placeholder once the join comes back
-- null instead.
--
-- Whether a quote's own audience may be wider than the post it quotes (so a
-- tribe-only post can't be quoted out into "everyone") is enforced in the
-- createPost server function, not here - matching how every other field on
-- posts.insert (including tribe_id/audience themselves) is already only
-- validated at the server-function layer, not by additional RLS.

-- 1. reposts table (mirrors likes/shares exactly)
create table public.reposts (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.reposts enable row level security;

create policy "Reposts visible to authenticated"
  on public.reposts for select to authenticated using (true);

create policy "Users repost as themselves"
  on public.reposts for insert to authenticated with check (user_id = auth.uid());

create policy "Users unrepost their own"
  on public.reposts for delete to authenticated using (user_id = auth.uid());

create index reposts_post_idx on public.reposts(post_id);
create index reposts_user_created_idx on public.reposts(user_id, created_at desc);

-- 2. reposts_count on posts - trigger-maintained only, never written by app code
alter table public.posts add column reposts_count integer not null default 0;

-- security definer is required, not decorative: `posts`' own UPDATE policy
-- only allows a post's author to update their row, so a reposter (who is
-- essentially never the author) would otherwise have this update silently
-- dropped by RLS - Postgres reports "UPDATE 0", not an error, so this is
-- easy to miss without a rehearsal that actually impersonates a second
-- user. Confirmed by direct testing during this migration's rehearsal.
create or replace function public.bump_reposts_count()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set reposts_count = reposts_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set reposts_count = greatest(reposts_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

revoke execute on function public.bump_reposts_count() from public, anon, authenticated;

create trigger reposts_bump_count
after insert or delete on public.reposts
for each row execute function public.bump_reposts_count();

-- 3. quote-posts: a post referencing another post it quotes.
--
-- Deliberately NOT a foreign key. A real FK would force a choice between
-- `on delete cascade` (deleting the original destroys the quoting user's own
-- post - not acceptable) or `on delete set null` (which erases the id the
-- moment it's needed, since the whole point is rendering "this post is no
-- longer available" - a plain FK cannot express "let the parent be deleted
-- and leave the child's value exactly as it was"). A bare uuid with no
-- referential-integrity enforcement is what "the quote stays standing" and
-- "the id survives so the app can render the placeholder" actually requires.
-- createPost validates the id exists at creation time; after that, if the
-- lookup in hydratePosts comes back empty, that itself IS the "unavailable"
-- signal.
alter table public.posts add column quoted_post_id uuid;

create index posts_quoted_post_idx on public.posts(quoted_post_id) where quoted_post_id is not null;

-- 4. Notify the original author on repost and on quote
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array[
    'like','comment','reply','mention','follow','message','new_post',
    'venture_apply','venture_invite','venture_accept','venture_message',
    'tribe_join','hello','hello_accepted','tribe_pulse','repost','quote'
  ]));

create or replace function public.notify_on_repost()
returns trigger language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  select author_id into author from public.posts where id = new.post_id;
  if author is not null and author <> new.user_id then
    insert into public.notifications (user_id, actor_id, kind, post_id)
    values (author, new.user_id, 'repost', new.post_id);
  end if;
  return null;
end;
$$;

-- post_id on this notification points at the new quote post itself (not the
-- quoted original) - tapping "X quoted your post" should open X's quote,
-- which shows your original embedded inside it, same as the like/comment
-- notifications open the post those actions happened on.
create or replace function public.notify_on_quote_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare quoted_author uuid;
begin
  if new.quoted_post_id is null then
    return null;
  end if;
  select author_id into quoted_author from public.posts where id = new.quoted_post_id;
  if quoted_author is not null and quoted_author <> new.author_id then
    insert into public.notifications (user_id, actor_id, kind, post_id)
    values (quoted_author, new.author_id, 'quote', new.id);
  end if;
  return null;
end;
$$;

revoke execute on function public.notify_on_repost() from public, anon, authenticated;
revoke execute on function public.notify_on_quote_post() from public, anon, authenticated;

drop trigger if exists trg_notify_on_repost on public.reposts;
create trigger trg_notify_on_repost after insert on public.reposts
for each row execute function public.notify_on_repost();

drop trigger if exists trg_notify_on_quote_post on public.posts;
create trigger trg_notify_on_quote_post after insert on public.posts
for each row execute function public.notify_on_quote_post();

-- 5. Realtime (matches shares' treatment)
alter table public.reposts replica identity full;
alter publication supabase_realtime add table public.reposts;
