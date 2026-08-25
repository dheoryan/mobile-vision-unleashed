# DEVLOG — MEUTUALS

Shared state between agents working on this repo. **Read `AGENTS.md` first** for
conventions and landmines; this file is the moving parts.

Keep this file current. An out-of-date devlog is worse than none, because the
other agent will trust it.

---

## Current state

**Phase:** pre-launch hardening. Target: App Store + Play + web, **free at
launch** (no real payments).

**Branch:** `main`. **Production release pushed through Git on 2026-08-24 after
reconciling seven newer Lovable commits with a normal merge.** The approved Red
Venue changes and push-secret rotation are applied and verified. Google Venue
precision is intentionally feature-flagged off pending a team decision. Never
force-push.

**Local dev talks to PRODUCTION.** `localhost:8082` uses the production Supabase
project. Creating a Venture there makes a real row on a real board that 34 real
users can see. There is no local database in play any more.

**All approved 2026-08-24 Venue migrations are applied and verified.** The
production drift repair preserved the existing Venue row while moving exact
coordinates into the private table. `LOVABLE_VENUE_RELEASE_VERIFY.sql` returned
all 15 checks `true`, including RLS policies, functions, removal of public
coordinates, and the push-secret rotation. The replacement push secret was
saved in Lovable without entering Git or chat.

**Agents do not edit the user's repo directly.** The working copy is
`D:\Dheoryans\Meutuals\mobile-vision-unleashed` on the user's Windows machine.
Anything built elsewhere must be hash-compared against that copy before writing
and re-hashed after. A whole step was once built, tested and reported done in a
clone the user could not run.

**The reference document is `MEUTUALS_PRODUCTION_AUDIT.md`.** It contains the
full findings: security, legal/store compliance, scale, and the product
architecture recommendation. Read it before proposing work — most obvious ideas
are already assessed there.

### Roadmap position

| Phase | Status |
|---|---|
| Week 1 — critical security, store blockers, scale | ✅ done (commit `7a25853`) |
| Week 2 — safety & correctness | ✅ done (2026-08-20) |
| Week 3 — compliance & launch prep | 🟡 engineering pass complete; external launch work remains |
| Product: audience-primitive decision | 🟡 recommended, **awaiting user decision** |
| Ventures: times + board + tickets | ✅ done (2026-08-24) |
| Ventures: venue picker + distance bands | ✅ manual Venue code + DB verified; Google precision intentionally disabled pending team decision |
| Ventures: accepted-member venue + map | ✅ code + approved Red migration verified |
| Installed PWA | ✅ implementation complete; production deployment and physical iOS/Android acceptance remain |
| Tribe Room participation loop | 🟡 code complete; `20260825010000_tribe_room.sql` and signed-in device acceptance remain |

---

## In flight

Claim before you start. Remove your row when done and log it below.

| Agent | Area | Files | Started |
|---|---|---|---|
| Codex | Record verified Tribe Room production migrations | `DEVLOG.md` | 2026-08-25 |

Claude's Tribe-first phase and the Explore relevance pass are both **complete**
and logged below.

---

## Decided — do not re-litigate

| Decision | Detail |
|---|---|
| **Brand name** | `MEUTUALS` (not MUTUALS, not Moots). User chose this spelling explicitly. Internal identifiers stay lowercase `mutuals` — component dir, `mutuals-data.ts`, package name. Don't "fix" those. |
| **Pricing copy** | User said **leave both** `/tiers` and `/upgrade` as-is. They contradict each other and the DB; that is known and accepted. Don't touch pricing content. Both routes are now gated behind `MONETIZATION_ENABLED`. |
| **Payments** | Free at launch. No processor. When it happens: StoreKit / Play Billing / hosted checkout — **never** an in-app card form (Apple 3.1.1). Entitlement must be granted server-side from the store webhook, since `profiles.plan` is deliberately not user-writable. |
| **Animation** | Minimal CSS fades only. `motion` was added then removed at user request. Don't reintroduce a JS animation library. |
| **Modals** | All go through `src/components/ui/animated-modal.tsx` (Radix Dialog + CSS). It provides focus trap, ESC, click-outside. Don't hand-roll `fixed inset-0` modals. |
| **Nearby discovery** | Optional and mutual. Browser location is requested only after an explicit action, rounded to roughly 1 km before storage in an owner-private table, and never returned to other users. For Indonesia, the same rounded coordinate (without account identity) is resolved through BIG's official village/kelurahan → district → regency/city boundary ladder, then the offline world-city catalog. Village is used only to establish the hierarchy; public labels stop at district plus regency/city. Discovery exposes distance bands plus a similarity score; no map or background tracking. |
| **Google Venue precision** | Manual host-authored place + area is the production Venue flow. Google search, badges, external maps, embeds, and server calls are gated by `GOOGLE_PLACES_ENABLED = false` pending a team decision on API terms, restrictions, and quota. Re-enable through that single flag only after credentials are approved. |
| **Pushing to remote** | User-authorised only. Both agents. |
| **One Tribe per user** | Exclusive membership. 21-day switch cooldown with a 7-day onboarding grace window. `profiles.tribe_ids` is capped at 1 by trigger, and `tribe_members` is reconciled on every change. Multi-Tribe is gone — don't reintroduce "Add Tribe" anywhere; the affordance is **Move**. |
| **Global vs Tribe timeline** | Global is look-but-don't-touch: read, like, comment, repost — but no direct Follow or DM across Tribes. Crossing Tribes goes through Explore → Hello → accept. Enforced in `can_direct_message()`. |
| **Moots after Ventures** | A Moot is reciprocal and opt-in, never inferred from DM access or created automatically. Completed Venture rooms become read-only **Venture Memories** with a participant recap; an accepted Hello is the current relationship record behind Add as Moot / Accept / Moots states. This does not settle the feed audience/follows decision below. |
| **Swipe lives on Ventures, not people** | Judging a plan, not a face. Explore uses focused one-at-a-time cards with Next/Back where Next means *later*, not *never*. Reject-forever on people needs a pool of thousands and imports dating semantics; user agreed. |
| **Illustration masks** | Tribe animals appear as masks **worn up / half-masks with faces visible** — never full face-covering. A masquerade signals anonymity, and this product is built on accountable identity (real handles, adult verification, Hello gating). Full masks would also pull toward the romantic register the Explore deck was designed away from. |
| **Which art is transparent** | Everything is transparent RGBA now (app illustrations 600x800, Tribe portraits 600x800, crests 256x256) and that is correct — an earlier note here said the Tribe portraits had to stay opaque; testing against the real card colour disproved it. What background-use *does* require is an opaque surface behind the art, which is the container's job: `bg-card` on the Tribe banner and the Discover flip cards. |
| **Illustration assets** | `src/assets/app-illustrations/*` are **transparent WebP**. `FeatureIllustration` draws no card, border or crop. Any regeneration must preserve transparency, or ship on flat pure #000000 with no vignette/gradient/frame so it can be re-keyed. Black-backed art puts the rectangle back in every empty state. |
| **Explore ranking** | `list_explore_matches` scores on stated signals. Location is a **bonus, never a gate** — that regression is what made Explore newest-first for most users. Sharing a Tribe is worth **0** on purpose: tribemates are already reachable, and Explore is the cross-Tribe bridge. Distance bands are disclosed only inside the mutual radius. |
| **Tribe Room participation loop** | Tribe chat is the live floor, not the whole room. A deterministic Daily Pulse lowers the cost of speaking; loose plan proposals gather explicit interest; only the proposal author can turn one into a real Tribe-scoped Venture; completed Ventures continue into the existing read-only Venture Memory and optional Moot flow. Plans and relationships are never created automatically. |

---

## Open questions for the user — agents should not decide these

1. **Audience primitive.** The app ships two competing models: Tribes
   (space-first, real, enforced in Postgres) and Follows (graph-first, real in
   the DB but invisible to users — `listFeed` has no join on `follows`, so
   following someone changes nothing they can see). The audit recommends
   committing to **space-first**: feed derives from joined tribes, follows
   demote to a bookmark. **This is the single highest-leverage product
   decision and it is unmade.** Do not implement either direction unilaterally.
2. **Host program.** Currently a facade (`/host` writes nothing,
   `/host-dashboard` is fabricated). The audit argues it should become real —
   it's simultaneously the moderation jurisdiction, the seeding engine, and a
   better business than consumer subscriptions. Needs a user call.
3. **Launch geography.** Cold start needs concentration in one city / one or
   two tribes. Nobody has picked one.
---

## Known issues — prioritised

Full detail and file:line evidence in `MEUTUALS_PRODUCTION_AUDIT.md`.

### Week 2 — safety & correctness (completed 2026-08-20)

All items in this table are complete. The original findings are retained for
traceability; implementation and verification evidence is in the Work Log.

| ID | Issue | Why it matters |
|---|---|---|
| **S2** | **Blocking is one-way and silently does nothing.** A policy sub-select checks `blocks` rows the current user can't see, so "did *they* block *me*" never matches. Affects posts, comments, and the DM insert policy. | A blocked harasser keeps DMing (with push) and keeps seeing the blocker's content. Safety failure **and** Apple 1.2 rejection. **Fix first.** |
| **L3** | `SafetyMenu` is imported in exactly one file (`PostCard.tsx`). Absent from DMs, comments, tribe chat, Venture cards, applicant lists, party chat, profiles. | Reviewers test the DM surface specifically. Component already supports it — mostly plumbing. |
| **S3** | `post-images` storage SELECT policy has no `TO` clause → applies to `anon`. Bucket is public. | Anyone can list and download every post image, including tribe-only ones, without an account. |
| **L6** | Account deletion never touches Storage. No `.remove()` call exists in the repo. | Avatars and post images stay public forever after "permanently delete". Apple 5.1.1(v) + GDPR Art. 17. Also: `reports.reporter_id` cascades, so a victim deleting their account destroys their own reports. |
| **L7** | Age gate is a client-side `Number(age) >= 21`. Signup collects no age; the DB column is nullable. | App has stranger DMs and in-person meetups. Largest liability surface. |
| **S4** | DM `DELETE` policy allows `recipient_id`. | A harasser can delete their own abusive messages from the victim's account, destroying evidence. |
| **S5** | Venture SELECT policy permits any `status = 'open'` row; scope filtering is application-only. | Tribe-only meetup plans readable by any signed-in user via PostgREST. |
| **S6** | `tribe-chat-attachments` bucket is `public = true` while `uploads.ts` mints signed URLs assuming it's private. | Signed URLs are security theatre; paths are permanently public. |
| **P3** | Chat/comment queries use `ascending: true` + `limit` → they return the **oldest** N rows. | Tribe chat freezes at 100 messages, DMs at 500. A 5-person tribe hits this on day one. |
| **P4** | Counter triggers do a full `count(*)` recount per like, and lock the post row. | Viral-post death: like latency grows linearly with like count. |

### Week 3 — compliance (engineering pass 2026-08-20)

| ID | Status | Remaining work |
|---|---|---|
| **L1** | 🟡 Queue complete | Moderator roles, 24-hour due timestamps, `/admin/reports`, hide/suspend/dismiss actions, and audit log are implemented and tested. Launch still needs named staff, monitored alerts, and a rehearsed SLA/runbook. |
| **L2** | 🟡 Text baseline complete | Database triggers reject a narrow high-confidence harmful-text set. Automated image/CSAM/NCII classification and quarantine remain a launch blocker. |
| **L5** | 🟡 Data map corrected | Privacy page now describes Cloudflare, Supabase, OAuth, push, private media, and the data actually collected. Controller identity/address, real contacts, retention/legal basis detail, and counsel/store review remain. |
| **L8** | ✅ Complete | Venture surfaces now carry report/block controls, two-way block filtering, meet-safely guidance, and accepted-chat location guidance. |
| **L9** | 🟡 Code complete | Apple entry points and consistent MEUTUALS manifest/title/push metadata are present. Production Apple credentials and working contact inboxes remain external blockers. |

### Deferred / lower priority

- **P5** push fan-out is one Worker invocation per recipient (5k followers = 5k invocations from one post).
- **P7** inbox is still rebuilt from the newest 500 raw messages (heavy users can lose older threads); durable `read_at` now fixes unread counts. Feed pagination and bounded large ID filters remain; Timeline query failures now render a retry state.
- Tribe and Venture rooms still have no per-user read pointer, so accurate
  unread badges for group chat are impossible with the current schema. The UI
  deliberately shows durable DM unread only rather than fabricating group
  counts.
- **M1** `profiles.venture_count` is a read-modify-write race; venture slot acceptance is check-then-act (two simultaneous accepts can over-subscribe).
- `listVentureMatches` remains unused. Tribe join/leave is now reachable through Manage Tribes; the final home Tribe cannot be removed.
- Shared posts now use the current origin and a real RLS-protected `/p/$postId` route with post-login return.
- `.env` is tracked in git despite being in `.gitignore` (contents are only the publishable key, so hygiene not leak).

---

## Cross-agent notes

Leave messages for the other agent here.

### 2026-08-21 — Codex → Claude — Chats launch creative ready

The approved square announcement thumbnail is available as a full PNG and an
optimized 1200×1200 WebP under `output/announcements/`. It is a publishing
artifact only and is not imported into the application.

---

## Work log

Newest first. Append; don't edit past entries.

### 2026-08-25 — Codex — Corrected Tribe chat visual hierarchy

- Corrected the too-literal first background treatment after reviewing it in
  the real mobile composition. The Tribe portrait is now a centered,
  grayscale 7% watermark under a uniform dark wash instead of a 35% cropped
  illustration competing with message content.
- Removed the rounded bordered chat frame and restored solid message surfaces:
  outgoing bubbles retain the Tribe accent; incoming bubbles use the opaque
  secondary surface with a quiet token border. The artwork is sensed rather
  than read through either bubble.
- Removed the squeezed **Move Tribes in Profile settings** instruction from the
  room identity header. Tribe movement remains reachable in Profile Settings,
  where it belongs.
- Removed permanently repeated React/Reply labels beneath every message.
  Tapping a bubble now opens one compact contextual tray containing Love,
  Funny, Support, and Reply. Only reaction chips that actually have a count
  remain persistent. Keyboard and screen-reader users retain a visually hidden
  Message Actions trigger.
- Verification: formatting, targeted ESLint, `npx tsc --noEmit`, diff checks,
  and the Cloudflare production build pass. Both available localhost browser
  contexts reached login rather than the signed-in room, so final signed-in
  device visual acceptance remains with the user.
- The frontend skill's restraint/readability rules directly drove the removal
  of competing art and repeated controls; the full-stack skill kept the
  existing typed reaction behavior unchanged. No migration changed.

### 2026-08-25 — Codex — Tribe chat atmosphere and mobile interactions

- Removed the large standalone Tribe artwork banner and moved the existing
  transparent Tribe illustration into the chat floor itself. Layered vertical
  and radial scrims, opaque outgoing bubbles, translucent bordered incoming
  bubbles, and an opaque blurred composer preserve text contrast while letting
  each room retain its own visual identity.
- Moved the cooldown-aware **Your Tribe** control out of chat and into Profile
  Settings. The same 21-day movement rules and confirmation sheet remain; the
  local profile now updates immediately after a successful move.
- Replaced the composer emoji picker and generic image control with right-side
  **Attach a photo** and **Take a photo** actions. Camera capture uses the
  mobile browser's rear-camera hint and shares through the existing private
  Tribe attachment upload path.
- Added touch-visible message reactions using iconography rather than emoji:
  Love, Funny, and Support. Counts and the current user's state are read from
  the normalized reaction table and update optimistically with rollback on
  failure. Reply remains a visible companion action rather than hover-only UI.
- Added `20260825011000_tribe_chat_reactions.sql`, which extends the existing
  reaction constraint and hardens the trigger so chat reactions can only land
  on ordinary non-system chat messages; Pulse Sparks and plan Interested
  reactions keep their original type restrictions. This follow-up migration
  has **not** been applied to production. Run it after
  `20260825010000_tribe_room.sql`, then rerun the updated
  `LOVABLE_TRIBE_ROOM_RELEASE_VERIFY.sql`.
- Verification: targeted ESLint clean; `npx tsc --noEmit` clean; 4/4 Tribe Room
  tests pass; Cloudflare production build exits 0. The local browser reached a
  clean login screen with no console errors, but signed-in visual acceptance
  remains pending because the available browser session had no account.
- Applied the frontend skill's image-led hierarchy and readable-overlay rules,
  plus the full-stack skill's typed, authenticated mutation and database-guard
  requirements. Repo decisions override generic animation guidance: no JS
  animation library was introduced.

### 2026-08-25 — Codex — Tribe chat became a participation room

- Rebuilt the Tribe surface around the approved **room → plan → Venture →
  memory** loop. The Tribe artwork header is compact; Daily Pulse, Plans, live
  Venture announcements, and the chat floor now form one focused vertical
  workspace rather than another stack of unrelated chat cards.
- Added a deterministic daily prompt catalog with Tribe-specific prompts,
  answer composer, answer previews, and lightweight Sparks. Added loose plan
  proposals with rough timing, public area, capacity, and reciprocal
  **Interested / I'm in** state. Both composers use the shared accessible
  `AnimatedModal`; all motion remains CSS-only.
- Added an explicit handoff from a proposal into the existing Venture creator.
  Title, context, Tribe-only scope, and room size carry over, while the host
  must still confirm an exact day/time and a safe public Venue. Once created,
  the Venture is announced back into the room. Closed announcements direct
  participants to the existing Venture Memories/Moot recap rather than
  duplicating that relationship system.
- Added authenticated server functions and TanStack Query hooks for room
  listing, Pulse answers, proposals, reaction toggles, durable reads, and
  Venture announcements. Identity comes only from `context.userId`; inputs are
  bounded with Zod.
- Added `20260825010000_tribe_room.sql`: bounded structured fields on
  `tribe_messages`, normalized reaction and read-pointer tables, membership-
  aware RLS via a pinned `SECURITY DEFINER` helper, adult-write guards, unique
  daily-answer/Venture-announcement indexes, and database triggers that stop a
  client from forging a Venture card or applying a reaction to the wrong item.
- Chats can now show a real Tribe unread count from the durable pointer. Venture
  group unread remains deliberately absent because it still has no pointer.
- The pre-migration app remains safe: enhanced room activities show a retry
  state and the chat query falls back to the legacy schema instead of failing.
- Added `LOVABLE_TRIBE_ROOM_RELEASE_VERIFY.sql` for a read-only post-migration
  check and `npm run check:tribe-room` with three deterministic prompt/metadata
  tests.
- Verification: targeted ESLint clean; `npx tsc --noEmit` clean; 3/3 Tribe Room
  tests pass; production Cloudflare build exits 0. Visual signed-in acceptance
  could not run because both available localhost browser sessions were at the
  login screen. The migration has **not** been run against production.
- Applied the frontend skill's restrained workspace hierarchy and the
  full-stack skill's explicit authenticated boundary/RLS requirements. Repo
  decisions override their generic motion guidance: no JS animation library
  was added.

### 2026-08-25 — Codex — Device-aware PWA installation guide

- Replaced the generic **Use your browser menu** toast with an accessible
  bottom-sheet installation guide launched from Settings.
- Added separate numbered instructions for iPhone Safari, Android Chrome,
  Samsung Internet, and desktop Chrome/Edge, including the exact menu labels
  users may encounter and what happens after confirmation.
- The Settings row now says **Show steps** when a native browser prompt is not
  available. Android keeps the one-tap native **Install** action when the
  `beforeinstallprompt` event is available; installed mode retains its compact
  success state.
- Added a short post-install note directing users to enable Venture, Chat, and
  request notifications from the installed app. No new permissions are
  requested by opening the guide.
- Formatting, targeted ESLint, TypeScript, PWA release checks, diff checks, and
  the Cloudflare production build pass.

### 2026-08-25 — Codex — Explicit current-area confirmation UX

- Adapted the useful part of Bumble's current GPS-first pattern without
  adopting background tracking or virtual location. Onboarding now leads with
  **Use my current area**, shows the resolved district/city in a confirmed
  state, and makes manual catalog selection the permission-denied fallback.
- Removed copy that incorrectly promised the area would stay current on its
  own. Onboarding, Edit Profile, and Settings now say that the saved area only
  changes after an explicit user update and that MEUTUALS does not track in the
  background.
- Kept spoof-resistant nearby behavior intact: current-area GPS and the
  nationwide BIG hierarchy drive proximity; a manual city remains a profile
  fallback and does not create a private coordinate or distance band.
- No migration, Google API activation, background permission, or Travel Mode
  was added. TypeScript, targeted ESLint (one pre-existing Fast Refresh
  warning), formatting, diff checks, and the Cloudflare production build pass.

### 2026-08-25 — Codex — Nationwide Indonesia GPS coverage completed

- Extended the Indonesia resolver from one district layer to a complete BIG
  boundary ladder: village/kelurahan first, district second, and regency/city
  third, followed by the existing offline world-city fallback.
- Village/kelurahan is used only to establish the correct administrative
  hierarchy. It is not returned by the location server functions or written to
  the public profile; public labels remain district plus regency/city.
- All BIG calls share one five-second budget and receive only the already
  rounded coordinate without account identity. Missing or outdated polygons
  fall through instead of silently turning rural areas into a distant major
  city.
- Live checks passed for Greater Jakarta, Denpasar, Medan, Makassar, Jayapura,
  Pontianak, and Ambon. Focused tests cover all label levels, privacy display,
  coordinate rounding, malformed responses, and boundary fallback.

### 2026-08-25 — Codex — Indonesia district-level GPS labels

- Replaced Indonesia's major-city-only GPS label with a server-side lookup
  against Badan Informasi Geospasial's nationwide district boundary layer.
  Auto-location now returns locality labels such as `Tambun Selatan, Kabupaten
  Bekasi`, `Cikarang Timur, Kabupaten Bekasi`, and `Cakung, Jakarta Timur`.
- The provider receives only the same two-decimal coordinate stored by
  MEUTUALS (roughly 1 km), never the user ID. The request is authenticated at
  the app boundary, limited to Indonesia, times out after five seconds, and
  falls back to the existing offline world-city catalog.
- Explicit auto-location now requests a fresh high-accuracy browser fix instead
  of accepting a cached network position up to ten minutes old. Onboarding and
  profile copy now describe a city or local area rather than promising only a
  major city.
- Updated Privacy to disclose BIG and the rounded-coordinate boundary lookup.
  No database migration, API key, or Google Places enablement is required.
- Added focused parser, privacy-rounding, malformed-response, and label-format
  tests. Live BIG checks resolved Bekasi, Tambun, Cikarang, and Cakung; focused
  tests, TypeScript, targeted ESLint (one pre-existing Fast Refresh warning),
  `git diff --check`, and the Cloudflare production build passed.

### 2026-08-24 — Codex — Installed PWA completed

- Upgraded the Web Push-only worker into a privacy-bounded installed-app
  worker: it precaches the branded offline fallback and public app identity,
  caches only same-origin static assets, never caches authenticated navigation
  or Supabase/user data, and removes obsolete MEUTUALS caches on activation.
- Added foreground update discovery with an accessible **Update** action,
  online/offline status, automatic reconnect recovery, stable manifest `id`,
  install categories/display fallbacks, and Settings installation UX for iOS,
  Android, desktop, and already-installed states.
- Scoped Venture onboarding, last Venture mode, and primary-tab state to the
  authenticated user. Account changes now close nested threads/modals instead
  of carrying view state across users. Logout detaches Web Push and clears the
  TanStack Query account cache before the next login.
- Added `npm run check:pwa` and `PWA_RELEASE_CHECKLIST.md`, including the
  cache-security boundary and physical-device acceptance matrix.
- Verification passed: PWA release check, service-worker syntax, focused ESLint
  with no errors (one pre-existing Fast Refresh warning), `tsc --noEmit`,
  `git diff --check`, production Cloudflare build, and local Worker HTTP 200s
  for `/`, manifest, worker, offline fallback, and required icons. Existing
  bundle-size and third-party bundler warnings remain.
- No database migration or environment change is required. Production was not
  pushed; physical iPhone/Android install and Web Push acceptance remain the
  release gate. The user's `.env` and `package-lock.json` changes remain
  untouched and unstaged.

### 2026-08-24 — Codex — Manual-first Venue release shipped through Git

- Production verification returned all 15 Venue, coordinate privacy, RLS,
  function, private-arrival, and push-secret checks `true`.
- Shipped manual host-authored place + area as the complete production flow.
  Google Places is gated at the picker, both server endpoints, verified badge,
  and map surfaces by `GOOGLE_PLACES_ENABLED = false` while the team evaluates
  API terms, restrictions, and quota.
- Reconciled the seven newer Lovable commits normally, fetched immediately
  before release, and confirmed the branch was zero commits behind. No rebase,
  force-push, or history rewrite.
- Targeted ESLint, `tsc --noEmit`, `git diff --check`, and the Cloudflare
  production build passed on the release configuration. The known full-project
  lint baseline remains 2,339 findings.
- Preserved the user's uncommitted local `.env` and `package-lock.json`; neither
  file's local changes entered the release commit.

### 2026-08-24 — Codex — Manual-first venue release prepared, production push gated

- Made host-authored place name + area the default Venture venue interaction;
  Google Places is an explicitly optional precision path for distance bands and
  accepted-member map guidance.
- Reconciled seven newer `origin/main` Lovable commits with a normal merge. No
  force-push and no user-owned `.env` or `package-lock.json` edits were lost.
- Found a server Google key and an active push-dispatch secret committed by the
  remote changes. Removed Google credentials from the tracked release `.env`
  and corrected the runtime guidance to use `.env.local`/Lovable Secrets.
- Added a database-generated push-secret rotation migration,
  `LOVABLE_VENUE_RELEASE_VERIFY.sql`, and a separate private secret-copy query.
  Kila approved all three Red production actions; manual application and
  verification are still pending.
- The first production venue run exposed an older one-row `venue_places` shape:
  coordinates were public columns, `created_by` was absent, and
  `google_place_id` was globally unique. Kila explicitly approved the Red drift
  repair. The repaired migration copies coordinates into the private table,
  backfills ownership from linked Venture hosts, then removes the legacy public
  coordinate columns and obsolete uniqueness constraint without deleting the
  venue row.
- Kila ran the repaired Venue migration, private-arrival migration, and
  database-generated push-secret rotation manually. The consolidated production
  verifier returned all 15 checks `true`; the new push secret was stored in
  Lovable and never shared back into the repo or conversation.
- At Kila's direction, Google Places remains intentionally off for this release.
  `GOOGLE_PLACES_ENABLED` gates the picker entry point, verified badges, map
  links/embeds, and both authenticated server endpoints. Manual venues remain
  the complete production path; the team can enable precision later with one
  explicit flag change after approving keys and quota.
- Targeted ESLint, `tsc --noEmit`, `git diff --check`, the production build, and
  the unauthenticated browser smoke test pass. Full-project lint remains a
  pre-existing baseline of 2,339 findings and is not release-clean.

### 2026-08-24 — Codex — Venture recap policies verified in production

- Kila ran `LOVABLE_VENTURE_RECAP_SQL_EDITOR.sql` manually in the Lovable Cloud
  SQL Editor.
- Production verification returned
  `accepted_members_policy_ready = true` and
  `completed_chat_policy_ready = true`.
- Marked `20260824034000_party_members_see_each_other.sql` and
  `20260824051000_archive_completed_venture_chat.sql` **applied**. The full
  participant recap is now available to accepted members, and completed party
  chats are read-only at both the application and RLS layers.
- No further SQL is required for the post-Venture Moot recap. The two separate
  venue migrations remain unrun and unapproved.

### 2026-08-24 — Codex — Splash states the MEUTUALS mission

- Replaced the internal-sounding `OPEN PARTY BOARD` eyebrow on the branded
  bootstrap screen with `REINVENTING HOW WE SOCIALIZE`.
- The line deliberately uses the grammatical verb phrase “how we socialize”
  while preserving the user's intended objective and the existing poster-like
  logo → promise → wordmark hierarchy. No new motion or layout chrome added.
- Validation: targeted ESLint, `npx tsc --noEmit`, `git diff --check`, and the
  Cloudflare production build pass; existing bundler warnings remain.

### 2026-08-24 — Codex — Venture recap Red migrations approved and prepared

- Kila explicitly approved the two access changes for manual production
  execution: `20260824034000_party_members_see_each_other.sql` and
  `20260824051000_archive_completed_venture_chat.sql`.
- Corrected a migration identity collision: the archive policy originally used
  `20260824050000`, already occupied by `venture_private_venues`; it is now
  `20260824051000`.
- Added `LOVABLE_VENTURE_RECAP_SQL_EDITOR.sql`, an atomic, idempotent Lovable
  SQL Editor paste containing a dependency preflight, both approved policies,
  least-privilege function grants, and two boolean verification results.
- **Not executed by Codex.** Localhost uses production and the user requested
  manual Lovable execution. Do not mark either migration applied until the SQL
  Editor returns both verification columns as `true`.
- The separate venue migrations `20260824040000` and `20260824050000` were not
  included and remain unapproved.

### 2026-08-24 — Codex — Completed Ventures become Moot-making memories

- Closed/ended Venture rooms remain accessible in Chats under **Venture
  Memories**. The normal composer is replaced with a read-only archive notice,
  so a temporary cross-Tribe party room cannot become a permanent ungated DM.
- Added a deterministic in-chat **Venture complete** system card. It lists the
  host and accepted participants, excludes the viewer, and presents explicit
  Add as Moot / Requested / Accept / Moots / Unavailable states. The card is
  rendered from Venture state rather than inserted as a bot row, so closing is
  idempotent and cannot create duplicate recap messages.
- Reused the existing Hello request/accept safety model as the reciprocal Moot
  relationship record. No user is connected automatically. Fixed contact
  lookup for the valid two-direction Hello case, where `maybeSingle()` could
  previously fail if both users had created a row.
- `sendVentureMessage` now rejects messages after manual close/end or the
  scheduled `ends_at` time. Added
  `20260824051000_archive_completed_venture_chat.sql` for the matching direct-
  Supabase RLS boundary. It was **applied and verified 2026-08-24**.
- The full participant recap for non-host members also depends on the existing
  **RED, applied and verified 2026-08-24**
  `20260824034000_party_members_see_each_other.sql`; before it
  lands, RLS intentionally degrades a member's recap to the host plus whichever
  accepted profiles they can already read.
- Current attendance limitation: “participant” means host + applications still
  accepted when the Venture completes. The schema has no check-in/attendance
  proof yet, so it cannot distinguish attendees from no-shows.
- Validation: modified-file ESLint and `npx tsc --noEmit` pass; `npm run build`
  exits 0 (existing chunk-size and dependency directive warnings only).

### 2026-08-24 — Codex — Chat unread-state audit and repair

- Fixed the reported stale DM badge. Opening a thread now marks **every** unread
  incoming message from that person, even when the newest message was sent by
  the current user; the old effect inspected only the final row.
- Reading a DM now also marks its matching `message` notification read. Thread
  rows, the bottom Chats indicator, and the header bell therefore acknowledge
  the same action instead of maintaining two conflicting unread records.
- Added optimistic updates with full rollback for thread summaries, open
  message rows, and notifications, followed by authoritative invalidation. The
  badge clears immediately without hiding genuine server failures.
- Scoped active-thread cache keys by authenticated user. Previously, switching
  accounts in one browser could briefly reuse the prior account's cached
  conversation until refetch.
- Audit follow-ups retained under Known Issues: the inbox summary still reads
  only the newest 500 raw messages, and Tribe/Venture rooms need per-user read
  pointers before they can offer accurate unread badges.
- Validation: targeted ESLint, `npx tsc --noEmit`, `git diff --check`, and the
  Cloudflare production build pass; existing chunk-size and third-party
  bundler warnings remain.
- `.env` and `package-lock.json` remain dirty and unstaged.

### 2026-08-24 — Codex — Centered header identity and branded splash

- AppHeader is now a three-column grid: screen identity remains left,
  notification action remains right, and equal outer tracks keep the MEUTUALS
  mark geometrically centered regardless of title width.
- The authentication/profile bootstrap surface is now a focused branded splash
  using the same transparent SVG, MEUTUALS wordmark, and a restrained shimmer
  progress line instead of a simulated feed shell.
- Installed PWA launch metadata already uses a dark background and the same eye
  geometry through the manifest icons; no icon-platform migration was needed.
- Validation: targeted ESLint, `npx tsc --noEmit`, `git diff --check`, and the
  Cloudflare production build pass; existing chunk-size and third-party
  bundler warnings remain.
- `.env` and `package-lock.json` remain dirty and unstaged.

### 2026-08-24 — Codex — Transparent, centered app-header mark

- Rebuilt the MEUTUALS eye mark as a true transparent SVG after the raster
  extraction tool baked its preview checkerboard into the pixels. The shipped
  vector preserves the pink-to-orange eye, five rays, black pupil, and the
  distinctive four-point spark while centering the full composition in its
  square canvas.
- AppHeader now imports the transparent vector and no longer adds rounded
  corners or an accent-coloured box-shadow outline. The old WebP remains
  unreferenced for rollback rather than being destructively removed.
- Validation: targeted ESLint, `npx tsc --noEmit`, `git diff --check`, and the
  Cloudflare production build pass; only the existing chunk-size and
  third-party bundler warnings remain.
- `.env` and `package-lock.json` remain dirty and unstaged.

### 2026-08-24 — Codex — App-wide loading system and screen map

- Added `APP_STRUCTURE.md`, mapping the authenticated shell, its five primary
  destinations, nested Tribe/message paths, standalone routes, and the owner of
  each remote-data loading state.
- Expanded the shared skeleton vocabulary to cover app bootstrap, feeds,
  people, Venture thumbnail cards, conversation rows, compact Profile lists,
  notifications, and message threads. Regions announce loading accessibly while
  their decorative shapes stay hidden from assistive technology.
- Replaced plain loading copy/spinners across Timeline, Discover, all Venture
  modes, Chats, Profile data tabs and Settings queries, Tribe chat, DMs, Venture
  party chat, notifications, shared posts, and public profiles. Static forms
  and policy pages remain immediate because they do not wait on remote data.
- Removed the duplicated Terms · Privacy · Guidelines footer from Profile.
  Those destinations remain grouped under Settings → Safety & privacy.
- Validation: `npx tsc --noEmit`, `git diff --check`, and the Cloudflare
  production build all pass. Targeted ESLint reports only pre-existing issues
  in `TribeScreen.tsx` and `routes/index.tsx`; edited skeleton and screen files
  introduced no new lint diagnostics. Existing chunk-size and third-party
  bundler warnings remain unchanged.
- `.env` and `package-lock.json` remain dirty and unstaged.

### 2026-08-24 — Codex — Hosted Ventures split into Active and History

- Hosting now defaults to an **Active** view containing open and full Ventures;
  closed Ventures live only under **History**. Each filter carries its own count
  and the section subtitle reflects the current view rather than mixing live and
  all-time totals.
- New Venture always returns the host to Active before opening the creator.
  Switching filters closes an unfinished inline creator so historical review
  stays focused.
- Added distinct empty states for Active and History. Closing a Venture now says
  it moved to History; reopening says it returned to Active, and both mutations
  explicitly refresh the hosted collection.
- The filter controls are 44 px toggle buttons with `aria-pressed` state, so the
  status split remains keyboard and screen-reader understandable without an
  incomplete custom ARIA-tab interaction.
- Validation: targeted ESLint clean, `npx tsc --noEmit` clean, `git diff
  --check` clean, and the Cloudflare production build succeeds with only the
  existing chunk-size and third-party bundler warnings.
- `.env` and `package-lock.json` remain dirty and unstaged.

### 2026-08-24 — Codex — Looking became a thumbnail-first Venture list

- Removed the deck/list switcher and its alternate deck path from Looking. Open
  Ventures now has one predictable list presentation.
- Added signed private-bucket thumbnails to every list row, with a stable
  neutral fallback while an image is absent or still signing. Timing remains
  visible over the thumbnail and in the row copy.
- Expanded rows now show the full public decision set before a request: timing,
  group capacity, host, public area, every vibe, host note, and the relevant
  application action.
- Renamed My Tickets to **My Ventures** and moved it into the Open Ventures
  heading where the removed view switcher used to be. The destination title and
  empty-state copy now use the same product language.
- Validation: targeted ESLint clean, `npx tsc --noEmit` clean, `git diff
  --check` clean, and the Cloudflare production build succeeds with only the
  existing chunk-size and third-party bundler warnings.
- `.env` and `package-lock.json` remain dirty and unstaged.

### 2026-08-24 — Codex — Ventures load before venue rollout

- Fixed all three Venture queries failing while the Red venue migrations are
  intentionally unrun. Reads now retry without `venue_place_id` when PostgREST
  reports that optional column missing; missing venue tables and distance RPCs
  return empty enrichment maps.
- The fallback is deliberately narrow: only known missing-schema codes combined
  with known venue identifiers degrade. RLS, permission, connectivity, and
  unrelated database failures still surface normally.
- Reused the compatible Venture lookup for applying, responding to invites,
  reviewing applicants, and opening the host editor so the pre-migration board
  remains usable after it renders.
- Venue labels, distance bands, and accepted-member arrival details remain
  unavailable until the Red migrations are explicitly approved and applied.
- Validation: targeted ESLint clean, `npx tsc --noEmit` clean, `git diff
  --check` clean, and the Cloudflare production build succeeds with only the
  existing chunk-size and third-party bundler warnings.
- `.env` and `package-lock.json` remain dirty and unstaged.

### 2026-08-24 — Codex — Ventures navigation became task-focused

- Removed the persistent Looking / Yours / Hosting tab strip. It competed with
  the content and made Ventures read like a dashboard rather than one focused
  activity.
- The Venture board is now the primary surface. My Tickets is one quiet,
  contextual action with an activity count; Hosting remains behind the Host
  creation action. My Tickets and Hosting each receive their own page title and
  one explicit Back to Venture board control.
- Preserved stored-mode and deep-entry behavior, including Profile → Hosting,
  while keeping all existing request, ticket, and host flows intact.
- Validation: targeted ESLint clean, `npx tsc --noEmit` clean, `git diff
  --check` clean, and the Cloudflare production build succeeds with only the
  existing chunk-size and third-party bundler warnings. Production visual E2E
  remains blocked by the intentionally unrun Red venue migrations.
- `.env` and `package-lock.json` remain dirty and unstaged.

### 2026-08-24 — Codex — Ventures board became a public ticket rack

- Replaced the administrative departure rows with compact available-ticket
  cards: a date/time stub, dashed tear seam and notches, remaining-seat stamp,
  venue verification, distance band, attendance, and vibe metadata.
- Kept the product states distinct. Board tickets read as available, sold out,
  pending, declined, or accepted; held tickets in Yours retain the stronger
  ownership treatment. Expanding one ticket reveals the host note and the
  relevant request, withdrawal, or party-chat action without opening a modal.
- Preserved one-open-at-a-time disclosure, added explicit `aria-expanded` /
  `aria-controls` wiring and an input label, kept action targets at least 44 px,
  and respected reduced-motion preferences for the chevron transition.
- Validation: targeted ESLint clean, `npx tsc --noEmit` clean, `git diff
  --check` clean, and the Cloudflare production build succeeds with only the
  existing chunk-size and third-party bundler warnings. Production visual E2E
  remains blocked by the intentionally unrun Red venue migrations.
- `.env` and `package-lock.json` remain dirty and unstaged.

### 2026-08-24 — Codex — Ventures handoff completed: distance and private venue

- Took over Claude's uncommitted Windows handoff and completed venue steps 4–5.
  The board and deck now show server-derived coarse distance bands. If a member
  has no saved location, Ventures offers an explicit approximate-location
  action that keeps people discovery paused rather than silently opting them in.
- Corrected the venue privacy model before rollout. Google coordinates moved
  out of the signed-in-readable place row into `venue_place_coordinates`, which
  has no client SELECT policy. `list_venture_distance_bands(uuid[])` returns
  only `Within 2/5/15/50 km` or `50+ km away`, is capped at 80 ids, and repeats
  the Venture visibility rule so a guessed UUID cannot disclose a hidden plan.
- Added `venture_venues`, an accepted-member tier containing only the host's
  own arrival instructions. Pending/declined users cannot read it. Hosts can add
  exact entrance/table guidance in the existing Where sheet; accepted tickets
  show it under an explicit privacy label.
- Added a consent-gated Google Maps embed to the back of accepted tickets. The
  iframe does not load until tapped, discloses that Google receives the member's
  IP, and retains an external-Maps fallback when the embed key is absent.
- Corrected `20260824040000_venue_places.sql` from **Green** to **Red**: it
  creates policies, grants, and security-definer functions, so the change
  protocol requires explicit approval. Added the separate Red
  `20260824050000_venture_private_venues.sql`. Neither was applied.
- Preserved Google storage constraints: Google names/addresses are not stored;
  place ids are retained; coordinate cache rows are deleted after 30 days.
- Validation: targeted ESLint clean, `npx tsc --noEmit` clean, `git diff
  --check` clean, and the Cloudflare production build succeeds with only the
  existing chunk-size and third-party bundler warnings. Production E2E is
  intentionally pending because localhost uses the live database and the Red
  migrations are not applied.
- Handoff hygiene: `.env` and `package-lock.json` remain dirty and unstaged.
  The server key currently present in `.env` must move to ignored `.env.local`
  and Lovable secrets before any push; the Places API quota cap is still unset.

### 2026-08-24 — Claude — Ventures: venue, clock, and the ticket

Eleven commits, `2de573d`..`a026890`. Two migrations, one of them still unrun.

**Migrations**

- `20260824012500_venture_start_and_end_times` — **applied to production.**
  `starts_at`, `ends_at`, `venue_tz` on `ventures`, three shape CHECKs, and a
  partial index for the new ordering. Replayed twice on PG16 for idempotency.
- `20260824034000_party_members_see_each_other` — **RED, applied and verified
  2026-08-24.** Lets an
  accepted member read the other *accepted* applications of the same Venture.
  Declined and pending applicants stay the host's business. Verified on a local
  RLS harness across six roles before delivery.
- `20260824040000_venue_places` — **GREEN, NOT RUN.** Blocks all three Ventures
  tabs once the app code is live, because `fetchVenues` runs on every list.

**A Venture has a clock.** `time_window` stays — nine live Ventures use it, and
rewriting their timing would be inventing data. New Ventures fill in real
timestamps and old ones fall back. `venture-time.ts` is the single formatter;
four screens used to read `time_window` directly, which was fine with one way to
express timing and four chances to disagree with two. Ordering flipped to
soonest-first, and finished Ventures leave the query rather than the page.
"Not in the past" lives in the server function, because a CHECK must be
immutable and `now()` is not.

**The board replaced the card stack.** Rows grouped by day, led by a mono clock.
Eight bordered cards fit three Ventures on a phone; hairline rows fit ten. The
clock is the biggest thing on the row because it is also what sorts the list.
Undated legacy rows drop the clock column entirely rather than printing a dash.

**Hosting became four rows and four sheets**, plus a fifth for the venue. The
old form stacked eight labelled field groups down one scroll — the same "bunch
of actions in one screen" problem already fixed on Discover, reproduced
elsewhere. Field internals moved verbatim.

**Accepted Ventures became tickets**, and Ventures gained a third mode:
Looking · Yours · Hosting. Invites and pending requests moved off the board pill
into Yours; `JoinedVentureCard` and the requests modal are gone rather than left
as duplicates.

**Bug Kila found:** an accepted member could see *that* they were in and nothing
about what they had joined. Two layers — `listMyJoinedVentures` passed a
hardcoded `[]` for applications (fixed), and RLS would have blocked it anyway
(the unrun Red migration). Degrades to a count until that runs.

**Venue, step 2–3.** `venue_places` holds the host's own label and area plus a
coarse pin; `places.functions.ts` proxies both Google calls server-side. Two
one-line details keep it free: a session token spanning the whole picker
interaction, and a field mask of `id,location,formattedAddress` — asking for
`displayName` moves the same call from Essentials to Pro at $17/1000.

**Google terms, the part that shapes the schema.** `place_id` may be kept
forever; coordinates 30 days; **name and address never**. So both strings on a
Venture are the host's words, and `expire_venue_coordinates()` sweeps pins past
30 days. That window is longer than a Venture's own lifespan, so nothing
user-facing depends on it. The verified tick keys off `google_place_id` being
non-null — the name proves nothing.

**Two mistakes of mine worth recording.**

1. I built and "delivered" step 1 into a clone on the cloud container's own
   disk, not this repo, and reported it done. Kila found out by looking at
   localhost. Every delivery since hashes each touched file against the copy on
   `D:\Dheoryans\Meutuals\mobile-vision-unleashed` *before* writing and
   re-hashes after.
2. The picker asked the host to type the name — carefully, because storing
   `displayName` is forbidden — and then saved Google's formatted address as the
   area one line later. Same rule, same paragraph. Both fields are the host's
   now.

**Also corrected:** I told Kila to IP-restrict the Places key. Lovable deploys as
a Cloudflare Worker, which has no fixed egress IP, so a Websites restriction
rejects every server call (`referer <empty> are blocked`) and an IP allowlist is
meaningless. That key runs with API restriction plus a quota cap, and the cap is
therefore not optional.

**Still open**

- Both unrun migrations above.
- Quota cap on Places API (New) — the only hard ceiling that key has.
- `GOOGLE_MAPS_SERVER_KEY` belongs in `.env.local` + the Lovable secret store,
  never the tracked `.env`; `VITE_GOOGLE_MAPS_EMBED_KEY` belongs in `.env`.
- Nothing pushed. Eleven commits sit local on `main`.
- Step 4 (distance chip + location prompt) and step 5 (private tier, the
  embedded map on the back of the ticket) not started.

### 2026-08-22 to 2026-08-23 — Claude — Design and planning, no commits

Two days with no repo activity, recorded so the gap is not read as lost work.

- **The moots proposal.** Written against the live schema rather than memory.
  The finding that matters: `hellos_one_per_pair` is a unique constraint on
  `(sender_id, recipient_id)`, so a declined Hello is permanent — there is no
  retry, ever. That is what makes removing the monthly cap of 5 defensible:
  volume rises, persistence against a "no" stays impossible.
  `can_direct_message()` cannot define "moot" because it returns true on four
  branches, including same-Tribe and shared-live-Venture.
- **The venue-and-clock spec** that became 2026-08-24's work, including the
  Google terms research and the decision that Where/When lead the host form.
- **The Ventures scratch** — board-then-ticket, drawn in the app's own tokens.
  Two rounds; the first laid the right information out as a web form and was
  rejected for exactly that.
- **Marketing assets** for the Chats launch: post caption, and a prompt for a
  notification sound. Codex produced the thumbnail — see its 08-21 entry.

None of this is in git. The specs live as published documents, not in-repo.

### 2026-08-21 — Claude — Five tabs, one job each (`09f166e`..`3d8b5d0`)

Fifteen commits. The brief was Kila's: Discover and Ventures were "a bunch of
actions in 1 screen", not friendly enough, not memorable. The fix was structural
rather than cosmetic — every tab got one job.

- **`CHANGE_PROTOCOL.md` and `LAUNCH_CHECKLIST.md`** (`09f166e`, 291 lines).
  The protocol's core: *additive changes fail loudly, access changes fail
  silently*. Green work proceeds; Red — RLS, triggers, grants, updates on live
  rows, `app_settings`, storage flags — stops for Kila. Lovable's scanner will
  keep flagging the venture self-accept policy as Critical; **"Try to fix all"
  must never be clicked** on a Red finding. `SUPABASE_PRODUCTION_MIGRATION_PLAN`
  retired in the same commit.
- **Five tabs** (`2a8648f`, 527 insertions). New `ChatsScreen` aggregates the
  Tribe room, Venture party chats and DMs, ordered by permanence. `TribeScreen`
  became a pushed full-screen view with `onBack`. `timeline`→`feed` and
  `tribe`→`chats` kept as legacy redirects.
- **Discover** (`241ce64`) dropped `useNearbyProfiles` and the second list —
  one ranked list, distance as a chip on the card.
- **Messages button removed from every header** (`012ce9c`, −62). Chats has a
  tab now; a header shortcut to it was a second door to one room.
- **Hosting moved off the board into an action** (`be6ac03`, 600 insertions).
  Three inbox sections and `FeatureHero` came out; invites and pending went to a
  pill. Host became a FAB — twice, because the first attempt argued for it and
  did not build it, and the second anchored it to the viewport instead of the
  content column on a `max-w-md` layout.
- **Inter** (`e2b23b2`). Playfair's hairlines were thinning to nothing on the
  dark ground. Space Mono kept for labels, doing the structural work.
- **Profile styling pass** (`91059bd`, `89afbea`, `3d8b5d0`) — card→ground,
  radii down, stats as a rule-separated row, tabs as underlined words. Both
  `Stat` helpers verified identical by md5.

**Lesson recorded at the time:** `89afbea` exists because a `.replace()` without
an assertion silently no-opped on the second occurrence, and the tab swap only
half-applied. Every substitution in that commit asserts its anchor. This is the
second time that failure appeared; it is why the 08-24 work asserts every anchor
before writing.

### 2026-08-21 — Codex — Chats launch announcement thumbnail

- Created a square editorial screen-print announcement visual with exact copy
  `NEW UPDATE` and `CHATS IS HERE`.
- Represented Tribe rooms, Venture planning, and DMs as three conversation
  streams converging into one hub, with one person wearing each Tribe mask.
- Saved the full PNG plus an optimized 1200×1200 WebP in
  `output/announcements/`. No application files or imports changed.

### 2026-08-20 — Claude — SPEC FOR CODEX: Tribe masks in the illustrations

The user has asked Codex directly to regenerate the app illustrations with the
Tribe animal appearing as a masquerade mask on the people. **Codex: read this
before generating.** Two of these are decisions already taken, not suggestions.

**1. Masks are worn UP or as half-masks. Faces stay visible.**

Decided with the user. Push the mask onto the forehead, hold it on a stick
(lorgnette / carnival style), or use a half-mask that leaves the eyes and mouth
visible. Do NOT cover faces.

The reasoning, so this does not get "improved" back to full masks: a
masquerade is *about concealment*, and this product is built on the opposite.
Real display names, handles, adult verification, Hello requests before a
stranger can DM — an entire safety architecture that assumes people are
accountable to an identity. Full masks advertise an anonymity the app
deliberately does not offer, and someone who installs expecting a masked
anonymous space hits the real signup feeling misled. Secondarily, masquerade
carries a romantic register, which is exactly what the Explore deck was
designed away from (see the swipe decision above).

The goal is "a party where people wear their Tribe", not "a party where people
hide".

**2. Output must be transparent, on a flat pure-black background at minimum.**

The nine files in `src/assets/app-illustrations/` were regenerated on
2026-08-20 as **transparent WebP** — the black card they were originally drawn
on has been keyed out, and `FeatureIllustration` no longer draws a card,
border or crop. Shipping black-backed art again silently undoes that and the
black rectangle returns to every empty state.

- Best: emit RGBA with a genuinely transparent background.
- Acceptable: flat **pure #000000**, no vignette, no gradient, no texture, no
  rounded frame or border drawn into the image. Claude re-keys it by
  flood-filling the background from the image border, so the background must
  be one connected near-black region. A gradient or a drawn frame breaks that.
- Interior black is fine and expected — hair, trousers, dark panels all
  survive the key, because it fills from the border rather than keying by
  luminance.
- Keep 600×800 (3:4). `FeatureIllustration` reserves `aspect-[3/4]` and uses
  `object-contain`.

**3. Mask per Tribe — match the existing crests, don't invent new animals.**

`src/assets/tribes/crests/*.webp` are already built like faces (the Night Owl
crest is a brow, two eyes and a beak). Reuse their shape language and palette
so the mask and the badge read as the same object.

| Tribe | key | crest file | palette |
|---|---|---|---|
| Iron Wolf | `wolf` | `iron-wolf.webp` | `var(--tribe-wolf)` |
| Mindful Koi | `koi` | `koi.webp` | `var(--tribe-koi)` |
| Studio Cat | `cat` | `studio-cat.webp` | `var(--tribe-cat)` |
| Night Owl | `owl` | `night-owl.webp` | `var(--tribe-owl)` |
| Honeybee | `bee` | `honeybee.webp` | `var(--tribe-bee)` |

**4. Start with `onboarding-01.webp` and stop for review.**

It is the five-doorways welcome scene and the first thing a new user sees.
Right now nothing indicates which doorway is which Tribe; give each group its
Tribe's mask and the image explains the whole Tribe system before any copy is
read. It is also one file, so the user can judge the direction before
committing to a nine-image regeneration.

**5. Placement rules already set by the user — do not regress them.**

Artwork does not go beside form inputs (it competes with the task). It belongs
on the welcome screen, on feature intros, and in genuinely empty states. This
was corrected once already on 2026-08-20; see the illustration-placement entry
below.


### 2026-08-20 — Claude — Explore ranks on stated signals (`69a9ae2`)

**The bug, and why it was invisible.** `list_nearby_profile_matches` was the
only scored discovery path in the app. It INNER JOINs `profile_locations` on
*both* sides and requires `discoverable`. So any user who had not granted
browser geolocation got zero scored rows and fell through to
`listDiscoverProfiles`, which is `order by created_at desc`. At launch density
that is what Explore actually was for nearly every user: a list of whoever
signed up last, with no relevance signal of any kind. Nothing errored, so it
looked like it worked.

**New:** `supabase/migrations/20260820002200_explore_relevance.sql` —
`public.list_explore_matches(_limit, _offset)`.

Scoring, 0–100:

| Signal | Points |
|---|---|
| Any shared social intent | 30 |
| Each shared interest (capped) | 10, max 30 |
| Any shared availability | 15 |
| Hosts an open Venture with a free seat | 15 |
| Within the mutual radius | 10 |

- **Location is a LEFT JOIN.** No location means no proximity bonus, not an
  empty result set. This is the whole fix.
- **Sharing a Tribe is worth 0, deliberately.** Under exclusive membership,
  tribemates are already directly reachable and Explore is the *cross-Tribe*
  bridge. Boosting them would fill the deck with people the user can already
  message and starve the one surface that crosses Tribes. They stay in the pool
  (a large Tribe contains strangers) and `same_tribe` is returned so the UI can
  label them honestly.
- **The open-Venture lateral respects scope.** A `scope = 'mine'` Venture is
  only surfaced to someone who shares the host's Tribe — advertising a door the
  viewer would be refused at is worse than not mentioning it.
- **Distance bands are disclosed only inside the mutual radius.** `radius_km` is
  a consent setting, not a display filter: someone who chose 5 km is saying
  "people further away should not be told where I am". An earlier draft of this
  migration leaked "Within 50 km" to anyone within 50 km regardless. Caught in
  testing, fixed before commit.
- Ordering is `score desc, updated_at desc, id` — `updated_at` rather than
  `created_at` so equal matches favour recently-active people over recent
  signups, and `id` last so offset pagination cannot duplicate or skip.

**Why the RPC returns the matched signals.** A bare "78% match" is not
information — the user cannot tell whether it means shared taste or shared
postcode, so it reads as decoration. `src/lib/explore-reasons.ts` turns the
signals into chips ("Both want activity partners", "Also into Outdoors &
Coffee") and into a suggested Hello opener. The opener is **offered, never
prefilled** — an opener everybody sends identically is worth less than none.

**Client:** `explore.functions.ts` (server fn), `explore-store.ts` (paged
query), `explore-reasons.ts` (phrasings — written out, not derived from picker
labels, which produce "Both want make friends"). `DiscoverScreen` now runs two
queries: no search term is a *ranking* question and uses the RPC; a search term
is a *lookup* and stays on `listDiscoverProfiles`.

Also added: an honest end-of-pool line in the deck when it wraps, deck-driven
auto-paging, and a prompt for users with no interests/intents/availability —
their ranking is necessarily arbitrary and the app should say so rather than
present noise as a recommendation.

**Verified against Postgres 16, not by inspection.** Seven cases: viewer with no
location row, proximity-as-bonus, `discoverable = false` neighbour, stable
offset pagination across three pages, viewer with an entirely empty profile, and
both sides of the mutual-radius band rule. `tsc --noEmit` and `vite build` pass.

**Note for Codex:** `list_explore_matches` is not in
`src/integrations/supabase/types.ts` yet, so `explore.functions.ts` casts. If
you regenerate types, drop the cast.

### 2026-08-20 — Claude — one Tribe per user, Hellos, DM gating

- `20260820002000_one_tribe_per_user.sql` — exclusive membership, 21-day
  cooldown, 7-day onboarding grace, `tribe_members` reconciled on change.
  Also closed a real gap: leaving a Tribe updated `profiles.tribe_ids` but never
  deleted the `tribe_members` row, so a departed member kept database-level
  access to that Tribe's chat forever.
- `20260820002100_hellos_and_dm_gating.sql` — `hellos` table, one per
  sender/recipient pair ever, monthly cap by trigger, and `can_direct_message()`
  with four ways in: tribemates, an accepted Hello, a shared active Venture, or
  an existing thread. The last one matters — without it, switching Tribe would
  sever conversations already in progress.
- **Landmine, cost me a failed `db reset`:** `tribe_members.tribe_id` is a
  **uuid** referencing `tribes.id`, while `profiles.tribe_ids` is a **text[] of
  tribe keys** (`'wolf'`, `'koi'`). They cannot be compared directly —
  `operator does not exist: uuid = text`. Always join through `public.tribes`
  and match `t.key = any (p.tribe_ids)`. Membership rows also carry the profile
  in *both* `user_id` and `profile_id`, so match on either.
- `AddTribeSheet` is now a switch flow. The old "Add Tribe" button was
  conditioned on `tribeIds.length < 3`, which under exclusive membership would
  have made it vanish entirely. It is **Move** now.

### 2026-08-20 — Codex — MEUTUALS logo in app header

- Replaced the temporary gold `M` monogram in the shared `AppHeader` with the
  existing MEUTUALS eye mark across Discover, Timeline, Tribe, Ventures, and
  Profile.
- Added a tightly cropped 128×128 `logo-mark.webp` optimized specifically for
  the 36 px header slot (2.7 kB), avoiding the 820 kB full login-logo payload
  while keeping the exact brand artwork.
- Preserved semantic `alt="MEUTUALS"` text and the contextual accent outline.
  `npx tsc --noEmit` and `npm run build` pass with only existing warnings.

### 2026-08-20 — Codex — matching editorial Tribe crests

- Completed the second promised visual tier: five compact editorial crests
  derived from the new large illustrations. Each uses the same near-black,
  warm-ivory, dominant Tribe color, secondary accent, and tactile screen-print
  language as its portrait counterpart.
- Replaced the five stable files in `src/assets/tribes/crests/`; every
  `TribeMark` consumer updates automatically. Production crests are 256×256
  WebPs (8.6–11.9 kB), readable across the component's 20–80 px size range.
- Preserved the prior crests in `_to_delete/previous-tribe-crests/` and the
  generated PNG sources in
  `_to_delete/generated-editorial-crest-png-sources/` for sign-off/recovery.
- Re-ran `npx tsc --noEmit` and `npm run build`; both pass with only the
  existing chunk-size and third-party bundler warnings.

### 2026-08-20 — Codex — editorial Tribe illustration system

- Completed the approved five-piece editorial illustration family for Iron
  Wolf, Mindful Koi, Studio Cat, Night Owl, and Honeybee. Each portrait centers
  a real social behavior, uses black/ivory screen-print linework, and carries a
  distinct dominant/secondary Tribe palette.
- Replaced the five existing large card assets in `src/assets/tribes/` under
  their stable filenames, so onboarding and Discover update without component
  or data-model changes. Production files are 900×1200 WebPs (108–147 kB).
- Moved the previous tarot artwork recoverably to
  `_to_delete/previous-tribe-art/`. Preserved named PNG sources for the new set
  in `_to_delete/generated-editorial-tribe-png-sources/`; these folders can be
  binned after visual sign-off.
- `npx tsc --noEmit` and `npm run build` pass. The build retains only its
  existing chunk-size and third-party bundler warnings.

### 2026-08-20 — Codex — Mindful Koi rename

- Renamed the Koi Tribe's user-facing label to `Mindful Koi` in the shared
  Tribe catalog while preserving the stable internal `koi` key, asset paths,
  memberships, and database relationships.
- Added and applied migration
  `20260820001500_rename_koi_tribe.sql`; the local catalog now returns
  `koi:Mindful Koi`.
- `npx tsc --noEmit` and `npm run build` pass. The build retains only its
  existing chunk-size and third-party bundler warnings.

### 2026-08-20 — Codex — coherent Tribe crest system

- Generated five compact illustrated crests from the approved semi-tarot Tribe
  artwork and optimized them to 256 px WebP assets (13–33 kB each). The full
  tarot illustrations remain the storytelling layer; crests are now the
  identification layer for small UI surfaces.
- Added the reusable `TribeMark` component with consistent sizing, color-aware
  rings, decorative/semantic alt behavior, and a strong silhouette down to
  20 px.
- Replaced Tribe identity emojis across Discover, Timeline, profile history,
  Manage Tribes, Tribe chat/switching, public profiles, and host dashboard.
  Discover cards now use the full illustration with crest/name/member-count
  overlays. Native host selects use text because native options cannot render
  images reliably.
- Removed the obsolete `emoji` field from the shared Tribe model. Emoji that
  remains in chat copy, quick reactions, or the generic avatar picker is user
  expression rather than Tribe identity.
- Preserved the generated PNG sources recoverably in
  `_to_delete/generated-tribe-crest-png-sources/`; production imports use only
  the optimized WebPs under `src/assets/tribes/crests/`.
- Verified the onboarding flow at 390×844 through location and profile signals
  with zero application console errors before the browser harness became
  unreliable. Removed the disposable local account afterward (`DELETE 1`).
  `npx tsc --noEmit` and `npm run build` both pass; the build emits only the
  existing chunk-size and third-party bundler warnings.

### 2026-08-20 — Codex — illustrated Tribe flip cards

- Replaced the oversized horizontal onboarding cards with one focused,
  accessible collectible card. Arrow/dot controls browse, tapping the card
  flips it, and the primary action alone selects/continues, avoiding ambiguous
  swipe-versus-select behavior.
- Generated a cohesive five-image “modern social tarot” set with OpenAI's
  built-in image generator: Iron Wolf, Koi, Studio Cat, Night Owl, and
  Honeybee. Optimized the ~12 MB PNG sources to five 102–131 kB WebP assets in
  `src/assets/tribes/`; original PNGs were moved recoverably to
  `_to_delete/generated-tribe-png-sources/`.
- Added real card-back content for every Tribe: motto, general purpose, three
  representative activities, and whom the community suits. The CSS-only flip
  respects reduced-motion preferences and exposes useful pressed/label states.
- Validation: clean `tsc --noEmit`, successful Cloudflare production build,
  and real-browser 390×844 checks of artwork, flip, selection, and responsive
  layout with zero application console errors. The exact disposable local test
  account was deleted afterward.

### 2026-08-20 — Codex — interactive onboarding and essential Settings

- Added one reusable accessible password field to login, signup, and password
  recovery. The 48px reveal control exposes pressed state and swaps its label
  between Show/Hide without changing submission or autocomplete behavior.
- Reworked home-Tribe selection into a one-card-per-view CSS scroll-snap deck
  with adjacent-card affordance, stronger selected state, and no JS animation
  dependency. Replaced dense onboarding chips with icon-backed, 44px+ choice
  tiles and clearer immediate selection feedback.
- Changed home location from one combined global list to progressive Country →
  City selection. Values remain standardized and local; nearby remains a
  separate explicit device-location step because browser GPS cannot prove a
  user has not spoofed their coordinates. Added visible range/confirmation/
  ready status to that step.
- Structured Settings into Account, Notifications, Nearby discovery, Safety &
  privacy, Blocked accounts, and account lifecycle. Added only working routes
  and actions (edit profile, signed-in email, password reset, Guidelines,
  Privacy, Terms, logout, deletion), and migrated the sheet to `AnimatedModal`
  for focus trapping, Escape, and dialog semantics.
- HCI basis: progressive disclosure, recognition over recall, visibility of
  system status, Fitts's Law, error prevention, Gestalt proximity/common region,
  and user control. Validation: clean `tsc --noEmit`; successful Cloudflare
  production build; real-browser password reveal test with zero console errors.

### 2026-08-20 — Codex — Discover nearby controls and HCI pass

- Added a compact, 44px+ `15 km` / `Paused` status control beside “People
  near you.” It opens an accessible bottom sheet for the two contextual actions:
  pause/resume and mutual discovery radius. Refresh/remove and the complete
  privacy explanation remain in Settings.
- Removed people already displayed nearby from general discovery. The empty
  state now truthfully explains when every loaded person is already shown above.
- Applied progressive disclosure and Hick's Law (two contextual choices),
  Gestalt proximity/common region (control beside its result set), recognition
  over recall (visible radius/status), visibility of system status (live labels
  and pending states), Fitts's Law (44px+ targets), and error prevention
  (pending controls lock; failed mutations surface feedback).
- Validation: clean `tsc --noEmit`, successful Cloudflare production build,
  and a real 390×844 browser walkthrough covering the compact control, modal,
  pause/resume, list movement, deduplication, and truthful empty state with zero
  application console errors. The disposable test account was deleted.

### 2026-08-20 — Codex — nearby visibility toggle fix

- Replaced the hand-positioned nearby visibility toggle with the shared Radix
  switch primitive. The thumb now remains inside its track in both states and
  the control has correct checked, keyboard, focus, and pending semantics.
- Added visible mutation-error feedback instead of silently leaving the switch
  in an uncertain state. Validation: clean `tsc --noEmit`.

### 2026-08-20 — Codex — standardized city, radius, and toast UX

- Replaced free-typed profile cities with a searchable, keyboard-accessible
  world-city selector. Values are standardized as `City, Country`, grouped by
  region, and sourced from a local catalog so searches do not leak to a
  third-party geocoder. The same control is used during onboarding and profile
  editing.
- Replaced the three radius buttons with a reusable Radix slider in onboarding
  and Settings. It retains the privacy-reviewed 5/15/50 km choices while adding
  clear Close/Local/Wide labels, a live value, touch support, and keyboard
  Home/End/arrow behavior.
- Moved Sonner notifications out of the bottom action area and below the
  safe-area/header zone, tightened stacking, and refined the surface styling.
- Validation: clean `tsc --noEmit`, successful Cloudflare production build,
  and a real 390×844 browser walkthrough of city search/selection, required
  gating, slider touch/keyboard behavior, and toast placement with zero console
  errors. The disposable account was deleted afterward.

### 2026-08-20 — Codex — rich profiles and privacy-safe nearby discovery

- Rebuilt onboarding as four purposeful steps: home Tribe, identity and unique
  handle, interests/social intent/availability, then optional nearby consent.
  Required social signals now prevent empty profiles from entering Discover;
  city-only continuation remains available.
- Added `20260820001400_rich_profiles_and_private_nearby.sql`. Rich matching
  fields are constrained in Postgres. Approximate coordinates live in a
  separate owner-private table with mutual 5/15/50 km visibility.
- Added a security-definer nearby RPC that explicitly checks adult status,
  suspension, mutual radius, and two-way blocks. It returns only profile IDs,
  distance bands, and 0–100 scores derived from Tribes/interests, intention,
  availability, and proximity—never coordinates.
- Added profile signal chips, completion guidance for legacy profiles, complete
  edit support, and Settings controls to enable, pause, refresh, resize, or
  delete approximate location. Public profiles show the new social signals.
- Discover now separates true nearby matches from general discovery and has
  explicit loading, off, paused, empty, and error states. The privacy page now
  describes the new optional data and no-background-tracking behavior.
- Validation: clean fresh migration replay; rollback-only RLS/RPC test proved
  owner-only coordinate reads, distance/radius filtering, and immediate block
  exclusion; a real 390×844 browser walkthrough passed signup through nearby
  onboarding, persistence, pause state, matching presentation, profile edit,
  and Settings with zero console errors. Clean `tsc --noEmit` and successful
  Cloudflare production build. Disposable browser/SQL accounts were removed.

### 2026-08-20 — Codex — onboarding avatar action badge

- Split the avatar crop circle from its upload-label wrapper so the camera
  badge can sit outside the circle without being clipped.
- Added a contrasting ring/shadow and an accessible upload label while keeping
  only the profile image itself cropped.
- Validation: clean `tsc --noEmit`.

### 2026-08-20 — Codex — onboarding viewport bug

- Fixed profile creation on short/mobile viewports: the onboarding root no
  longer clips vertical overflow, uses dynamic viewport/safe-area sizing, and
  keeps the final action reachable by scrolling.
- The final action now exposes a pending state and prevents duplicate submits
  while the profile or avatar is saving.
- Validation: clean `tsc --noEmit`.

### 2026-08-20 — Codex — end-to-end flow audit and Week 3 engineering pass

- Wrote `MEUTUALS_FLOW_AUDIT.md`, covering every reachable free-launch flow
  from authentication through Tribes, Timeline, Discover, DMs, notifications,
  Ventures, safety, moderation, settings, and account deletion. The essential
  two-account social and Venture loop passed in a real local browser.
- Fixed durable DM read receipts, message/Venture notification routing and
  kinds, relative-time copy, modal descriptions, push-prompt timing, Timeline
  error state, Tribe leaving, Venture safety copy, and the missing shared-post
  route with a post-login return path.
- Added `20260820001100_fix_dm_receipts_and_venture_notifications.sql`,
  `20260820001200_moderation_queue.sql`, and
  `20260820001300_baseline_text_safety_filter.sql`. The moderation queue has
  role gating, 24-hour due timestamps, hide/suspend/dismiss actions, hidden and
  suspended-content enforcement, and an immutable decision log. A resolved
  hide-content case passed both SQL and browser validation.
- Added database-level baseline harmful-text rejection to every user-content
  surface. Fresh replay and live rejection tests passed after correcting the
  generic trigger to inspect rows through JSONB.
- Added Apple OAuth entry points, auth autocomplete hints, consistent MEUTUALS
  metadata, and corrected the privacy page's service/data map. Apple provider
  credentials, real legal/contact information, image moderation, moderator
  operations, and production push/OAuth delivery remain external launch work.
- Validation: fresh full migration replay through `20260820001300`, live SQL
  safety/moderation tests, zero-error moderator and auth browser checks, clean
  `tsc --noEmit`, and successful Cloudflare production build. The only browser
  warning is the intentional local-dev realtime disable notice.

### 2026-08-20 — Codex — P4 constant-time post counters

- Added `20260820001000_constant_time_post_counters.sql`. Like, comment, and
  share triggers now adjust their post counter atomically by `+1` or `-1`
  instead of running a full-table `count(*)` after every interaction.
- Reconciled all existing counters once during migration and clamped deletes
  at zero to prevent negative drift.
- Validation: clean `tsc --noEmit`, production build, fresh migration replay,
  and live insert/delete tests for two likes, comments, and shares. Function
  inspection confirms no trigger body still performs a recount.

### 2026-08-20 — Codex — P3 newest conversation windows

- DMs, comments, Tribe chat, and Venture party chat now query newest-first
  before applying their bounded limits, then reverse the returned window for
  chronological rendering. Busy conversations no longer freeze permanently on
  their oldest 100/500 records.
- Validation: clean TypeScript and a source audit confirming no remaining
  bounded chat/comment query orders oldest-first.

### 2026-08-20 — Codex — L7 database-enforced adult verification

- Signup now collects a neutral date of birth before email or Google account
  creation. Eligible email signups carry DOB into the auth trigger; OAuth and
  legacy accounts receive a dedicated first-session verification screen.
- Added immutable, server-derived age verification fields. A first ineligible
  DOB locks that account and cannot be replaced with a more convenient date.
  The former editable age field was removed from onboarding/profile updates.
- Added restrictive RLS for profiles, posts, comments, DMs, Tribe chat, and
  Ventures; unverified accounts can read only their own profile. Database
  triggers independently reject unverified writes to all high-risk social and
  meetup tables, and a restrictive Storage policy blocks image uploads.
- Validation: clean TypeScript, fresh migration replay, and live database tests
  for adult, underage, and OAuth-incomplete profiles. Tests proved read denial,
  write denial, successful one-time adult verification, and immutable DOB.

### 2026-08-20 — Codex — L6 complete account deletion

- Account deletion now enumerates and removes every owned avatar and post
  image, plus current and legacy Tribe-chat attachment path shapes, before any
  database/auth deletion begins. Storage listing and removal are paginated and
  batched; a Storage error aborts the deletion instead of leaving orphaned
  media behind.
- Added `20260820000800_preserve_reports_on_account_delete.sql`. Reports now
  survive reporter deletion with `reporter_id` anonymized to `NULL`; reports
  about a deleted user, post, or comment receive `target_deleted_at` before the
  underlying profile/content cascades away.
- Updated generated Supabase report types for the nullable reporter and new
  deletion markers. Added the missing bounded `undefined` validator to the
  account server function.
- Validation: clean `tsc --noEmit`, production build, fresh migration replay,
  and a rollback-only live database test covering user/post/comment reports.
  All three reports remained after target deletion, then remained anonymized
  after reporter deletion.

### 2026-08-20 — Codex — L3 safety controls on essential surfaces

- Added report/block access to direct-message headers, individual comments,
  Tribe chat messages, Venture party-chat messages, open/joined Venture cards,
  applicant rows, and public profiles. Own content and own-profile surfaces do
  not expose self-directed controls.
- Extended `SafetyMenu` with comment-specific reporting and made blocking
  available whenever a content author is known, including post/comment/chat
  surfaces. Its report flow now uses the shared Radix-backed `AnimatedModal`
  for focus trapping, Escape, and outside-click behavior.
- Validation: clean `tsc --noEmit` and production build. The first sandboxed
  build attempt could not spawn esbuild (`EPERM`); the approved build outside
  that process restriction completed successfully.

### 2026-08-20 — Codex — S6 private Tribe chat attachments

- Added `20260820000700_private_tribe_chat_attachments.sql`, which disables
  public delivery for the `tribe-chat-attachments` bucket. The existing app
  already stores object paths and renders one-hour signed URLs.
- Fresh migration replay and live inspection pass: the bucket is private and
  SELECT remains restricted to authenticated members of the path's Tribe.

### 2026-08-20 — Codex — S5 Venture scope enforcement

- Added `20260820000600_enforce_venture_scope.sql`. The database now enforces
  the existing “mine” rule: an open Venture is visible only to users sharing a
  Tribe with its host. Hosts and applicants retain access.
- The same scope check is now required to apply, preventing a known UUID from
  being used to join an out-of-scope Venture and gain access afterward.
- Fresh migration replay and live policy inspection pass. The helper is
  `SECURITY DEFINER`, scoped to the current user, and unavailable to `anon`.

### 2026-08-20 — Codex — S4 DM evidence preservation

- Added `20260820000500_preserve_dm_evidence.sql`. It replaces the permissive
  recipient-or-sender DELETE policy with one that permits only the sender to
  delete a message. A future “delete for me” feature must use per-user
  visibility state rather than destroying reportable evidence.
- Fresh local migration replay succeeded. Direct inspection confirms the final
  policy is `auth.uid() = sender_id` for authenticated users.

### 2026-08-20 — Codex — S3 private post-image storage

- Added `20260820000400_secure_post_images.sql`: converts legacy public post
  image URLs to object paths, makes the `post-images` bucket private, and
  grants authenticated storage reads only to the owner or viewers authorized
  to read the linked post. A trigger prevents direct clients from attaching
  another user's object to their post.
- Post uploads now persist the private object path. Feed responses mint
  one-hour signed URLs after the post query has passed RLS; composer and editor
  use local previews while the image has no post to authorize it yet.
- Validation: clean `tsc --noEmit`, production build, and a fresh
  user-authorised `supabase db reset`. Direct database inspection confirms
  `post-images.public = false`, the authenticated storage policy, and the
  ownership trigger. Repository lint remains pre-existing red due to broad
  Prettier violations outside this change.

### 2026-08-20 — Codex — S2 migration replay verified

- User-authorised `npx supabase db reset` completed successfully; the fresh
  local database applied `20260820000300_fix_two_way_blocking.sql`.
- Read-only inspection confirms the final posts, comments, and DM insert
  policies call `has_blocked`; the function is `SECURITY DEFINER` and only
  `authenticated`, `service_role`, and `postgres` have `EXECUTE`.

### 2026-08-20 — Codex — S2 two-way blocking RLS fix

- Added `20260820000300_fix_two_way_blocking.sql`. It restores
  `public.has_blocked` as a `SECURITY DEFINER STABLE` function with its search
  path pinned to `public`; `anon` is denied execution and `authenticated` is
  allowed. The function only evaluates pairs involving the current user, so it
  cannot be used to probe other users' block relationships.
- Rebuilt the active post and comment SELECT policies to use the helper, and
  rebuilt the DM INSERT policy so either participant's block prevents delivery.
  This fixes the RLS-filtered inline subqueries that made reverse-direction
  blocks invisible.
- Validation: `node_modules\\.bin\\tsc.cmd --noEmit` and `npm run build` pass.
  The local migration replay remains unrun because `npx supabase db reset`
  destructively recreates the local database and needs user approval. After a
  reset, test both directions: a block must hide posts/comments and reject a
  DM from either participant.

### 2026-08-20 — Claude — Repo reproducibility + agent docs

- **Ported 4 migration fixes from the user's machine into the repo.** The
  device copy had guards the repo didn't, so a fresh clone + `db reset` would
  hit three replay failures that had already been debugged once:
  - `20260517012906` — tribe_messages policy block wrapped in a
    `to_regclass` guard (file predates the table's creation on fresh replay)
  - `20260517013816` — `realtime.messages` RLS wrapped to tolerate
    `insufficient_privilege` (local migration role isn't the owner)
  - `20260517014151` — added 3 missing `drop policy if exists` (policies were
    already created by `20260516123000`, so recreation failed)
  - `20260811000000_local_dev_base_grants.sql` — new; base role grants the
    hosted platform applies automatically but that were never in a migration
- Added `AGENTS.md` and this `DEVLOG.md`.

### 2026-08-20 — Claude — Week 1 production fixes (`7a25853`)

- **CRITICAL security fix:** `venture_applications` self-accept. Two permissive
  UPDATE policies let an attacker satisfy one policy's `USING` and another's
  `WITH CHECK`, so any user could apply to an open Venture then PATCH
  themselves to `accepted` — gaining the private party chat and meetup
  location with no host approval. Collapsed to one policy; moved legal status
  transitions into the `BEFORE UPDATE` trigger.
- **Store blockers:** removed the mock card checkout (prefilled
  `4242 4242 4242 4242` + "Pay $6.99" that slept 1200ms — automatic Apple
  3.1.1 rejection). Gated `/tiers`, `/upgrade`, `/host`, `/host-dashboard`
  behind `MONETIZATION_ENABLED` via `beforeLoad` + `notFound()`.
- **Scale:** removed 5 unfiltered realtime bindings; mount only the active tab
  (was ~21 requests/load); `refetchOnWindowFocus: false`, `retry: 1`; added 11
  missing indexes incl. `follows.followee_id` (seq-scanned on every post insert).
- **Correctness:** push dispatch URL was hardcoded to a `lovable.app` preview
  domain → push silently dead in production. Now read from Vault, logs on
  failure instead of swallowing. **User must set `push_dispatch_url` in Vault
  per environment — see the migration header.**
- Removed fabricated content: phantom posts on your own profile, hardcoded
  five-figure tribe member counts, page-limited Discover counts.

### 2026-08-20 — Claude — Production audit

- Four parallel audits (security/RLS, legal+store, scale, product reality).
- Output: `MEUTUALS_PRODUCTION_AUDIT.md`.
- Headline: real product, not a shell — backend is genuinely well built. Two
  problems: a fixable blocker set (~3 weeks) and one unmade structural
  decision (audience primitive).

### 2026-08-19 — Claude — Animation simplified (`b6e9713`)

- Reverted the Motion pass to CSS-only fades at user request; removed the
  `motion` dependency entirely (~279 kB out of the bundle). Modals kept their
  Radix a11y wins.

### 2026-08-19 — Claude — Rebrand + dead feature fixes (`4f11a37`)

- MUTUALS/Moots → MEUTUALS across user-facing copy.
- Blocked Accounts UI now shows real blocked profiles (was always empty).
- Delete Account actually deletes (was sign-out only).
- Reconciled two duplicate Ventures implementations; deleted the legacy one.
- Rotated the push-dispatch secret into Vault (plaintext was committed twice).
  **Still needs rotating on the hosted production project — not done.**
