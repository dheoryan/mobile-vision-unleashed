-- Post images may belong to tribe-only posts, so a public bucket would bypass
-- the posts table's audience and block RLS policies. Store paths in posts and
-- allow storage reads only when the corresponding post is visible.
update public.posts
set image_url = split_part(image_url, '/storage/v1/object/public/post-images/', 2)
where image_url like '%/storage/v1/object/public/post-images/%';

update storage.buckets
set public = false
where id = 'post-images';

drop policy if exists "Post images are publicly readable" on storage.objects;
drop policy if exists "Owners list own post-image files" on storage.objects;

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

-- An author may only attach a file in their own storage prefix. This closes a
-- direct-PostgREST path that could otherwise reference another user's object.
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
