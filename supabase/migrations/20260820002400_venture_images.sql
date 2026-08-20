-- VENTURE THUMBNAILS.
--
-- Hosts can attach one photo to a Venture. It is the single biggest upgrade
-- available to the swipe deck — a plan with a picture of the place reads as a
-- real invitation, a plan without one reads as a database row.
--
-- Modelled on post-images rather than avatars, and the reason matters: a
-- Venture with scope = 'mine' is Tribe-only. A public bucket would put its
-- photo on an unauthenticated URL and quietly undo that scoping, which is
-- exactly the bug 20260820000400_secure_post_images.sql fixed for posts and
-- 20260820000700 fixed for tribe chat. Same shape here, from the start.

-- ---------- 1. column ----------

alter table public.ventures
  add column if not exists image_url text;

comment on column public.ventures.image_url is
  'Object path inside the private venture-images bucket (never a public URL). Readers resolve a signed URL at render time.';

-- ---------- 2. private bucket ----------

insert into storage.buckets (id, name, public)
values ('venture-images', 'venture-images', false)
on conflict (id) do update set public = false;

-- ---------- 3. who may read a Venture's photo ----------
-- Exactly the people who may see the Venture itself. is_venture_scope_visible
-- already encodes that rule ('all' is open, 'mine' requires a shared Tribe),
-- so reuse it rather than restating the logic and letting the two drift.
--
-- The owner clause comes first so a host can still see their own photo while
-- the Venture is closed, or before any row references the object at all —
-- otherwise the upload succeeds and the preview in the compose form 404s.

drop policy if exists "Users read accessible venture images" on storage.objects;
create policy "Users read accessible venture images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'venture-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.ventures v
      where v.image_url = storage.objects.name
        and (
          v.user_id = auth.uid()
          or public.has_venture_application(v.id, auth.uid())
          or public.is_venture_scope_visible(v.id, auth.uid())
        )
    )
  )
);

drop policy if exists "Users upload own venture images" on storage.objects;
create policy "Users upload own venture images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'venture-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete own venture images" on storage.objects;
create policy "Users delete own venture images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'venture-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ---------- 4. a host may only point at their own upload ----------
-- Without this, a direct PostgREST PATCH could set image_url to another
-- user's object path. The read policy would then happily serve that object to
-- everyone who can see the Venture, because the policy's second branch only
-- checks that *some* venture references the name. Same hole post images had,
-- closed the same way.

create or replace function public.enforce_venture_image_owner()
returns trigger
language plpgsql
set search_path = public
as $$
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
create trigger enforce_venture_image_owner
before insert or update of image_url on public.ventures
for each row execute function public.enforce_venture_image_owner();

-- ---------- 5. clean the object up when the Venture goes ----------
-- Storage rows are not cascaded by the ventures foreign keys, so without this
-- a deleted Venture leaves its photo in the bucket, still readable by the
-- owner branch of the read policy, indefinitely. Deleting the storage row is
-- what actually removes the object.

create or replace function public.cleanup_venture_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.image_url is not null then
    delete from storage.objects
    where bucket_id = 'venture-images' and name = old.image_url;
  end if;
  return old;
end;
$$;

revoke all on function public.cleanup_venture_image() from public, anon, authenticated;

drop trigger if exists trg_cleanup_venture_image on public.ventures;
create trigger trg_cleanup_venture_image
after delete on public.ventures
for each row execute function public.cleanup_venture_image();

comment on function public.enforce_venture_image_owner() is
  'Stops a host pointing image_url at another user''s storage object, which the read policy would then serve to everyone who can see the Venture.';
