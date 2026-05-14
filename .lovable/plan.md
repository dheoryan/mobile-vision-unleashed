# Phased Migration Plan

Backend (DB schema, RLS, storage buckets, auth routes, AuthProvider) is already in place. Remaining work is split into 4 approve-one-at-a-time phases. After each phase you can stop, test, and decide whether to continue — keeping spend under control.

---

## Phase 1 — Auth gating + Profiles persistence

**Goal:** Users actually sign up / log in, and the onboarding profile (display name, handle, age, city, bio, avatar emoji, tribe selection) is saved to the `profiles` table instead of localStorage.

- Add `_authenticated` pathless layout route that redirects to `/login` when no session.
- Move `/`, `/notifications`, `/profile`, etc. under `_authenticated`.
- Server fns: `getMyProfile`, `updateMyProfile`, `joinTribe`, `leaveTribe` (tribe limit already enforced by DB trigger).
- Refactor `Onboarding` and profile screens to read/write via these server fns.
- One-shot migration: on first authenticated load, push existing `localStorage["mutuals.profile"]` through `updateMyProfile`, then clear the key.

**Stop point:** You can sign up, complete onboarding, log out, log back in from another browser, and see the same profile. Posts/comments still localStorage.

---

## Phase 2 — Posts + Comments persistence

**Goal:** Posts and comments live in the DB.

- Server fns: `listFeed`, `getPost`, `createPost`, `editPost`, `deletePost`, `listComments`, `addComment`, `deleteComment`.
- Refactor `PostCard`, `ComposerModal`, `CommentsModal`, feed (`routes/index.tsx`) to use `useQuery` / `useMutation` against new fns. Keep optimistic UI.
- Drop mock posts; seed a few via SQL so the feed isn't empty for new users.

**Stop point:** Posts and comments survive logout/login and are visible across browsers.

---

## Phase 3 — Social actions (likes, follows, blocks, reports)

**Goal:** All social interactions persisted.

- Server fns: `toggleLike`, `toggleFollow`, `blockUser`, `unblockUser`, `reportContent`.
- Wire like/follow/block/report buttons to mutations; counts come from `posts.likes_count` / `replies_count` (already maintained by DB triggers).
- Notifications screen reads from real follows/likes/comments instead of mocks.

**Stop point:** Like/follow/block survive across sessions; blocked users disappear from feed (RLS already enforces this).

---

## Phase 4 — Image uploads (avatars + post images)

**Goal:** Real image upload to storage buckets.

- Avatar upload → `avatars` bucket, write returned public URL into `profiles.avatar_url`. Display avatar everywhere (feed, comments, profile, notifications).
- Post image upload → `post-images` bucket, write URL into `posts.image_url`.
- RLS on buckets scoped to `auth.uid()` folder prefix.

**Stop point:** Full feature parity with the localStorage version, fully persisted, multi-device.

---

## Technical notes

- Server fns live in `src/lib/*.functions.ts` and use `requireSupabaseAuth` middleware (already wired via `attachSupabaseAuth` in `src/start.ts`).
- All DB tables, RLS policies, triggers, and storage buckets are already created — no further migrations needed unless something surfaces during implementation.
- After each phase: run `security--run_security_scan` and verify in two browsers.

## Out of scope

Realtime subscriptions, Stripe billing for Plus plan, persisted DMs.

---

**Reply with which phase to start (e.g. "Phase 1") and I'll implement just that one.**