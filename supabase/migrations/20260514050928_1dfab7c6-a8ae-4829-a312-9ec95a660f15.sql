-- 1. search_path on triggers
alter function public.enforce_tribe_limit() set search_path = public;
alter function public.bump_replies_count() set search_path = public;
alter function public.bump_likes_count() set search_path = public;

-- 2. Lock down has_blocked to authenticated only
revoke execute on function public.has_blocked(uuid, uuid) from public, anon;
grant execute on function public.has_blocked(uuid, uuid) to authenticated;

-- 3. Replace broad public storage SELECT policies with object-owner listing.
--    Files remain publicly readable via getPublicUrl (buckets are public),
--    but directory enumeration is restricted.
drop policy if exists "Public read avatars" on storage.objects;
drop policy if exists "Public read post images" on storage.objects;

create policy "Owners list own avatar files"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owners list own post-image files"
  on storage.objects for select to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
