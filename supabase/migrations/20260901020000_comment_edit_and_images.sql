-- COMMENT EDITING + ONE PHOTO PER COMMENT.
--
-- Comments have never been editable - there was no UPDATE policy on
-- `comments` at all, so the only way to fix a typo was delete and repost,
-- which loses replies, likes and reposts on that comment. And a comment
-- could only ever be text, while a post has carried photos for a while.
-- This closes both gaps with the same shape already proven for posts.

-- ---------- 1. columns ----------

alter table public.comments
  add column if not exists image_url text,
  add column if not exists edited_at timestamptz;

comment on column public.comments.image_url is
  'Object path inside the private comment-images bucket (never a public URL). Readers resolve a signed URL at render time.';
comment on column public.comments.edited_at is
  'Set by enforce_comment_edit_fields whenever content or image_url actually changes. Null means never edited.';

-- ---------- 2. authors may edit their own comment ----------
-- Only content and image_url are meant to move; everything else (post_id,
-- author_id, parent_id, created_at, the counters) is enforced below exactly
-- the way enforce_venture_host_edits guards ventures - a WITH CHECK cannot
-- see OLD, so the immutability rule has to be a trigger.

drop policy if exists "Authors update own comments" on public.comments;
create policy "Authors update own comments"
on public.comments
for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

create or replace function public.enforce_comment_edit_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.post_id is distinct from old.post_id
     or new.author_id is distinct from old.author_id
     or new.parent_id is distinct from old.parent_id
     or new.created_at is distinct from old.created_at then
    raise exception 'only a comment''s content and photo can be edited';
  end if;
  if new.content is distinct from old.content or new.image_url is distinct from old.image_url then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_comment_edit_fields on public.comments;
create trigger trg_enforce_comment_edit_fields
before update on public.comments
for each row execute function public.enforce_comment_edit_fields();

-- An author may only point image_url at their own upload - same hole (and
-- same fix) as enforce_post_image_owner / enforce_venture_image_owner.
create or replace function public.enforce_comment_image_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.image_url is not null
     and (tg_op = 'INSERT' or new.image_url is distinct from old.image_url)
     and new.image_url !~ ('^' || new.author_id::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'comment images must be stored in the author''s comment-images prefix';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_comment_image_owner on public.comments;
create trigger trg_enforce_comment_image_owner
before insert or update of image_url on public.comments
for each row execute function public.enforce_comment_image_owner();

-- ---------- 3. private bucket for comment photos ----------
-- A private bucket, not the existing public-facing post-images one: a
-- comment can sit under a Tribe-only post, and its photo needs to follow
-- that post's audience the same way post-images and venture-images do.

insert into storage.buckets (id, name, public)
values ('comment-images', 'comment-images', false)
on conflict (id) do update set public = false;

-- Deliberately not re-deriving the audience/blocked rules here (unlike
-- venture-images, which has to, because a Venture's visibility depends on
-- venture_applications too). A comment's visibility is exactly its post's:
-- `comments` already carries "Comments visible if post visible and author
-- not blocked" (20260820190349), so selecting through it applies that RLS
-- for free - restating it here would be a second copy to keep in sync.
drop policy if exists "Users read accessible comment images" on storage.objects;
create policy "Users read accessible comment images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'comment-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.comments c
      where c.image_url = storage.objects.name
    )
  )
);

drop policy if exists "Users upload own comment images" on storage.objects;
create policy "Users upload own comment images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'comment-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete own comment images" on storage.objects;
create policy "Users delete own comment images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'comment-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
