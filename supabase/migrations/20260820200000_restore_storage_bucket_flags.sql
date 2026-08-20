-- RESTORE THE THREE STORAGE BUCKET STATEMENTS LOVABLE'S SQUASH DROPPED.
--
-- Lovable replayed migrations 20260819000000 .. 20260820002600 into production
-- as three squashed files (20260820190349, 190504, 190650). A byte-level diff
-- of every table, column, function body, policy expression, trigger,
-- constraint and index says that replay is faithful — with one exception it
-- missed entirely: nothing in the squash touches `storage.buckets`.
--
-- The storage *policies* were all replayed. The bucket *flags* were not, and a
-- Supabase bucket with `public = true` is served from an unauthenticated CDN
-- path that never consults RLS on storage.objects. So the policies look right
-- in the dashboard while the objects stay world-readable by URL.
--
-- Concretely, without this file production is left with:
--
--   1. post-images             public = true   -> every post image readable by
--                                                anyone holding or guessing a
--                                                URL, and the bucket listable
--   2. tribe-chat-attachments  public = true   -> tribe-only chat attachments
--                                                readable by non-members
--   3. venture-images          does not exist  -> venture thumbnail uploads
--                                                fail at runtime
--
-- (1) and (2) are the exact holes 20260820000400 and 20260820000700 were
-- written to close. (3) is why 20260820002400 exists.
--
-- Idempotent on purpose: it is safe to run on local, on production, and twice.

-- ---------- 1. post images: private ----------
update storage.buckets
set public = false
where id = 'post-images'
  and public is distinct from false;

-- ---------- 2. tribe chat attachments: private ----------
update storage.buckets
set public = false
where id = 'tribe-chat-attachments'
  and public is distinct from false;

-- ---------- 3. venture thumbnails: private bucket, created if absent ----------
-- Matches 20260820002400 exactly. The read policy is scope-matched
-- (is_venture_scope_visible), so a `scope = 'mine'` Venture stays Tribe-only —
-- which a public bucket would have quietly undone.
insert into storage.buckets (id, name, public)
values ('venture-images', 'venture-images', false)
on conflict (id) do update set public = false;

-- ---------- verification ----------
-- After this runs, all three should read `f`:
--
--   select id, public from storage.buckets
--   where id in ('post-images', 'tribe-chat-attachments', 'venture-images');
