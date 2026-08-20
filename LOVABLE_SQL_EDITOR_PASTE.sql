-- ============================================================
-- PASTE THIS INTO THE LOVABLE CLOUD SQL EDITOR
-- ============================================================
--
-- WHAT THIS IS
--   Lovable already applied every one of our 24 migrations to production,
--   squashed into three files (20260820190349 / 190504 / 190650). We verified
--   that replay byte-for-byte against a local rebuild: every table, column,
--   function body, policy expression, trigger, constraint and index matches.
--
--   It missed exactly one thing: nothing in the squash touches storage.buckets.
--
-- WHY IT MATTERS
--   A Supabase bucket with public = true is served from an unauthenticated CDN
--   path that never consults RLS. The storage policies WERE replayed, so the
--   dashboard looks correct — while the files stay readable by anyone with the
--   URL. Right now that means every post image and every tribe-chat attachment
--   on production is world-readable, and venture thumbnails have nowhere to go.
--
-- SAFETY
--   Three statements. No row in any user table is read, written or deleted.
--   Safe to run twice.
--
-- ============================================================

-- ---------- STEP 1: look before you touch ----------
-- Run this on its own first. Expect post-images and tribe-chat-attachments to
-- come back `true`, and venture-images to be missing entirely.

select id, name, public
from storage.buckets
order by id;


-- ---------- STEP 2: the fix ----------

update storage.buckets
set public = false
where id = 'post-images'
  and public is distinct from false;

update storage.buckets
set public = false
where id = 'tribe-chat-attachments'
  and public is distinct from false;

insert into storage.buckets (id, name, public)
values ('venture-images', 'venture-images', false)
on conflict (id) do update set public = false;


-- ---------- STEP 3: confirm ----------
-- All three must now read `false`. `avatars` stays public on purpose.

select id, public
from storage.buckets
where id in ('post-images', 'tribe-chat-attachments', 'venture-images')
order by id;


-- ============================================================
-- STEP 4 (separate, read-only): confirm the rest of the replay landed
-- ============================================================
-- Every one of these should come back `true`. If any is false, that part of
-- the squash did not apply and we should look at it before launch.

select
  (select count(*) from information_schema.tables
     where table_schema = 'public'
       and table_name in ('hellos','profile_locations','app_settings',
                          'moderators','moderation_actions',
                          'blocked_content_patterns')) = 6
    as new_tables_present,

  -- the adult gate must be OFF, or every unverified user loses seven tables
  public.adult_gate_enabled() = false
    as adult_gate_is_inert,

  -- with the gate off, anybody passes; this is the check that says users can
  -- still see the app
  public.is_verified_adult(gen_random_uuid()) = true
    as unverified_users_still_work,

  -- the venture self-accept fix: exactly one applicant UPDATE policy, plus the
  -- trigger that actually enforces the transition rules
  (select count(*) from pg_policies
     where tablename = 'venture_applications' and cmd = 'UPDATE') = 2
    as venture_update_policies_collapsed,
  (select count(*) from pg_trigger
     where tgname = 'trg_venture_applications_guard') = 1
    as venture_guard_trigger_present,

  -- the capacity race fix depends on this row lock existing
  (select position('for update' in lower(prosrc)) > 0
     from pg_proc where proname = 'enforce_venture_capacity')
    as venture_row_lock_present,

  -- and the clamp that used to hide over-subscription must be gone
  (select position('least(' in lower(prosrc)) = 0
     from pg_proc where proname = 'sync_venture_slots')
    as slot_clamp_removed,

  -- local-dev-only grants must NOT be on production
  (select count(*) from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public') = 0
    as no_anon_table_grants;


-- ============================================================
-- STEP 5 (read-only): what the replay did to real rows
-- ============================================================
-- Lovable's squash ran three data-rewriting statements against live rows. This
-- does not undo anything — it just tells you what the state is now.

select
  (select count(*) from profiles)                                   as profiles,
  (select count(*) from profiles
     where coalesce(array_length(tribe_ids, 1), 0) > 1)             as still_multi_tribe,  -- expect 0
  (select count(*) from tribe_members)                              as tribe_member_rows,  -- was 52
  (select count(*) from profiles where adult_verified_at is null)   as unverified,
  (select count(*) from posts where image_url like 'http%')         as posts_with_old_urls, -- expect 0
  (select count(*) from venture_applications where status = 'rejected')
                                                                    as auto_rejected,
  (select count(*) from ventures where filled_slots > max_slots)    as oversubscribed;      -- expect 0
