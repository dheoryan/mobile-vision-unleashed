-- RED - review before applying, per CHANGE_PROTOCOL.md ("RLS policies -
-- create, drop, or alter, on any table"). Back up first.
--
-- Extends the live "Users read accessible post images" storage policy
-- (20260820190349) to also recognize an object referenced from
-- post_images, not just posts.image_url. Without this, createSignedUrls()
-- denies every viewer except the poster for photos 2-10 of a multi-image
-- post - the carousel would render broken images for everyone else. This
-- is additive to the existing condition (still allows the two prior
-- cases: own folder, or matching posts.image_url) - nothing that currently
-- has access loses it.
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
    or public.post_image_path_exists(storage.objects.name)
  )
);
