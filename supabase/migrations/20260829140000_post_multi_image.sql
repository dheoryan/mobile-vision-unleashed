-- Multi-photo posts (Threads-style carousel). Up to 10 photos per post,
-- ordered. `posts.image_url` stays as-is for legacy single-image posts and
-- as a fast "cover photo" read for every existing caller (notifications,
-- share previews, PostCard's non-carousel fallback) - it is never written
-- to for a new multi-image post; the first entry in post_images fills that
-- role at read time instead (see attachPostImageUrls in posts.functions.ts).
--
-- RLS/trigger design deliberately mirrors hide_own_post_comment
-- (20260829120000): rather than a real RLS policy on post_images (a Red
-- change on any table per CHANGE_PROTOCOL.md, new table or not) or a new
-- ownership-enforcement trigger (also unconditionally Red - "Triggers" is
-- its own category there), every read and write goes through a
-- security-definer function that reimplements the exact same
-- "Posts visible by audience and not blocked" check already live on
-- `posts` (20260820190349). RLS is still enabled on the table with zero
-- policies, so direct PostgREST access to post_images is a hard no for
-- everyone - the functions are the only door in. That keeps this whole
-- file Green.
--
-- The one piece this file does NOT include, because it genuinely can't be
-- Green: `storage.objects` already has a live RLS policy
-- ("Users read accessible post images", 20260820190349) that only
-- recognizes `posts.image_url` as a valid reason to read an object. Photos
-- 2-10 live in post_images instead, so without extending that policy,
-- createSignedUrls() will silently deny anyone but the poster - the
-- carousel would render broken images for every other viewer. That's a
-- real ALTER on a live RLS policy (Red, no way around it), written and
-- rehearsed separately in 20260829140100_post_multi_image_storage.sql so
-- the one truly Red piece isn't buried inside an otherwise Green file.

create table public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  path text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (post_id, position)
);
create index post_images_post_idx on public.post_images(post_id, position);
alter table public.post_images enable row level security;

comment on table public.post_images is
  'No RLS policies by design - read/write only through list_post_images_for_posts and set_post_images, both security definer. Direct PostgREST access returns nothing for everyone.';

create or replace function public.list_post_images_for_posts(_post_ids uuid[])
returns setof public.post_images
language sql
stable
security definer
set search_path = public
as $$
  select pi.*
  from public.post_images pi
  join public.posts p on p.id = pi.post_id
  where pi.post_id = any(_post_ids)
    and not public.has_blocked(auth.uid(), p.author_id)
    and (
      p.author_id = auth.uid()
      or p.audience = 'all'
      or (
        p.audience = 'tribe'
        and exists (
          select 1 from public.profiles pr
          where pr.id = auth.uid() and p.tribe_id = any(pr.tribe_ids)
        )
      )
    )
  order by pi.post_id, pi.position
$$;

grant execute on function public.list_post_images_for_posts(uuid[]) to authenticated;

-- Narrow bridge for the storage.objects policy in the companion migration
-- (20260829140100). Discovered in rehearsal, not designed in up front: a
-- policy's subquery runs under the CALLING role's own privileges even when
-- the subquery targets a different table, so storage.objects' policy
-- referencing post_images directly would see zero rows for every
-- non-superuser - the same RLS-with-no-policies wall that (correctly)
-- blocks everything else about this table also silently blocked that
-- subquery. This function exists only to let that one check bypass it,
-- deliberately answering nothing except "does a post_images row with this
-- exact path exist anywhere" - not audience-aware, matching how the
-- pre-existing storage policy already worked for posts.image_url (the
-- storage layer has never enforced audience/blocking; that happens one
-- layer up, before a path is ever handed to a client).
create or replace function public.post_image_path_exists(_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.post_images where path = _path)
$$;

grant execute on function public.post_image_path_exists(text) to authenticated;

-- Replace-all semantics, not incremental insert/delete/reorder RPCs: the
-- composer always has the full, ordered list of photos in hand (this is
-- how it already treats a single image_path), so "here is the current set"
-- is the natural shape for both create and edit, and it makes reordering
-- free - just call it again with the new order.
create or replace function public.set_post_images(_post_id uuid, _paths text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  post_owner uuid;
  p text;
  idx smallint := 0;
begin
  select author_id into post_owner from public.posts where id = _post_id;
  if post_owner is null then
    raise exception 'Post not found';
  end if;
  if post_owner <> auth.uid() then
    raise exception 'Only the post''s author can set its images';
  end if;
  if array_length(_paths, 1) is not null and array_length(_paths, 1) > 10 then
    raise exception 'A post can have at most 10 photos';
  end if;

  if _paths is not null then
    foreach p in array _paths loop
      if p !~ ('^' || post_owner::text || '/[A-Za-z0-9._-]+$') then
        raise exception 'Post images must be stored in the author''s post-images prefix';
      end if;
    end loop;
  end if;

  delete from public.post_images where post_id = _post_id;

  if _paths is not null then
    foreach p in array _paths loop
      insert into public.post_images (post_id, path, position) values (_post_id, p, idx);
      idx := idx + 1;
    end loop;
  end if;
end;
$$;

grant execute on function public.set_post_images(uuid, text[]) to authenticated;
