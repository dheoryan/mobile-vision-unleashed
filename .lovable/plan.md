## Goal

Replace the localStorage-only frontend with a real backend so accounts, profiles, and content survive reload, work across devices, and are enforced server-side. `tribeIds` becomes a real DB column with the free/plus invariant enforced by the database, not the client.

## Steps

### 1. Enable Lovable Cloud + auth
- Turn on Lovable Cloud (provisions Supabase under the hood).
- Enable Email/Password and Google sign-in.
- Add `/login`, `/signup`, `/reset-password` routes.
- Wrap the existing app shell in a `_authenticated` layout route so unauth users are redirected to `/login`.
- Replace the `Onboarding` "create local profile" path with: signup → onboarding completes the `profiles` row.

### 2. Database schema (migrations)
- `profiles` — `id uuid PK references auth.users on delete cascade`, `display_name`, `handle unique`, `age int check (age >= 21)`, `city`, `bio`, `avatar_url text`, `plan text check (plan in ('free','plus')) default 'free'`, `tribe_ids text[] not null default '{}'`, `venture_count int default 0`, timestamps.
- Constraint/trigger: `array_length(tribe_ids,1) <= case plan when 'plus' then 3 else 1 end`. Enforced in DB so free users physically can't have multiple tribes.
- `posts` — `id`, `author_id → profiles`, `tribe_id text`, `content`, `image_url`, `tag`, `created_at`.
- `comments` — `id`, `post_id`, `author_id`, `text`, `created_at`.
- `likes` — `(post_id, user_id)` composite PK.
- `follows` — `(follower_id, followee_id)` composite PK.
- `blocks` — `(blocker_id, blocked_id)` composite PK.
- `reports` — `id`, `reporter_id`, `target_kind`, `target_id`, `reason`, `details`, `created_at`.
- Storage bucket `avatars` (public read) and `post-images` (public read), with insert/update RLS scoped to `auth.uid()`.
- Auto-create profile on signup via `handle_new_user` trigger on `auth.users`.

### 3. RLS policies (every table)
- `profiles`: select = anyone authenticated; update = `auth.uid() = id`.
- `posts`/`comments`: select where author not in viewer's blocks; insert = `author_id = auth.uid()`; update/delete = `author_id = auth.uid()`.
- `likes`/`follows`/`blocks`: insert/delete = `auth.uid() = user_id` side; select = own rows + aggregate counts via views.
- Use a `has_blocked(viewer, target)` security-definer helper to avoid recursion.

### 4. Server functions (`createServerFn`)
Replace the four localStorage stores with thin server fns under `requireSupabaseAuth`:
- `getMyProfile`, `updateMyProfile`, `joinTribe`, `leaveTribe` (server enforces plan limit again).
- `listFeed({ tab: 'following' | 'foryou' })`, `getPost`, `createPost`, `editPost`, `deletePost`.
- `listComments`, `addComment`.
- `toggleLike`, `toggleFollow`, `blockUser`, `unblockUser`, `reportContent`.

### 5. Client refactor
- Delete `social-store`, `blocked-store`, `profile-store`, `intent-store` localStorage paths; replace reads with `useQuery` against the new server fns and writes with `useMutation` + `queryClient.invalidate`.
- `Onboarding` step 2 writes to `profiles` via `updateMyProfile`; avatar upload goes to the `avatars` bucket and stores the public URL.
- `ComposerModal` / `PostCard` edit: image upload → `post-images` bucket → URL in `posts.image_url`.
- Keep optimistic UI in `PostCard` (like) and `CommentsModal` (send) using react-query's `onMutate`.

### 6. Migration of any existing localStorage data
- On first authenticated load, if `localStorage["mutuals.profile"]` exists and the new profile is empty, push it through `updateMyProfile` once, then clear it. Posts/comments are mock seed data — drop them, re-seed via SQL insert for the demo tribes.

### 7. Verification
- New account → onboarding → reload → profile + tribe persist.
- Free account cannot end up with 2 tribes even via direct API call (DB constraint blocks it).
- Block, like, follow, comment, edit/delete post all survive logout/login from a different browser.
- Run `security--run_security_scan` after migrations and resolve any RLS gaps.

## Out of scope for this pass
- Realtime subscriptions (timeline still polls/refetches).
- Plus billing — `plan` stays a column flipped manually until Stripe is wired.
- Direct messages persistence (still mock).

## Heads-up
This is a large change: ~10 new SQL migrations, ~12 server-fn files, and a refactor of every screen that currently reads from a store. The UI stays identical; only the data layer moves. After approval I'll do it as one cohesive pass so the app isn't half-migrated.
