## Goal
Add 5 capabilities to Mutuals: push notifications, adjustable profile pics, threaded replies with @mentions, interactive post history on profile, and viewable user profiles.

## Scope & Approach

### 1. Push Notifications (in-app realtime, not browser push)
Browser Push API requires PWA + service workers, which Lovable preview iframes block (per platform guidelines). Instead I'll deliver **realtime in-app notifications**:
- Notification bell already exists; extend `notifications-store` to subscribe to realtime inserts on `likes`, `comments`, `follows`, `messages` targeting the current user.
- Show toast (sonner) on new notification while app is open.
- (Optional later: native browser Notification API for desktop tab alerts when permission granted — non-PWA, no service worker.)

### 2. Adjustable Profile Pics
- Profile already has `avatar_url` + Supabase `avatars` bucket. Add an "Upload photo" button in `ProfileScreen` edit flow that uploads to `avatars/{userId}/{timestamp}.jpg`, then calls `updateMyProfile({ avatar_url })`.
- Show image circle with fallback to emoji.
- Allow re-upload / revert to emoji.

### 3. Threaded Replies + @mentions
- Schema: add `parent_id uuid null` and `mentions uuid[]` to `comments`. Index on `parent_id`.
- `CommentsModal`: render comments as a tree (1 level of nesting visible, deeper collapsed under "View more replies"). Add "Reply" button per comment that prefills `@handle`.
- Mention picker: when user types `@`, show dropdown of profiles (debounced search via existing `listDiscoverProfiles`). Insert `@handle` and track mentioned `user_id`s.
- On submit, parse mentions, store `mentions` array, create notification rows / realtime ping for each mentioned user.

### 4. Interactive Post History on Profile (Threads-style)
- Add a "Posts" tab on `ProfileScreen` that lists the user's posts in a vertical thread layout (compact `PostCard` variant: avatar gutter line, stacked).
- Each post is tappable → expands inline to show comments (reuses `CommentsModal` content inline) or opens detail view.
- Uses existing `listMyPosts` / new `listPostsByAuthor` server fn.

### 5. View Another User's Profile
- New route `src/routes/u.$handle.tsx` (or `$userId`) that fetches a profile by handle/id via new `getProfileByHandle` server fn.
- Shows avatar, bio, tribes, follower/following counts, Follow button, and the same Threads-style post history from #4.
- Make every avatar/handle in the app (PostCard, CommentsModal, DiscoverScreen, VenturesScreen, MessagesPanel) link to `/u/$handle`.

## Technical Plan

### DB Migration
```sql
alter table public.comments
  add column parent_id uuid references public.comments(id) on delete cascade,
  add column mentions uuid[] not null default '{}';
create index idx_comments_parent on public.comments(parent_id);
create index idx_comments_mentions on public.comments using gin(mentions);

-- ensure realtime on follows/messages/comments (likes already on)
alter publication supabase_realtime add table public.follows;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.comments;
```

### Server Functions (new / updated)
- `posts.functions.ts`: extend `addComment` to accept `parent_id` and `mentions`. Add `listPostsByAuthor({ author_id })`.
- `profile.functions.ts`: add `getProfileByHandle({ handle })` and `getProfileById({ id })` (public-safe projections).
- `uploads.ts`: helper `uploadAvatar(file)` → returns public URL.

### Files to Create
- `src/routes/u.$handle.tsx` — public profile view
- `src/components/mutuals/MentionInput.tsx` — textarea with @mention picker
- `src/components/mutuals/ThreadList.tsx` — Threads-style post timeline

### Files to Edit
- `src/components/mutuals/ProfileScreen.tsx` — avatar uploader, Posts tab
- `src/components/mutuals/CommentsModal.tsx` — nested replies + mentions
- `src/components/mutuals/PostCard.tsx` — link author to `/u/$handle`
- `src/components/mutuals/DiscoverScreen.tsx`, `VenturesScreen.tsx`, `MessagesPanel.tsx` — clickable avatars
- `src/lib/notifications-store.ts` + `realtime-bridge.tsx` — realtime notif inserts + toast
- `src/lib/posts.functions.ts`, `src/lib/profile.functions.ts`, `src/lib/posts-store.ts`

### Out of Scope (call out, don't build)
- True browser/OS push notifications (requires PWA + service worker; preview-incompatible). Can be added later behind a flag for the published-only build.
- Multi-level deep nesting (cap at 1 visible level for sanity; collapse deeper).

## Rollout Order
1. DB migration (comments parent_id + mentions, realtime publications)
2. Public profile route + author links
3. Avatar upload
4. Threaded replies + mention picker
5. Profile post history (Threads view)
6. Realtime in-app notifications + toasts
