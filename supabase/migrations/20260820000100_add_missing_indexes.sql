-- Indexes for columns that are filtered, ordered or joined on in hot paths but
-- were previously unindexed. Each entry names the query it fixes.
--
-- NOTE ON LOCKING: these are plain CREATE INDEX, which takes an ACCESS EXCLUSIVE
-- lock for the duration of the build. That is fine here because the tables are
-- small pre-launch. If you apply this to a database that already has meaningful
-- volume, run each statement as CREATE INDEX CONCURRENTLY from a psql session
-- instead — CONCURRENTLY cannot run inside a migration's transaction block.

-- ---------- foreign-key / lookup columns that only had a composite PK ----------

-- follows PK is (follower_id, followee_id), so followee_id alone was unindexed.
-- Fixes: notify_followers_on_post, which runs on EVERY post insert and was
-- sequential-scanning the whole follows table; getFollowCounts (followers);
-- fetchConnectionIds. Also an unindexed FK cascade target on account deletion.
create index if not exists follows_followee_idx on public.follows(followee_id);

-- likes PK is (post_id, user_id) — user_id alone was unindexed.
-- Fixes listMyLikes, which runs on every page load. Also a cascade target.
create index if not exists likes_user_idx on public.likes(user_id);

-- shares PK is (user_id, post_id) — the mirror image.
-- Fixes getPostCount(shares) and the sync_shares_count trigger, which was
-- sequential-scanning shares on every share toggle. Also a cascade target.
create index if not exists shares_post_idx on public.shares(post_id);

-- The comments SELECT policy ORs on b.blocked_id = auth.uid(), evaluated per
-- comment row against an unindexed column.
create index if not exists blocks_blocked_idx on public.blocks(blocked_id);

-- ---------- array containment ----------

-- profiles.tribe_ids had no index at all. Fixes getTribeMemberCounts (up to 20
-- full table scans in a single request), listVentureMatches (.overlaps), the
-- TribeScreen member list (.contains), and handle_profile_tribe_joins.
create index if not exists profiles_tribe_ids_gin on public.profiles using gin(tribe_ids);

-- ---------- ordering ----------

-- listDiscoverProfiles orders and ranges on created_at; every Discover page was
-- sorting the entire profiles table.
create index if not exists profiles_created_idx on public.profiles(created_at desc);

-- listFeed filters on tribe_id then orders by created_at. The existing
-- single-column posts(tribe_id) index still forced a sort of all that tribe's posts.
create index if not exists posts_tribe_created_idx on public.posts(tribe_id, created_at desc);

-- listMyPosts / listPostsByAuthor: same shape, on author_id.
create index if not exists posts_author_created_idx on public.posts(author_id, created_at desc);

-- ---------- search ----------

-- listDiscoverProfiles and searchMentionProfiles do OR'd ILIKE '%term%' across
-- several columns, which can never use a btree index — every debounced keystroke
-- was a sequential scan of profiles. Trigram indexes make these usable.
create extension if not exists pg_trgm;

create index if not exists profiles_display_name_trgm
  on public.profiles using gin(display_name gin_trgm_ops);
create index if not exists profiles_handle_trgm
  on public.profiles using gin(handle gin_trgm_ops);
create index if not exists profiles_city_trgm
  on public.profiles using gin(city gin_trgm_ops);
