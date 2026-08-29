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

| Phase                                             | Status                                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Week 1 — critical security, store blockers, scale | ✅ done (commit `7a25853`)                                                                                                            |
| Week 2 — safety & correctness                     | ✅ done (2026-08-20)                                                                                                                  |
| Week 3 — compliance & launch prep                 | 🟡 engineering pass complete; external launch work remains                                                                            |
| Product: audience-primitive decision              | 🟡 recommended, **awaiting user decision**                                                                                            |
| Ventures: times + board + tickets                 | ✅ done (2026-08-24)                                                                                                                  |
| Ventures: venue picker + distance bands           | ✅ manual Venue code + DB verified; Google precision intentionally disabled pending team decision                                     |
| Ventures: accepted-member venue + map             | ✅ code + approved Red migration verified                                                                                             |
| Installed PWA                                     | ✅ implementation complete; production deployment and physical iOS/Android acceptance remain                                          |
| Tribe Room participation loop                     | 🟡 DB migrations applied and all release checks verified; signed-in device acceptance remains                                         |
| Chat capability parity                            | ✅ code complete; Red migration applied manually and every Lovable release check confirmed `true`                                  |

---

## In flight

Claim before you start. Remove your row when done and log it below.

| Agent | Area | Files | Started |
| ----- | ---- | ----- | ------- |

Claude's Tribe-first phase and the Explore relevance pass are both **complete**
and logged below.

---

## Decided — do not re-litigate

| Decision                                | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Brand name**                          | `MEUTUALS` (not MUTUALS, not Moots). User chose this spelling explicitly. Internal identifiers stay lowercase `mutuals` — component dir, `mutuals-data.ts`, package name. Don't "fix" those.                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Pricing copy**                        | User said **leave both** `/tiers` and `/upgrade` as-is. They contradict each other and the DB; that is known and accepted. Don't touch pricing content. Both routes are now gated behind `MONETIZATION_ENABLED`.                                                                                                                                                                                                                                                                                                                                                                              |
| **Payments**                            | Free at launch. No processor. When it happens: StoreKit / Play Billing / hosted checkout — **never** an in-app card form (Apple 3.1.1). Entitlement must be granted server-side from the store webhook, since `profiles.plan` is deliberately not user-writable.                                                                                                                                                                                                                                                                                                                              |
| **Animation**                           | Minimal CSS fades only. `motion` was added then removed at user request. Don't reintroduce a JS animation library.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Modals**                              | All go through `src/components/ui/animated-modal.tsx` (Radix Dialog + CSS). It provides focus trap, ESC, click-outside. Don't hand-roll `fixed inset-0` modals.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Nearby discovery**                    | Optional and mutual. Browser location is requested only after an explicit action, rounded to roughly 1 km before storage in an owner-private table, and never returned to other users. For Indonesia, the same rounded coordinate (without account identity) is resolved through BIG's official village/kelurahan → district → regency/city boundary ladder, then the offline world-city catalog. Village is used only to establish the hierarchy; public labels stop at district plus regency/city. Discovery exposes distance bands plus a similarity score; no map or background tracking. |
| **Google Venue precision**              | Manual host-authored place + area is the production Venue flow. Google search, badges, external maps, embeds, and server calls are gated by `GOOGLE_PLACES_ENABLED = false` pending a team decision on API terms, restrictions, and quota. Re-enable through that single flag only after credentials are approved.                                                                                                                                                                                                                                                                            |
| **Pushing to remote**                   | User-authorised only. Both agents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **One Tribe per user**                  | Exclusive membership. 21-day switch cooldown with a 7-day onboarding grace window. `profiles.tribe_ids` is capped at 1 by trigger, and `tribe_members` is reconciled on every change. Multi-Tribe is gone — don't reintroduce "Add Tribe" anywhere; the affordance is **Move**.                                                                                                                                                                                                                                                                                                               |
| **Global vs Tribe timeline**            | Global is look-but-don't-touch: read, like, comment, repost — but no direct Follow or DM across Tribes. Crossing Tribes goes through Explore → Hello → accept. Enforced in `can_direct_message()`.                                                                                                                                                                                                                                                                                                                                                                                            |
| **Moots after Ventures**                | A Moot is reciprocal and opt-in, never inferred from DM access or created automatically. Completed Venture rooms become read-only **Venture Memories** with a participant recap; an accepted Hello is the current relationship record behind Add as Moot / Accept / Moots states. This does not settle the feed audience/follows decision below.                                                                                                                                                                                                                                              |
| **Swipe lives on Ventures, not people** | Judging a plan, not a face. Explore uses focused one-at-a-time cards with Next/Back where Next means _later_, not _never_. Reject-forever on people needs a pool of thousands and imports dating semantics; user agreed.                                                                                                                                                                                                                                                                                                                                                                      |
| **Illustration masks**                  | Tribe animals appear as masks **worn up / half-masks with faces visible** — never full face-covering. A masquerade signals anonymity, and this product is built on accountable identity (real handles, adult verification, Hello gating). Full masks would also pull toward the romantic register the Explore deck was designed away from.                                                                                                                                                                                                                                                    |
| **Which art is transparent**            | Everything is transparent RGBA now (app illustrations 600x800, Tribe portraits 600x800, crests 256x256) and that is correct — an earlier note here said the Tribe portraits had to stay opaque; testing against the real card colour disproved it. What background-use _does_ require is an opaque surface behind the art, which is the container's job: `bg-card` on the Tribe banner and the Discover flip cards.                                                                                                                                                                           |
| **Illustration assets**                 | `src/assets/app-illustrations/*` are **transparent WebP**. `FeatureIllustration` draws no card, border or crop. Any regeneration must preserve transparency, or ship on flat pure #000000 with no vignette/gradient/frame so it can be re-keyed. Black-backed art puts the rectangle back in every empty state.                                                                                                                                                                                                                                                                               |
| **Explore ranking**                     | `list_explore_matches` scores on stated signals. Location is a **bonus, never a gate** — that regression is what made Explore newest-first for most users. Sharing a Tribe is worth **0** on purpose: tribemates are already reachable, and Explore is the cross-Tribe bridge. Distance bands are disclosed only inside the mutual radius.                                                                                                                                                                                                                                                    |
| **Explore experience**                  | The default surface is a daily, focused **Today’s five** deck, not a people grid or a scorecard. A user-selected mood transparently reorders already-authorized candidates; it never changes visibility or rejects anyone. “Maybe later” only advances the deck. Search remains a list because lookup and discovery are different jobs; Tribe previews are secondary to people. Do not restore match percentages or swipe/reject semantics.                                                                                                                                                   |
| **Tribe Room participation loop**       | Tribe chat is the live floor, not the whole room. A deterministic Daily Pulse lowers the cost of speaking; loose plan proposals gather explicit interest; only the proposal author can turn one into a real Tribe-scoped Venture; completed Ventures continue into the existing read-only Venture Memory and optional Moot flow. Plans and relationships are never created automatically.                                                                                                                                                                                                     |
| **One live-chat capability set**        | Tribe, Venture, and DM chat share the same composer and message actions: text, private photo attachment, direct camera capture, structured reply, and durable Love / Funny / Support reactions. Completed Venture Memories stay read-only.                                                                                                                                                                                                                                                                                                                                                    |
| **Notification read semantics**         | Opening the notification screen does **not** mark anything read. A row becomes read when the member selects it; **Read all** is an explicit action. Unread activity stays grouped under New regardless of age. Push and in-app taps share the same typed destination mapping so an attention signal always resolves to its source context.                                                                                                                                                                                                                                                    |

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

| ID     | Issue                                                                                                                                                                                                                | Why it matters                                                                                                                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S2** | **Blocking is one-way and silently does nothing.** A policy sub-select checks `blocks` rows the current user can't see, so "did _they_ block _me_" never matches. Affects posts, comments, and the DM insert policy. | A blocked harasser keeps DMing (with push) and keeps seeing the blocker's content. Safety failure **and** Apple 1.2 rejection. **Fix first.**                                                               |
| **L3** | `SafetyMenu` is imported in exactly one file (`PostCard.tsx`). Absent from DMs, comments, tribe chat, Venture cards, applicant lists, party chat, profiles.                                                          | Reviewers test the DM surface specifically. Component already supports it — mostly plumbing.                                                                                                                |
| **S3** | `post-images` storage SELECT policy has no `TO` clause → applies to `anon`. Bucket is public.                                                                                                                        | Anyone can list and download every post image, including tribe-only ones, without an account.                                                                                                               |
| **L6** | Account deletion never touches Storage. No `.remove()` call exists in the repo.                                                                                                                                      | Avatars and post images stay public forever after "permanently delete". Apple 5.1.1(v) + GDPR Art. 17. Also: `reports.reporter_id` cascades, so a victim deleting their account destroys their own reports. |
| **L7** | Age gate is a client-side `Number(age) >= 21`. Signup collects no age; the DB column is nullable.                                                                                                                    | App has stranger DMs and in-person meetups. Largest liability surface.                                                                                                                                      |
| **S4** | DM `DELETE` policy allows `recipient_id`.                                                                                                                                                                            | A harasser can delete their own abusive messages from the victim's account, destroying evidence.                                                                                                            |
| **S5** | Venture SELECT policy permits any `status = 'open'` row; scope filtering is application-only.                                                                                                                        | Tribe-only meetup plans readable by any signed-in user via PostgREST.                                                                                                                                       |
| **S6** | `tribe-chat-attachments` bucket is `public = true` while `uploads.ts` mints signed URLs assuming it's private.                                                                                                       | Signed URLs are security theatre; paths are permanently public.                                                                                                                                             |
| **P3** | Chat/comment queries use `ascending: true` + `limit` → they return the **oldest** N rows.                                                                                                                            | Tribe chat freezes at 100 messages, DMs at 500. A 5-person tribe hits this on day one.                                                                                                                      |
| **P4** | Counter triggers do a full `count(*)` recount per like, and lock the post row.                                                                                                                                       | Viral-post death: like latency grows linearly with like count.                                                                                                                                              |

### Week 3 — compliance (engineering pass 2026-08-20)

| ID     | Status                    | Remaining work                                                                                                                                                                                                           |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **L1** | 🟡 Queue complete         | Moderator roles, 24-hour due timestamps, `/admin/reports`, hide/suspend/dismiss actions, and audit log are implemented and tested. Launch still needs named staff, monitored alerts, and a rehearsed SLA/runbook.        |
| **L2** | 🟡 Text baseline complete | Database triggers reject a narrow high-confidence harmful-text set. Automated image/CSAM/NCII classification and quarantine remain a launch blocker.                                                                     |
| **L5** | 🟡 Data map corrected     | Privacy page now describes Cloudflare, Supabase, OAuth, push, private media, and the data actually collected. Controller identity/address, real contacts, retention/legal basis detail, and counsel/store review remain. |
| **L8** | ✅ Complete               | Venture surfaces now carry report/block controls, two-way block filtering, meet-safely guidance, and accepted-chat location guidance.                                                                                    |
| **L9** | 🟡 Code complete          | Apple entry points and consistent MEUTUALS manifest/title/push metadata are present. Production Apple credentials and working contact inboxes remain external blockers.                                                  |

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

### 2026-08-27 — Codex — Tribe interaction and proposal loop completed

- Removed the Tribe room's centered `max-w-md` frame and reduced the live-chat,
  header, and composer edges to an 8 px mobile gutter.
- Standardized caret-aware `@handle` mentions across posts, comments, Tribe
  chat, and Venture chat. Private rooms only suggest their own members.
- Added database-backed mention notifications and destinations for all four
  surfaces in
  `supabase/migrations/20260827010000_mentions_across_social_surfaces.sql`.
- Reworked the Plans/Propose flow around a clearer low-commitment temperature
  check and a distinct “Turn into Venture” action.
- Venture conversion now creates idempotent `invited` applications for members
  who marked the Tribe proposal Interested. It never auto-accepts or silently
  joins them, and it preserves every existing application state.
- Verification: `npx tsc --noEmit`, 20 focused Node tests, `git diff --check`,
  and `npm run build` all pass. The migration still needs to be applied before
  mention notifications can be released.

### 2026-08-26 — User + Codex — Rich DM/Venture chat database verified

The user manually applied
`supabase/migrations/20260825020000_chat_capability_parity.sql` in Lovable and
confirmed every `LOVABLE_CHAT_PARITY_RELEASE_VERIFY.sql` result is `true`.
Production now has the private 5 MB `chat-attachments` bucket, structured reply
fields, normalized DM/Venture reactions, scope guards, and storage RLS required
by the application release.

### 2026-08-21 — Codex → Claude — Chats launch creative ready

The approved square announcement thumbnail is available as a full PNG and an
optimized 1200×1200 WebP under `output/announcements/`. It is a publishing
artifact only and is not imported into the application.

---

## Work log

Newest first. Append; don't edit past entries.

### 2026-08-29 — Claude — Instagram-style profile photo viewer

- User asked for tapping a profile picture to behave like Instagram's.
  New `AvatarLightbox.tsx`: full-screen black backdrop, the photo shown
  large and circular, tap anywhere (including the photo) to dismiss, plus
  an explicit close button for discoverability. Deliberately simpler than
  the existing `PostMediaLightbox` (which offers pinch/pan/zoom for a
  rectangular post image) - a profile picture is a portrait people look
  at, not something to zoom around, matching Instagram's own treatment.
  Both share the same `AnimatedModal` primitive and safe-area handling.
- Wired into both places this exact avatar-with-Tribe-color-ring pattern
  already exists: `ProfileScreen.tsx` (own profile) and `u.$handle.tsx`
  (public profile) - not just the one the user screenshotted, since it's
  the identical UI element in both places and leaving one updated while
  the other stayed a static image would read as an inconsistency bug on
  its own. Only wired up when there's a real uploaded photo
  (`avatar.startsWith("data:") || avatar.startsWith("http")`) - an emoji
  placeholder avatar has nothing to view full-screen, so it stays a
  plain non-interactive span exactly as before.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full
  Node test suite 73/73, full Cloudflare production build passes. Not yet
  exercised live or deployed.

### 2026-08-29 — Claude — Comments sheet height now driven by visualViewport, not just dvh

- User sent a second pair of screenshots after the `dvh` fix, one from
  Comments and one from a completely unrelated DM thread screen
  (`MessagesPanel`/`ChatComposer`, which has zero `vh`/`dvh` anywhere in
  its CSS) - both showed the exact same rounded "chevron-up/chevron-down/
  checkmark" bar above the keyboard. Since it's pixel-identical across two
  components that share no height logic at all, it can't be either
  component's bug: it's iOS Safari's own system input-accessory toolbar
  (the standard previous-field/next-field/Done control every website's
  text inputs get), rendered as a rounded floating pill because this PWA
  runs fullscreen/standalone with `viewport-fit=cover`. Told the user
  plainly that this specific element is outside any website's control -
  and asked what part of the two screenshots was actually the complaint,
  rather than keep guessing blind after two prior attempts.
- Answer: all three things bothered them (the system bar, the big empty
  black space above the Comments input, and general crampedness) - but
  since the system bar genuinely can't be changed and the DM thread's
  crampedness has no CSS bug behind it (confirmed no vh/dvh there),
  focused the actual fix on the one demonstrably-fixable piece: the empty
  space in `CommentsModal`, which is a real layout bug, not native chrome.
- `h-[80dvh]` was still the whole mechanism, and `dvh` genuinely does
  solve the "address bar collapsing" case - but whether iOS also shrinks
  it for the on-screen keyboard specifically, inside a standalone
  installed PWA, is a documented inconsistency across iOS versions I
  can't verify without the device in hand. Rather than swap to a
  different CSS unit and hope again, switched to the API actually built
  for this: `window.visualViewport` fires real resize/scroll events as
  the keyboard opens and closes regardless of display mode. New
  `useKeyboardAwareSheetHeight` hook in `CommentsModal.tsx`: once the
  visual viewport is more than 150px shorter than `window.innerHeight`
  (the keyboard is almost certainly up, not just an address-bar wobble),
  it hands back an explicit pixel height at 96% of the true visible area
  - overriding `h-[80dvh]` via inline style rather than replacing it, so
  the CSS class keeps working exactly as before whenever the keyboard
  isn't in the picture (desktop, Android, keyboard closed).
- `AnimatedModal` (`animated-modal.tsx`) gained a new optional
  `contentStyle` prop to carry this through - applied after
  `contentClassName` so an inline style can override the CSS-driven
  height, `undefined` by default so every other caller of this shared
  primitive is completely unaffected.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean (this
  edit was substantive, so unlike the earlier one-line touches to this
  file, ran `--fix` on `CommentsModal.tsx` and it's now fully clean - the
  90 pre-existing prettier errors are gone), full Node test suite 73/73,
  full Cloudflare production build passes. Not yet exercised live - this
  is a genuinely more robust mechanism than the previous two attempts,
  but still needs a real device to confirm.

### 2026-08-29 — Claude — Comments sheet used static `vh`, not `dvh` - likely why the iOS PWA keyboard bug persisted

- User tested again on an actual installed iOS PWA (not just Safari) and
  sent a screenshot showing the same class of problem: a large empty gap
  above the comment input, with something else visible in a thin sliver
  just above the keyboard. This is a genuinely different mechanism from
  the earlier two iOS fixes (the CSS-cascade-layers zoom bug and the
  missing safe-area padding) - not a regression of either, a separate bug
  in the same problem space.
- Root cause candidate: `CommentsModal.tsx`'s sheet was sized
  `h-[80vh]`. Plain `vh` on iOS is fixed to the full screen height and
  never shrinks when the on-screen keyboard appears - especially
  unreliable in standalone/installed PWA mode, which is exactly what the
  user is testing and exactly why a plain browser tab might look less
  broken than the installed app. `dvh` (dynamic viewport height) is the
  purpose-built fix for this, and every sibling sheet built this session
  (`HelloRequestsSheet`, `Onboarding`, `SettingsScreen`) already
  correctly uses `dvh` - `CommentsModal.tsx` was the one component still
  on the older unit. Changed `h-[80vh]` to `h-[80dvh]`.
- Honest caveat, unlike the two earlier iOS entries: I'm not fully
  confident this is the complete fix. `dvh` reliably solves the "address
  bar showing/hiding" viewport problem; whether it also correctly
  shrinks for the *on-screen keyboard specifically* in an installed
  standalone PWA depends on iOS actually honoring this app's existing
  `interactive-widget=resizes-content` viewport meta value in standalone
  mode, which is a documented area of real inconsistency across iOS
  versions and display modes that I cannot verify without a live device.
  Said so directly to the user rather than claim this is definitely
  fixed a third time.
- Checked every other `vh` (non-`dvh`) usage in `src/components/mutuals/`
  for the same class of bug: the rest are either whole-page `min-h-screen`
  containers with no keyboard-adjacent input, or `PushPromptModal.tsx`'s
  `max-h-[90vh]` (a max-height cap on a permission prompt with no text
  input at all) - neither matches the reported failure mode, so left
  alone rather than changed on spec.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean
  (pre-existing prettier drift in `CommentsModal.tsx`, confirmed
  unchanged from earlier in this session, left alone), full Node test
  suite 73/73, full Cloudflare production build passes. Not yet exercised
  live - asked the user to re-test on the actual iOS PWA and report back
  rather than assume this closes the issue.

### 2026-08-29 — Claude — Notifications' Back button now matches every sibling page

- User's screenshot showed the Back link with a visible rounded pill
  background, and asked for it to match the rest of the app. Checked the
  other three sub-pages with this exact "Back to the app" header
  (`u.$handle.tsx`, `p.$postId.tsx`, `admin.reports.tsx`) - all three use
  the identical minimal style, no pill, no persistent background:
  `inline-flex items-center gap-1 text-xs text-muted-foreground
  hover:text-foreground`. Notifications was the one outlier, styled with
  `rounded-full`, `hover:bg-secondary`, `min-h-11`, and a focus ring that
  none of the others have.
  Matched it to the confirmed 3-for-3 pattern rather than guess which
  style was "correct" - dropped the pill/background/focus-ring classes to
  the same plain text+icon link the rest of the app already uses. Left
  "Read all" alone - it's unique to this screen, no sibling to compare
  against.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full
  Node test suite 73/73, full Cloudflare production build passes. Not yet
  exercised live or deployed.

### 2026-08-29 — Claude — Fixed the row-softening fix: zero gap between rows

- User's screenshot from the very next message: the rounded unread-tint
  backgrounds had no gap between them at all, so adjacent rows' rounded
  corners touched and merged into one continuous blob instead of reading
  as separate cards - introduced by the previous entry's move from
  `divide-y` borders straight to bare padding, with no actual gap added
  between `<li>`s.
- Added `space-y-1.5` to the `<ul>` in `NotificationSection`. One-line
  fix, but only visible with real unread rows on screen (every row in the
  user's screenshot happened to be unread, which is exactly why this was
  invisible without a live device/browser check).
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full
  Node test suite 73/73, full Cloudflare production build passes. Not yet
  exercised live or deployed.

### 2026-08-29 — Claude — Notification rows: softened, less "table"

- User's screenshot after the Instagram redesign: "visual too stiff." The
  culprits were structural, not stylistic tweaks - `divide-y`/`border-y`
  around each section's `<ul>` drew a full-width hard rule between every
  row and across the top/bottom, and the section header
  (`label-mono` + a `flex-1` horizontal line + a numeric count badge)
  read like a table header, not Instagram's plain section label.
- Removed the dividers entirely - rows are separated by padding and the
  unread background tint alone now, same as Instagram's actual list.
  Section header simplified to a plain bold `font-display` label, no
  rule line, no count. Row background (the unread tint / hover state)
  now lives inside a `rounded-2xl` inset from the screen edges
  (`px-3` instead of `px-1`) instead of a flat edge-to-edge rectangle,
  so each row reads as a soft, distinct row rather than a spreadsheet
  line - bumped vertical padding slightly (`py-3.5` -> `py-4`) to keep
  the rhythm comfortable now that the dividing lines are gone.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full
  Node test suite 73/73, full Cloudflare production build passes. Not yet
  exercised live or deployed.

### 2026-08-29 — Claude — Notifications: Instagram-style redesign + a real iOS header bug

- User asked for an Instagram-like notification screen and reported
  something wrong on iOS specifically for this screen. Investigated the
  iOS report myself rather than guess: `notifications.tsx`'s sticky header
  was missing `pt-[env(safe-area-inset-top)]`, which `Shared.tsx`
  (AppHeader), `SettingsScreen.tsx`, and `TribeScreen.tsx` all already
  have - on a notched/Dynamic-Island iPhone this would sit the back button
  and title flush under the status bar, exactly the kind of thing that
  reads as "the notification screen looks wrong on iOS." Same missing
  padding existed on three sibling routes with an identical header
  (`u.$handle.tsx`, `p.$postId.tsx`, `admin.reports.tsx`) - fixed all four
  since it's the same one-line, safe addition, not scope creep.
- Instagram-style changes, all four confirmed with the user rather than
  guessed at once I saw the current design already had several IG-adjacent
  elements (grouped sections, avatar category badges) worth keeping:
  - Removed the colored left bar marking unread rows; added a small dot
    next to the timestamp instead, matching Instagram's actual unread
    signal.
  - Dropped the bottom "View"/"Open room" text-link row entirely - the
    whole row is already the tap target, an explicit CTA under it is not
    an Instagram pattern.
  - Added a small square post thumbnail on the right for like/comment/
    reply/mention notifications, replacing the chevron when the related
    post has an image - the single most recognizable piece of Instagram's
    activity feed. Needed new data: `listMyNotifications`
    (`notifications.functions.ts`) now batch-fetches image URLs for every
    distinct `post_id` in the page, reusing `attachPostImageUrls` from
    `posts.functions.ts` (now exported) rather than duplicating the
    signed-URL resolution logic. Falls back to the chevron for
    notifications with no `post_id` or no image - no new RLS surface,
    since a viewer already reaches this exact post by tapping the row.
  - Simplified the header: dropped the visible "N NEW"/"Caught up" line
    under the title, kept the same text as an `sr-only` `aria-live`
    announcement so screen readers don't lose that signal.
  - Removed `notificationActionLabel` entirely (`notification-presenter.ts`)
    rather than leave it as dead code once its only call site was gone -
    updated its test to drop the now-nonexistent assertions and added the
    new `post_image_url` field to the test's `NotificationRow` fixture.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean on every
  substantively-touched file (pre-existing prettier drift in
  `posts.functions.ts` and `admin.reports.tsx`, both only touched by a
  single line each, confirmed unchanged via `git stash` diff and left
  alone), full Node test suite 73/73, full Cloudflare production build
  passes. Not yet exercised live or deployed.

### 2026-08-29 — Claude — Moots picker grouped by Tribe

- User's screenshot showed the "New message" Moots drawer as one flat
  list. Grouped it by each Moot's primary Tribe (`tribe_ids[0]`), in the
  app's canonical Tribe order (`TRIBES`) rather than however the RPC
  happened to return them, with a small label-mono header per group
  (`TribeMark` + Tribe name in that Tribe's color) - same visual language
  already used for Tribe accents elsewhere. A Moot with no Tribe at all
  shouldn't be reachable post-onboarding, but falls into a trailing
  "Other" bucket instead of silently vanishing if it ever happens.
- Fixed a real (if minor) hook-dependency bug while doing this: the
  `useMemo` grouping depended on `rows` (`moots.data ?? []`), a fresh
  array literal on every render when `moots.data` is `undefined` - ESLint
  caught it (`react-hooks/exhaustive-deps`). Fixed by depending on
  `moots.data` directly and deriving the fallback array inside the memo.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full Node
  test suite 73/73, full Cloudflare production build passes. Not yet
  exercised live or deployed.

### 2026-08-29 — Claude — Same-Tribe-requires-Hello migration confirmed applied

- User ran `20260829030000_same_tribe_requires_hello.sql`: "Query
  succeeded. No rows returned." Both DM-gating migrations from this
  thread are now confirmed live in production, applied in the right
  order (rule change first, backfill second, though the backfill would
  have worked either way since it only touches `hellos`/`messages`).
  Tribe membership alone no longer grants DM access; existing
  conversations were separately backfilled as Moots. All app-code changes
  from this session (this DM-gating fix, gender, default avatars, iOS
  zoom fix, Settings/Hellos polish) are still queued for one deploy.

### 2026-08-29 — Claude — Moots backfill applied to production

- User ran the corrected `20260829040000_backfill_moots_from_conversations.sql`:
  "Query succeeded. No rows returned." Third attempt, first to actually
  write - the previous two failed before the insert ran (permission
  denied, then an FK violation), so nothing was double-applied. Existing
  conversations without a prior accepted Hello now show up as Moots.
  Unconfirmed whether `20260829030000_same_tribe_requires_hello.sql` (the
  actual same-Tribe rule change this backfill exists to complement) has
  been applied yet - asked in chat rather than assume. The code side
  (HelloModal copy, TribeMembersSheet routing fix) is still queued for
  deploy along with everything else built this session either way.

### 2026-08-29 — Claude — Backfill migration also has to tolerate orphaned messages

- Second failed attempt: after the `DISABLE TRIGGER USER` fix, the same
  migration then failed with `insert or update on table "hellos" violates
  foreign key constraint "hellos_recipient_id_fkey" ... Key (recipient_id)
  =(...) is not present in table "users"`. Production `messages` has rows
  whose sender_id/recipient_id point at a deleted account -
  `messages.sender_id`/`recipient_id` aren't a cascading FK to
  `auth.users` the way `hellos`' are, so a deleted account's old message
  rows just stick around referencing a UUID that no longer exists
  anywhere. `hellos` DOES enforce that FK, so my synthetic insert for that
  pair failed outright instead of silently succeeding with bad data - the
  loud failure this repo's whole change protocol exists to prefer.
- Fixed by filtering the source query itself: only consider `messages`
  rows where both `sender_id` and `recipient_id` still exist in
  `auth.users` before grouping into pairs. This is correct independent of
  the FK error too - a deleted account obviously can't retroactively
  become anyone's Moot.
- Re-rehearsed with the orphan scenario actually reproduced this time
  (not assumed): added a person to the seed who sends a message but is
  deliberately never inserted into the stub `auth.users`, using the same
  `nosuperuser` restricted-owner role from the previous entry. Confirmed
  the filtered migration runs clean with no FK error, the orphaned pair
  gets no synthetic row, and exactly the same 2-row backfill count as
  before for the two legitimate pairs - re-ran the full prior 7-check
  suite alongside it with no regressions.
- Two failed live attempts in a row on the same migration is exactly what
  the rehearsal process exists to prevent, and it still let two production
  data-quality realities through: a privilege restriction the local Docker
  image doesn't have, and an orphaned-data condition the clean synthetic
  seed didn't include. Both are now standing checklist items for any
  future migration that inserts synthetic rows into a live table:
  rehearse as a restricted `nosuperuser` owner (not the image default),
  and seed at least one deliberately-broken/orphaned reference case, not
  just the happy path.
- Not yet re-attempted in production - corrected SQL below, still Red,
  still back up first.

### 2026-08-29 — Claude — Rehearsal gap: DISABLE TRIGGER ALL needs superuser, Supabase's role isn't one

- User ran the Moots-backfill migration; it failed on
  `alter table public.hellos disable trigger all` with `permission denied:
  "RI_ConstraintTrigger_c_25825" is a system trigger`. My Docker rehearsal
  connects as the image's default `postgres` role, which IS a real
  superuser - `DISABLE TRIGGER ALL` includes the internal RI triggers that
  back `sender_id`/`recipient_id`'s foreign keys, and only a superuser may
  touch those. Supabase's SQL editor runs as a role that owns the tables
  but isn't OS-level superuser, so it hit exactly that wall. This is the
  second time this session a fix looked right by reading and by rehearsal
  but failed live for a reason specific to the *privilege level* the
  rehearsal ran under, not the SQL's logic (the first was the CSS
  cascade-layers bug a few entries up).
- Fix: `disable trigger user` / `enable trigger user` instead of `all` -
  scopes to the three triggers this migration actually needs to bypass
  (retry window, monthly cap, notify) and never touches the FK triggers,
  which was never the intent anyway.
- Re-rehearsed properly this time, not just re-run as superuser: created a
  `nosuperuser` role, made it own the stub `hellos`/`messages`/
  `notifications` tables (matching how Supabase's SQL-editor role relates
  to its tables), and first confirmed `disable trigger all` reproduces the
  *exact* same `permission denied: "RI_ConstraintTrigger_..." is a system
  trigger` error as production before touching anything - then confirmed
  the fixed migration runs clean end-to-end as that same restricted role,
  and re-ran the full 7-check verification suite from the previous entry
  against that run. All passed. Container removed after.
- Standing note for future migrations: any migration using `DISABLE
  TRIGGER` must rehearse as a `nosuperuser` owner role, not the Docker
  image's default superuser - the earlier rehearsal's clean pass was a
  false negative.
- Not yet re-attempted in production - corrected SQL below, still Red,
  still back up first.

### 2026-08-29 — Claude — Backfill: existing conversations become Moots too

- Follow-up to the same-Tribe-requires-Hello change: that migration's
  message-history branch already keeps DM access for anyone who was
  already talking, but they'd never show up in each other's Moots list or
  count, or qualify for Moots-based Venture invites, since no Hello was
  ever sent or accepted between them. Asked the user to confirm which
  behavior they wanted rather than assume - they chose to backfill Moots
  status too.
- Scoped broadly, not just to the old same-Tribe bypass: ANY pair with
  real message history and no existing accepted Hello gets one, since a
  pre-existing conversation without an accepted Hello could only happen
  via that bypass or a shared active Venture - both are a real
  relationship, not cold contact.
- `supabase/migrations/20260829040000_backfill_moots_from_conversations.sql`:
  one synthetic 'accepted' row per (least, greatest) unordered pair found
  in `messages` with no existing accepted `hellos` row in either
  direction - `distinct on` picks each pair's single earliest message.
  Sender/recipient direction is whoever sent that first message;
  `created_at` is that message's timestamp (when the relationship
  actually started); `decided_at` is `now()` (when this migration did the
  deciding). Wrapped in `disable trigger all` / `enable trigger all`:
  `hellos_enforce_retry_window` and `hellos_enforce_monthly_cap` exist to
  gate a live user's send action, not an administrative backfill, and
  `trg_notify_on_hello` would otherwise fire a fresh "X said hello"
  notification for a conversation that might be months old.
- This is Red under `CHANGE_PROTOCOL.md` and inserts real rows into a
  production table with live user data - back up before running, unlike
  the schema-only migrations earlier this session.
- Rehearsed on a throwaway Postgres 16 container with a stub `hellos`
  (matching the current constraint/trigger shape exactly, not a
  simplified stand-in, since correctness here specifically depends on
  those triggers behaving right around the disable/enable) plus
  `messages`/`notifications`/`auth.users`. Six scenarios: a real
  conversation with no Hello gets backfilled once, at the correct
  direction and exact source timestamp; a pair that already has an
  accepted Hello is never duplicated; an old declined Hello with no
  actual messages gets no synthetic row; two people who never interacted
  at all get nothing; 50 messages across 120 days collapse into exactly
  one row (volume/perf sanity check); and neither backfilled pair
  produced a notification. Confirmed triggers were correctly re-enabled
  afterward by attempting a live duplicate Hello post-backfill and seeing
  it correctly rejected. Container removed after.
- No app code changes - this is a standalone data migration. Verification
  from the previous entry (tsc/lint/tests/build) still holds; not yet
  applied to production - migration SQL in chat, back up first.

### 2026-08-29 — Claude — Same-Tribe pairs must Hello too, just free

- User: Tribemates should have to send and accept a Hello before they can
  DM or count as Moots, exactly like anyone else - the only difference is
  it shouldn't cost a Hello token. Previously `can_direct_message` had a
  branch that granted DM access purely from shared `tribe_ids`, no Hello
  ever required - Moots (`get_profile_stats`/`listMyMootProfiles`) was
  already strictly "accepted Hello" even for Tribemates, so this was an
  inconsistency between what counted as a real connection and what merely
  unlocked messaging.
- `hello_is_capped()` (from `20260828040000_hello_retry_and_split_cap.sql`)
  already excludes same-Tribe pairs from the monthly cap - "free" was
  already true and needed no DB change. Only the auto-grant branch needed
  removing.
- `supabase/migrations/20260829030000_same_tribe_requires_hello.sql`:
  redefines `can_direct_message` with the `tribe_ids && tribe_ids` branch
  deleted; accepted-Hello, shared-active-Venture, and existing-message-
  history (grandfather clause, so no live conversation gets retroactively
  locked) branches are untouched. Red under `CHANGE_PROTOCOL.md` -
  redefines the SECURITY DEFINER function backing the `messages` insert
  RLS policy.
- Rehearsed on a throwaway Postgres 16 container: stubbed `profiles`,
  `hellos`, `ventures`, `venture_applications`, `messages`, `blocks`, and
  simplified (no-RLS, since nothing in the rehearsal enables RLS)
  stand-ins for `has_blocked`/`is_venture_member`. Six scenarios checked:
  same-Tribe-no-Hello now blocked (the actual change), cross-Tribe
  accepted-Hello still allowed, shared-Venture still allowed, blocked pair
  still blocked, pre-existing message history still grandfathered in, and
  messaging yourself is never allowed. All six passed. Container removed
  after.
- Found and fixed a real dead-end while auditing every place that opens a
  DM: `TribeMembersSheet`'s message-icon button jumped straight to a raw
  thread (`onMessage` -> `onOpenMemberThread` -> push `{kind: "messages",
  userId}`), bypassing the Hello check entirely - for anyone not yet
  Moots, that would now open an empty thread with a composer that fails
  silently on send. Repointed it to `onOpenProfile` instead, reusing
  `u.$handle.tsx`'s already-correct Message/Say-hello branching rather
  than duplicating the check in a list of many rows. Removed the
  now-fully-unused `onMessage`/`onOpenMemberThread` prop chain through
  `TribeMembersSheet` -> `TribeScreen` -> `routes/index.tsx` rather than
  leave it as dead code. `ExploreDeck.tsx`'s own Message button was
  already correctly gated on `canMessage` from `useContactStatus` and
  needed no change.
- `HelloModal.tsx` assumed cross-Tribe was the only reason to see it
  ("You're not in the same Tribe, so this needs their okay first") - now
  wrong, since Tribemates now go through it too. Added a `sameTribe` prop
  (falls back to `signals?.same_tribe` when not passed explicitly, so
  `ExploreDeck`/`DiscoverScreen` - which already pass `signals` - get this
  for free) that swaps the copy, marks the Hello as free in the counter
  line, and stops the monthly-cap `disabled`/"used this month's Hellos"
  states from blocking a same-Tribe send even if the cross-Tribe cap is
  already exhausted. `u.$handle.tsx` computes `sameTribe` itself by
  overlapping the viewer's own `tribeIds` (via `useMyProfile()`) against
  the visited profile's `tribe_ids`, since it has no `signals` object.
  Known minor gap: a Saved-profile row reached via text search (no
  `signals`) will show the cross-Tribe copy/cap behavior even if the
  person happens to share a Tribe - cosmetic only, since the actual
  enforcement is server-side and unaffected either way.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full
  Node test suite 73/73, full Cloudflare production build passes. Not yet
  applied to production or deployed - migration SQL below.

### 2026-08-29 — Claude — Fixed the iOS input-zoom fix (it never actually applied)

- User reported the iOS keyboard-zoom issue still happened after deploy.
  Root cause: the earlier fix put `input, textarea, select { font-size:
  16px }` inside `@layer base` in `styles.css`. Nearly every affected
  input carries an explicit Tailwind text-size utility (`text-sm`,
  `text-xs`, ...) directly on the element, and those classes live in
  Tailwind's `utilities` layer. Per the CSS cascade-layers spec, a rule in
  a *later* layer always wins over one in an earlier layer regardless of
  specificity - `utilities` comes after `base` in Tailwind's layer order,
  so every one of those utility classes silently out-prioritized the fix.
  It only ever took effect on `CommentsModal`'s input, which I'd also
  edited directly to `text-base sm:text-sm` (16px) - not because the CSS
  rule reached it, but because that one input's own class already matched
  the target size, no override needed to already be a no-op.
- Fixed by moving the exact same rule outside of any `@layer` entirely
  (still gated by the same `@supports (-webkit-touch-callout: none)` +
  `(hover: none) and (pointer: coarse)` combo, so Android/desktop stay
  unaffected). Unlayered CSS always wins over layered CSS regardless of
  source order or specificity, per spec - this is the standard technique
  for overriding a utility framework's own utility classes without
  `!important` or hunting down every call site.
- Verified in the actual compiled output this time, not just by reading
  the source: built the app, confirmed in the generated CSS that
  `.text-sm` sits inside `@layer utilities{...}` while the touch-callout
  rule appears as a bare `@supports` block with no enclosing `@layer` at
  all - the exact structural guarantee the fix depends on.
- Verification: `npx tsc --noEmit` clean, full Node test suite 73/73,
  full Cloudflare production build passes, compiled CSS inspected
  directly to confirm the layer structure. Not yet deployed - this is a
  fix to something already shipped, so worth pushing promptly once
  confirmed.

### 2026-08-29 — Claude — Non-binary default avatars complete the set

- User sent the 5 non-binary illustrations (one per Tribe, deliberately
  featureless silhouettes rather than a gendered face) - matched them to
  Codex's already-staged `src/assets/default-profile-avatars-nonbinary/`
  (byte-confirmed via `wolf-nonbinary.png`), same as the man/woman set
  turned out to be Codex's Indonesian folder.
- Same treatment as before: resized 1254x1254 source PNGs (~1.4-1.65MB
  each) down to 400x400 with `sharp`, landing at 22-39KB each - into
  `public/default-avatars/{tribe}-nonbinary.png`.
- Wiring was a one-line change exactly as planned when the man/woman set
  shipped: `GENDER_FILE_SUFFIX` in `default-avatar.ts` went from
  `Partial<Record<GenderId, ...>>` (man/woman only, non_binary missing on
  purpose) to a full `Record<GenderId, string>` with `non_binary:
  "nonbinary"` added - no changes to `Onboarding.tsx` or
  `EditProfileModal`, both already call `defaultAvatarUrl()`
  unconditionally for whatever gender was picked. Dropped the now-dead
  `if (!suffix) return null` check, since indexing a total `Record` can no
  longer produce undefined.
- All 15 illustrations (5 Tribes x 3 genders) are now wired end to end.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full
  Node test suite 73/73, full Cloudflare production build passes,
  confirmed all 15 files present in `.output/public/default-avatars/`.
  Not yet exercised live or deployed.

### 2026-08-29 — Codex — Non-binary Tribe default-profile avatar artwork

- Created `src/assets/default-profile-avatars-nonbinary/` with one true featureless silhouette avatar for each Tribe.
- Rebuilt the set from the approved Tribe default-avatar masks so the Wolf, Koi, Cat, Owl, and Bee mask designs remain consistent; no profile fallback behavior changed.

### 2026-08-29 — Claude — Tribe+gender default avatars (man/woman; non-binary pending)

- User sent the 10 illustrations from Codex's Indonesian avatar set
  (confirmed by byte-matching `wolf-male.png` against
  `src/assets/default-profile-avatars-indonesian/`, distinct from the
  earlier non-Indonesian set in `default-profile-avatars/`) and asked for
  it to replace the generic leaf-emoji default - shown when someone
  hasn't uploaded a real photo, matched to their actual Tribe and gender.
- Source files were 1254x1254 / ~1.6-2.3MB each - fine as source art, way
  too heavy to serve as an everyday avatar rendered at 40-96px across
  post cards, chat threads, and Discover cards app-wide. Resized to
  400x400 and PNG-compressed with `sharp` (already a project dependency)
  before touching any app code: ~48-79KB each now, a ~25-30x reduction
  with no visible quality loss at avatar scale. Output lives in
  `public/default-avatars/{tribe}-{male|female}.png` (10 files).
- Deliberately NOT imported through Vite's `src/assets` pipeline: that
  produces content-hashed URLs that may not be root-absolute or start
  with "http" depending on dev vs. build, and the image-vs-emoji check
  used everywhere in this codebase
  (`avatar.startsWith("data:") || avatar.startsWith("http")`) requires
  exactly that. Serving from `public/` (same convention already used for
  `favicon.png`, referenced root-relatively in `__root.tsx`) gives a
  stable path, and `defaultAvatarUrl()` (`src/lib/default-avatar.ts`)
  qualifies it with `window.location.origin` at the point of use so it
  always satisfies that check - zero changes needed to the many existing
  avatar-render call sites across the app.
- Wired at exactly two points, both "never overrides a real upload,
  only stands in for one that was never taken":
  - `Onboarding.tsx`'s `finish()` - if the person didn't set a custom
    avatar in step 2, swap the placeholder for
    `defaultAvatarUrl(tribeId, gender)` before submitting.
  - `ProfileScreen.tsx`'s `EditProfileModal` Save - same swap, but only
    fires the moment gender transitions from unset to set
    (`!profile.gender && gender`), so an existing account that completes
    the "Finish your profile" nudge (added earlier this session) gets
    upgraded from the emoji too, without ever re-triggering on some later
    unrelated edit and clobbering a real photo someone since uploaded.
- Non-binary has no art yet (next batch incoming per the user).
  `defaultAvatarUrl()` returns null for any gender without a mapped file,
  and both call sites already fall back to the plain avatar/emoji in that
  case - so this degrades safely today and the third set can drop in
  later as a pure addition to `GENDER_FILE_SUFFIX`, no logic changes.
- Scoped to Onboarding + the gender-set moment only - deliberately not
  wired into the Tribe-switch flow (an existing account changing Tribe
  keeps its current avatar rather than getting re-matched), matching how
  narrowly gender itself was scoped this session.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean (one
  pre-existing, unrelated fast-refresh warning in `Onboarding.tsx`), full
  Node test suite 73/73, full Cloudflare production build passes and
  confirmed `.output/public/default-avatars/` contains all 10 files. Not
  yet exercised live or deployed.

### 2026-08-29 — Claude — Gender-immutability trigger applied to production

- User ran `20260829020000_gender_immutable.sql` in the Supabase SQL
  editor: "Query succeeded. No rows returned." The
  `enforce_gender_immutable_before_update` trigger is now live - gender
  can be set once per account and never reassigned or cleared after that,
  matching what was rehearsed. Both gender migrations are now applied;
  the whole feature is code-complete and unblocked, still queued for
  deploy along with everything else built this session.

### 2026-08-29 — Claude — Gender is immutable once set

- User: make sure gender can't be changed after it's picked once.
  Client-side-only enforcement is trivially bypassable (direct API call),
  so this needed real, server-side enforcement - the DB is the source of
  truth, not the UI.
- `supabase/migrations/20260829020000_gender_immutable.sql`: a plain
  `BEFORE UPDATE` trigger (`enforce_gender_immutable_before_update`) that
  raises if `old.gender is not null and new.gender is distinct from
  old.gender` - blocks both reassigning to a different value and clearing
  back to NULL. First-time sets (`old.gender is null`) and no-op re-saves
  of the same value (e.g. clicking Save in Edit profile without touching
  gender) both pass through untouched. Mirrors the existing
  `date_of_birth` immutability trigger
  (`20260820000900_enforce_adult_verification.sql`) - same shape, without
  the age-computation logic that field also needs.
- This is a **trigger**, i.e. Red per `CHANGE_PROTOCOL.md` (unlike the
  additive column migration before it, which was Green) - needs manual
  application via the Supabase SQL editor, same as before.
- Rehearsed on a throwaway Postgres 16 container replaying both gender
  migrations in sequence (had to add stub `anon`/`authenticated`/
  `service_role` roles this time, since the trigger function's `revoke
  execute from anon, authenticated` line needs them to exist - a vanilla
  Postgres image doesn't have them, Supabase's does). Confirmed: first-
  time set succeeds, an unrelated field update with gender left untouched
  succeeds, changing an already-set gender to a different value is
  rejected, clearing an already-set gender to NULL is also rejected, and
  the value never actually moved after either rejected attempt. Container
  removed after.
- Client UX: `GenderSelect.tsx` gained a `locked` prop - once locked, the
  three pills go `disabled`, dim to `opacity-60`, and a small `Lock`-icon
  caption explains why ("Can't be changed once set"). Wired to
  `locked={Boolean(profile.gender)}` in `EditProfileModal`
  (`ProfileScreen.tsx`) only - Onboarding never passes it, since gender is
  always unset there (first-time setup, free to change your mind before
  submitting). The lock is UX only, explicitly commented as such in the
  component - the trigger above is what actually enforces it.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean (one
  formatting issue in the new `GenderSelect.tsx` code I wrote this session,
  fixed via `--fix`), full Node test suite 73/73, full Cloudflare
  production build passes. Migration not yet applied to production - see
  chat for the SQL to run by hand.

### 2026-08-29 — Codex — Indonesian Tribe default-profile avatar artwork

- Created `src/assets/default-profile-avatars-indonesian/` as a second complete avatar set: Indonesian male and female illustrations for each of the five Tribes.
- Preserved the MEUTUALS editorial screen-print language and face-worn Tribe masks. Kept it separate from the original set; no fallback behavior changed.

### 2026-08-29 — Claude — Gender picker: dedicated single-select, not the shared checkbox grid

- User's screenshot showed all three gender pills rendering with a
  checkmark at once - reusing the multi-select `ChoiceGroup` pill grid
  (built for interests/social intents/availability) for a single-choice
  field surfaced a real bug: that component always renders an icon per
  option regardless of selection (`OPTION_ICONS[id] ?? Check`), and
  gender's ids have no custom icon mapped, so every option fell back to
  the same checkmark - looking checked whether it was selected or not.
  A checkbox grid is also the wrong shape for an exactly-one choice
  question in the first place, independent of that bug.
- New `GenderSelect.tsx`: a plain three-way segmented row, `role="radio"`/
  `aria-checked`, no icon at all - just the label, active state carried
  entirely by border/background color. Replaces the `ChoiceGroup`/
  `ProfileChoiceGroup` usage for gender in both `Onboarding.tsx` (step 2)
  and `ProfileScreen.tsx`'s `EditProfileModal`, single source of truth for
  the control so the two don't drift.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean (one
  pre-existing, unrelated fast-refresh warning in `Onboarding.tsx`), full
  Node test suite 73/73, full Cloudflare production build passes. Not yet
  exercised live or deployed.

### 2026-08-29 — Claude — Existing accounts get a nudge to set gender

- User's question after the migration landed: how do people who
  onboarded before this feature existed actually find out they can set
  it? They could already reach it via Edit profile - that part shipped
  with the field itself - but it was never wired into the "Finish your
  profile" completion banner (`ProfileScreen.tsx`), so anyone who'd
  already completed the old 6-field checklist (handle/city/bio/interests/
  social intents/availability) would see `profileCompletion === max` and
  never see the banner again, even with gender unset. Passive
  availability isn't the same as being told about it.
- Added `Boolean(profile.gender)` as a 7th criterion and introduced
  `PROFILE_FIELD_COUNT` (was a hardcoded `6` in three places: the
  threshold, the "N left" count, and the progress-bar percentage) so the
  banner reappears with "1 left" for every already-onboarded account
  until they set a gender, same mechanism that already nudges people to
  fill in missing interests/bio/etc.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full
  Node test suite 73/73, full Cloudflare production build passes. Not yet
  deployed.

### 2026-08-29 — Claude — Gender migration applied to production

- User ran `20260829010000_profile_gender.sql` in the Supabase SQL editor.
  First attempt showed "Query failed - Request was cancelled" (a client-
  side interrupt, not a Postgres error - no error detail was returned).
  Second attempt: "Query succeeded. No rows returned." - the `gender`
  column and its allow-list CHECK are now live in production, matching
  what was rehearsed. Full feature (schema, Onboarding, Edit profile,
  public display) is code-complete and now unblocked; still queued for
  deploy along with everything else built this session.

### 2026-08-29 — Codex — Tribe default-profile avatar artwork

- Created ten square default-profile illustrations in
  `src/assets/default-profile-avatars/`: a male and female version for each
  Iron Wolf, Mindful Koi, Studio Cat, Night Owl, and Honeybee.
- The set follows the current MEUTUALS editorial screen-print language: black
  ground, warm-ivory portraiture, printed ink texture, Tribe color accents,
  and a Tribe half-mask worn across the eyes. The images are artwork-only;
  avatar fallback wiring remains a separate decision because the profile model
  also supports a non-binary gender value.

### 2026-08-29 — Claude — Added gender to profiles

- New optional-single-value profile attribute: Woman / Man / Non-binary
  (user's explicit choice - no "prefer not to say", a fixed 3-option list).
  Public on the profile (same treatment as interests/social intents, not
  the private treatment age/date_of_birth get), required going forward at
  signup, editable afterward like every other trait.
- No existing single-choice column pattern in `profiles` - every other
  fixed-option field (`interests`, `social_intents`, `availability`) is a
  `text[]` with a `cardinality <= N` + allow-list `CHECK`. Gender is
  inherently single-select, so it's a plain nullable `text` column with a
  simpler `gender is null or gender in (...)` CHECK instead - no array,
  no enum type (matches the CHECK-over-pg-enum convention already used
  everywhere else in this table). Migration:
  `supabase/migrations/20260829010000_profile_gender.sql`. Green per
  `CHANGE_PROTOCOL.md` (new column, no RLS/trigger/grant/row-rewrite) -
  rehearsed on a throwaway Postgres 16 container (stub `profiles` table
  matching the real column set, one pre-existing NULL-gender row to
  simulate a legacy account) confirming: legacy rows read back NULL
  cleanly, all three values insert, NULL still inserts (so editing other
  fields never forces a value onto an existing account), and an invalid
  value is rejected by the CHECK. Container removed after.
- Reused the existing `ChoiceGroup`/`ProfileChoiceGroup` pill-grid
  component for both the Onboarding step and Edit profile, passing
  `selected={gender ? [gender] : []}` and an `onToggle` that always
  replaces rather than toggling off - single-select via the existing
  multi-select component rather than introducing the unused shadcn
  `radio-group`/`select` primitives for a single field.
- Required only at onboarding (step 2, alongside name/handle - gated the
  same way `handleValid` already gates that step's Next button), not
  retroactively on existing accounts: `EditProfileModal`'s Save button is
  NOT gated on gender being set, so a pre-existing account can still save
  other edits without being forced to pick one immediately. Existing rows
  simply stay NULL (and therefore don't show the pill on their profile)
  until they set it themselves.
- Surfaced on both the owner's own profile (`ProfileScreen.tsx`) and the
  public profile page (`u.$handle.tsx`) in the existing mono meta line
  (city · gender · Tribe), only rendered when set.
- `src/integrations/supabase/types.ts` (the generated Supabase types file)
  had to be hand-edited to add `gender` to the `profiles` Row/Insert/
  Update shapes - this file isn't regenerated from the live DB in this
  environment, and prior migrations in this session (`suspended_at`,
  `tribe_changed_at`, etc.) already established hand-editing it as the
  way to keep `tsc` accurate until someone re-runs the Supabase codegen
  against production.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean on every
  substantively-touched file (pre-existing prettier drift in
  `profile-options.ts` and a pre-existing `any` cast in
  `profile.functions.ts` confirmed unchanged via `git stash` diff, left
  alone), full Node test suite 73/73, full Cloudflare production build
  passes. Not yet applied to production - migration SQL needs to be run
  by hand (see chat), and not yet exercised live in Onboarding/Edit
  profile in a browser.

### 2026-08-29 — Claude — Dropped the "Danger zone" label

- User's reaction to a screenshot ("really danger zone?") was right - that
  label is a GitHub-repo-settings cliché and clashes with every other
  section header in this screen (`You`, `Discovery`, `Sign-in` - plain
  nouns, no dramatics). Removed the label from the Delete-account block
  added in the entry below; the `mt-6` gap and the `border-destructive/30
  bg-destructive/5` tinted outline already do the job of separating it
  from Log out without needing a caption to announce it.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean.

### 2026-08-29 — Claude — Hellos slide animation, Settings back-button exit, iOS input-zoom fix

- Hellos sheet now slides in/out from the right, matching the treatment
  already on the Moots picker drawer and Settings' page entrance: added
  `data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right`
  to `HelloRequestsSheet`'s `contentClassName`. Didn't reach for
  `AnimatedModal`'s `side="right"` prop directly - that also pulls in
  `max-w-xs`/`h-full`/`border-l`, sized for a compact browsing drawer, and
  Hellos is deliberately a full-screen takeover sheet. Radix already drives
  both directions via `data-state`, so the close (via the sheet's own
  ChevronLeft button) needed no extra wiring.
- Settings only had a slide-in on mount; its `goBack` called
  `window.history.back()` immediately, so leaving via the header's back
  arrow had no matching exit animation. Added a `closing` state: at
  `view === "main"` (actually leaving Settings, not just popping an
  internal account/notifications/etc panel - those stay on the same
  mounted route via a search param and were already excluded from the
  entrance animation for the same reason) it now flips the root div to
  `slide-out-to-right`, waits 200ms to match the animation's own duration,
  then calls `history.back()`.
- iOS input-focus zoom: Mobile Safari zooms the page when a focused
  input/textarea's computed font-size is under 16px. `CommentsModal`'s
  comment box was a bare `text-sm` (14px) with no responsive escape -
  unlike `ChatComposer`'s `text-base sm:text-sm`, which already avoided
  this. Fixed that one input directly, but the app has ~40 other text
  inputs across Ventures/Tribe/Profile/etc, so rather than hunt each one
  added a global safety net in `styles.css`: under
  `@supports (-webkit-touch-callout: none)` (WebKit-only, so this never
  fires in Chrome/Android) combined with `(hover: none) and
  (pointer: coarse)` (excludes desktop Safari), force
  `input, textarea, select { font-size: 16px; }`. Confirmed via user
  screenshot showing the zoomed/overlapping layout on an actual iPhone
  (Comments sheet, keyboard up).
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean on all
  substantively-touched files (pre-existing prettier drift in
  `CommentsModal.tsx` confirmed unchanged before/after via `git stash`
  diff, left alone per standing practice), full Node test suite 73/73,
  full Cloudflare production build passes. Could not verify the animation
  or the iOS fix live in this session - the Browser pane failed to
  composite frames (no display available) - so these are unverified in an
  actual iOS Safari session; worth a real-device check before/after
  deploy.

### 2026-08-29 — Claude — Log out / Delete account no longer sit flush together

- User's screenshot showed both buttons directly adjacent inside one
  container, same `min-h-12` full-width sizing, zero gap between them -
  "too blunt, user can accidentally click it." The concern is real: Delete
  account is the single irreversible action in Settings, sitting one tap
  away from the routine Log out with no visual or spatial signal that it's
  different in kind.
- `DeleteAccountModal.tsx` already gates actual deletion behind a two-step
  confirm (`confirming` state flips the button from "Delete my account" to
  a separate "Yes, permanently delete" press, plus a Cancel), so the fix
  here is purely about the entry point, not adding a redundant confirm.
- Split the single container into two: Log out keeps its existing plain
  row treatment; Delete account moved into its own block below with a
  `mt-6` gap, a small "Danger zone" label (`text-destructive/70`, same
  `label-mono` treatment as other `SettingsGroup` headers) and a
  `border-destructive/30 bg-destructive/5` tinted outline so it visually
  reads as a distinct, more deliberate action rather than a same-weight
  sibling of Log out.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full Node
  test suite 73/73, full Cloudflare production build passes. Not yet
  exercised live or deployed.

### 2026-08-28 — Claude — Settings slides in from the right on open

- User: opening Settings should feel like a push, not an instant cut.
  Settings is a real route (`/settings`), not a modal, so this doesn't go
  through `AnimatedModal` - added `motion-safe:animate-in
  motion-safe:slide-in-from-right` directly to `SettingsScreen`'s root
  element (same tw-animate-css utility class already used for the Moots
  picker drawer, just triggered by mount instead of a Radix `data-state`).
  Scoped intentionally to the initial Profile → Settings entrance only:
  the root element mounts once for that navigation and stays mounted while
  switching between internal panels (account/notifications/nearby/etc, all
  driven by a `view` search param on the same route), so this doesn't
  replay on every internal panel switch - respects `prefers-reduced-motion`
  via `motion-reduce:animate-none`.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full Node
  test suite 73/73, full Cloudflare production build passes. Not yet
  exercised live.

### 2026-08-28 — Claude — Own-profile post history now renders full PostCards

- User's screenshot comparison made the real problem obvious: someone
  else's public profile already shows full `PostCard`s (proper avatar,
  icons, full-width image) - your own profile's Posts tab showed a
  compact row (emoji glyphs, a 48px thumbnail) that opened a modal with the
  real card on tap. Two different visual languages for the same content.
- Fixed by rendering `PostCard` directly in `ProfilePostHistory.tsx`'s
  grouped list, same as the public profile already does - not by patching
  the compact row's icons/thumbnail size. Kept the search bar, sort cycle,
  and Tribe-filter chips exactly as they were (genuinely useful for
  browsing a large personal history, doesn't belong on someone else's
  profile) and removed the now-redundant tap-to-open-modal machinery
  (`openPostId` state, the portal-rendered detail sheet) since every post
  is already fully rendered and interactive in place.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean (`--fix`
  cleared pre-existing formatting drift elsewhere in the file, confirmed
  via a second `tsc` pass that nothing broke), full Node test suite 73/73,
  full Cloudflare production build passes. Not yet exercised live.

### 2026-08-28 — Claude — Public profile avatar made circular too

- User caught the miss: the earlier "make the Profile avatar circular" fix
  only touched `ProfileScreen.tsx` (your own profile) - `u.$handle.tsx`
  (someone else's public profile) still had the old `rounded-md` on the
  same-sized header avatar, so your own vs. everyone else's looked
  inconsistent. Fixed there too; grepped for every large profile-header
  avatar sharing this exact styling to confirm no third instance was
  missed (the Edit Profile picker preview was already circular).
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full Node
  test suite 73/73, full Cloudflare production build passes. Not yet
  exercised live.

### 2026-08-28 — Claude — DM thread header now opens the other person's profile

- User: tapping the header of a 1:1 DM (avatar/name/city) did nothing -
  wanted it to open that person's profile, same as everywhere else in the
  app. Traced it: `MessagesPanel`'s own top-level `onOpenProfile` prop
  already existed and was already wired through to `VenturePartyThread`,
  but the plain 1:1 `Thread` component neither accepted nor received it -
  the header was static text with no affordance at all.
- Added `onOpenProfile` to `Thread`'s props, wrapped the avatar/name/city
  block in a button that calls it with `other?.handle || otherId` (handle
  when set, falls back to the raw id - `getProfileByHandle` already accepts
  either, same fallback pattern used elsewhere in the app), and passed the
  prop through at the `<Thread>` call site. The existing `SafetyMenu`
  button stays a separate, unaffected sibling.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full Node
  test suite 73/73, full Cloudflare production build passes. Not yet
  exercised live.

### 2026-08-28 — Claude — New message FAB visible on every filter, not just Direct

- User: fine for it to show regardless of which filter is active. Dropped
  the `filter === "direct"` guard - starting a new DM isn't really specific
  to already being on the Direct tab. No other changes.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full Node
  test suite 73/73, full Cloudflare production build passes. Not yet
  exercised live.

### 2026-08-28 — Claude — New message became a FAB, matching Ventures' Host button

- User: use a FAB instead of the inline full-width button. Reused Ventures'
  existing Host FAB exactly (`VenturesScreen.tsx:396`) rather than
  reinventing one - same `fixed inset-x-0 bottom-24 z-30 mx-auto max-w-md
  justify-end` wrapper (width-matched and right-aligned within the centered
  content column, not the raw viewport edge - the documented fix from the
  2026-08-21 "Host became a FAB" entry, since a viewport-edge FAB drifts
  away from the content on anything wider than a phone) and the same
  `pointer-events-none` wrapper / `pointer-events-auto` button split so the
  invisible full-width strip doesn't eat taps meant for the list underneath.
  Still only shown when the Direct filter is active - same scope as before,
  just a different visual treatment.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full Node
  test suite 73/73, full Cloudflare production build passes. Not yet
  exercised live.

### 2026-08-28 — Claude — Moots picker: a side drawer for starting new DMs

- User asked to move Direct chats off the unified Chats list onto their own
  screen, and separately wanted a Moots list. First proposal (a fully
  separate "Direct" screen) was rightly rejected - it would have added a
  navigation hop to the single most frequent action (checking existing
  DMs). Landed on the narrower version instead: leave the existing filter
  pills (All/Tribe/Ventures/Direct) exactly as they are - zero added
  friction to reach a thread you already have - and add a **"New message"**
  button, visible only when the Direct filter is active, that opens a
  picker over everyone the user is Moots with (not just people they've
  already messaged).
- User then asked for that picker to be a side drawer, not the app's usual
  floating/bottom-sheet modal. `AnimatedModal` (`animated-modal.tsx`) is the
  one primitive every modal in this app goes through per AGENTS.md, so
  extended it with a `side="right"` mode rather than reaching for the
  shadcn `sheet.tsx` scaffold already sitting unused in the repo (confirmed
  unused - its only importer, `sidebar.tsx`, is also never wired into the
  real app). Borrowed the exact positioning/slide classes from that unused
  scaffold as a reference (`inset-y-0 right-0 h-full ... slide-in-from-right`)
  since they're the correct, already-available tw-animate-css utilities,
  without touching the scaffold file itself.
- One real bug caught before it shipped: the base rounding ternary emitted
  `sm:rounded-3xl` unconditionally, and a plain `rounded-none` override
  doesn't cancel a responsive-variant class in Tailwind's conflict
  resolution - the drawer would have kept rounded corners at ≥640px width.
  Fixed by making the ternary itself side-aware, so no conflicting class is
  emitted in the first place.
- New `MootsPickerSheet` in `ChatsScreen.tsx`, listing `useMyMoots()`
  (reused as-is from the Tribe-preview work), tapping someone closes the
  drawer and opens a thread with them via the existing `onOpenThread`.
  Also added an explicit empty state for the Direct filter with zero
  threads, since the generic "No conversations yet" state only fires when
  every section is empty.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean (`--fix`
  cleared pre-existing formatting drift in `animated-modal.tsx`, confirmed
  via a second `tsc` pass), full Node test suite 73/73, full Cloudflare
  production build passes. Not yet exercised live.

### 2026-08-28 — Claude — Hellos moved to their own reachable sheet, split into two tabs

- User asked where the Sent list actually lived, which surfaced a real gap:
  the only way to reach `IncomingHellos`/`SentHellos` at all was tapping a
  Hello notification. `ChatsScreen.tsx` renders its own thread list and
  always jumps straight into a specific conversation - there was no button
  anywhere that opened `MessagesPanel`'s list view on its own. Confirmed by
  request, then asked for a persistent entry point with the two lists as
  proper tabs instead of stacked sections.
- New `HelloRequestsSheet.tsx` - a dedicated full-height sheet (same
  definite-height `contentClassName` pattern fixed earlier for the Saved
  sheet, not the older percentage-height one) with **Requests** and **Sent**
  tabs, each carrying a count badge. Moved `IncomingHellos`/`SentHellos`'s
  row-rendering here wholesale rather than duplicating it, and deleted the
  originals (plus their now-unused imports) from `MessagesPanel.tsx`, which
  no longer renders any Hello content in its own list view.
- New entry point: a Hand-icon button in `ChatsScreen`'s own header
  (`AppHeader`'s `action` slot, the same pattern Discover's Search and
  Profile's Settings already use), badged with the incoming-request count -
  reachable anytime, not just right after a notification.
- Wired through the root navigation system rather than local state, since
  the notification routing from two entries ago also needs to open this
  same sheet: added `{ kind: "helloRequests" }` to `AppLayer`
  (`app-navigation.ts`), `helloRequestsOpen` state derived in
  `restoreNavigation` exactly like `messagesOpen`, and the `chats-inbox`
  notification case now points at this layer instead of `messages`.
- No migration - pure application restructuring on top of last entry's
  schema work.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean across all
  five touched/new files (`--fix` cleared formatting-only findings in the
  new code, confirmed via a second `tsc` pass that nothing broke), full
  Node test suite 73/73, full Cloudflare production build passes. Not yet
  exercised live.

### 2026-08-28 — Claude — Cancel a Hello, with a real cap refund; Sent list added

- User: add a way to cancel a sent Hello, refund it from the monthly cap
  when cancelled, and fix the stale "They can't send another" decline copy
  (wrong since this session's retry-window work - it's 30 days, not
  forever).
- The sender previously had **zero** update rights on a `hellos` row - only
  `"Recipients answer their hellos"` existed. Adding sender-cancel needed
  real schema work, not just UI:
  - `20260828070000_hello_cancel_and_refund.sql` (Red - replaces the RLS
    update policy and a trigger on a table with real rows). New `cancelled`
    status. Per AGENTS.md landmine 2.1, this deliberately stays **one**
    UPDATE policy (`sender_id = auth.uid() or recipient_id = auth.uid()`)
    rather than adding a second permissive one - two policies would let
    Postgres OR-combine USING/WITH CHECK across both, the exact shape of
    the Venture self-accept bug. `hellos_guard` now does the real
    enforcement: only the recipient may set accepted/declined, only the
    sender may set cancelled, everything else still immutable/one-shot.
  - `hellos_capped_sent_this_month` now excludes `status <> 'cancelled'` -
    the refund is just that exclusion, no separate bookkeeping.
    `hellos_enforce_retry_window` needed **no change**: neither its
    accepted/pending/declined branches match 'cancelled', so a retry after
    cancelling already fell through to "allowed" for free - cancelling
    carries no 30-day cooldown, matching that it's the sender's own choice
    rather than someone else's "no."
  - Rehearsed on a throwaway Postgres 16 container seeded with the real
    pre-migration schema plus a `request.uid`-backed `auth.uid()` stub so
    the actor-aware trigger logic could actually be exercised as different
    callers. 7 scenarios: recipient blocked from cancelling, sender
    cancels successfully, immediate retry allowed after cancel, cancelled
    hello excluded from the capped count (1, not 2), sender blocked from
    accepting their own hello, recipient-accepts still works, cancelling an
    already-decided hello rejected. All 7 passed. 6/6 verify checks
    (`LOVABLE_HELLO_CANCEL_VERIFY.sql`) pass on a second fresh container.
- App side: new `cancelHello` and `listOutgoingHellos` in
  `social.functions.ts` (+ `HelloStatus` gains `cancelled`);
  `getContactStatus` treats a cancelled row the same as expired - filtered
  out of ranking, so the profile immediately offers Say hello again rather
  than showing a stuck state. New `SentHellos` component in
  `MessagesPanel.tsx`, mirroring `IncomingHellos`'s placement and pattern
  but read-mostly (no accept/decline, just a Cancel button and "waiting on
  a reply" framing) - rendered directly below `IncomingHellos` in the same
  Inbox list view this session's earlier notification-routing fix now
  correctly reaches. Also fixed the stale decline-toast copy.
- **Not yet applied to production** - the RLS/trigger migration needs the
  usual manual SQL-editor step before this app code does anything but 404
  on `cancelHello`.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean (two
  pre-existing, unrelated findings in `social-store.ts` confirmed again),
  full Node test suite 73/73, full Cloudflare production build passes.

### 2026-08-28 — Claude — Fixed: "Review" on a Hello notification led nowhere useful

- User hit a real, live case: received a Hello, tapped "Review" on the
  notification, and had no way to actually accept or decline it.
- Traced the full pipeline (`notification-presenter.ts` →
  `notification-navigation.ts` → `routes/index.tsx`): a `hello` notification
  resolved to `{ kind: "tab", tab: "chats" }`, which only switches the
  bottom tab. `ChatsScreen.tsx` has no awareness of pending Hellos at all -
  the actual accept/decline UI (`IncomingHellos`) only renders inside
  `MessagesPanel`'s list view, which needs its own `messages` layer opened
  and never was. Reusing the `dm` destination instead (like
  `hello_accepted` does) would have been worse: `Thread` has no
  contact-status awareness either, so it would render an empty thread with
  a composer that fails on send, since `can_direct_message` is still false
  for an unanswered Hello.
- Added a new `chatsInbox` destination end to end: `NotificationDestination`
  union, `notificationHomeSearch`/`parseNotificationHomeSearch` (new
  `chats-inbox` URL target, no `target` param needed), and the route
  effect now opens `{ tab: "chats", layer: { kind: "messages" } }` - no
  userId, so `MessagesPanel` opens in list mode where `IncomingHellos`
  lives, instead of trying to open a specific thread.
- No server-side push changes needed - push taps already funnel through
  this same client-side pipeline via `/notifications?open=<id>`
  (`openedFromPush` in `notifications.tsx`), so this fixes both in-app taps
  and push taps at once.
- Found via this: `tests/notification-presenter.test.ts` had a test
  asserting the old, broken destination as correct. Updated it to expect
  `chatsInbox`, and added roundtrip coverage for the new `chats-inbox`
  search target.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full Node
  test suite 73/73 (was 72/73 before the test update - one true regression
  test, not a flake), full Cloudflare production build passes. **Not yet
  pushed** - separate from the session release in the entry below.

### 2026-08-28 — Claude — Moots/Explore/header session pushed to production (`fc50643`)

- Circular Profile avatar (`rounded-md` → `rounded-full`), then released the
  whole session's work at the user's direction.
- Confirmed all four migrations from this session were already applied and
  verified true by the user before pushing (`20260828030000`, `040000`,
  `050000`, `060000`) - no app code shipping ahead of schema it depends on.
- Fetched `origin/main` immediately before release and confirmed a clean
  fast-forward with no remote commits to reconcile (both at `756e599`).
- Ran the full Node test suite (`node --test tests/*.test.ts`): 73/73 pass,
  including the existing Explore rotation tests against the untouched
  client-side `curateForMood`. Plus `npx tsc --noEmit`, targeted ESLint, and
  the full Cloudflare production build - all clean.
- Staged only this session's actual work; kept unrelated local `.env`
  (two Google Maps keys - `GOOGLE_MAPS_SERVER_KEY` must never enter the
  tracked file per this repo's own rule), `package-lock.json`, `styles.css`,
  and `tests/push-notifications.test.ts` out of the commit, matching the
  release discipline already established in this file's earlier entries.
- Pushed `fc50643` to `main` (24 files, +1918/-243). GitHub's push output
  surfaced a pre-existing Dependabot warning (28 vulnerabilities across the
  dependency tree) - not introduced by this session, `package-lock.json`
  was never touched; worth a look separately, not a release blocker.
- Lovable should auto-rebuild and publish from this push; the usual
  post-Lovable-session drift check (`LOVABLE_SQL_EDITOR_PASTE.sql` step 4)
  is still worth running before the next database change.

### 2026-08-28 — Claude — Header settled: Profile drops the bell, everyone else keeps it

- Asked to research how Instagram/Bumble/Pure handle this. The web search
  itself came back weak (SEO blog content, no real teardowns), but what's
  reliably known about Instagram specifically contradicted the "bell on
  every screen" position taken two entries ago: Instagram's activity icon
  only lives on the Home feed's header, not on Profile/Explore/Reels.
  Header content changing per-tab is itself an established pattern, not a
  consistency violation.
- Final call: **Profile drops Notifications entirely** and its hamburger
  takes the edge slot instead; **every other screen keeps the bell** at the
  edge, since none of them have a competing icon wanting that same spot.
  This retires the two-slot `leftAction`/`rightAction` design from the
  previous entry - with Profile no longer showing both icons at once, one
  slot handles every case again.
- `AppHeader` (`Shared.tsx`) is back to a single `action` prop plus a new
  `showNotifications` boolean (default `true`, only `false` on Profile).
  `ProfileScreen.tsx`'s hamburger now passes through `action` directly
  (rendering at the edge, since nothing else occupies it there anymore).
  `DiscoverScreen.tsx`'s Search is unchanged - still `action`, still beside
  a bell that's still shown.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean on all
  three touched files, full Cloudflare production build passes. Not yet
  exercised live.

### 2026-08-28 — Claude — AppHeader split into left/right action slots

- User pushed back on Notifications anchoring the (only) action edge, citing
  the common pattern of a hamburger/menu icon living at the edge in other
  apps. Both things are true at once because they're about different icons:
  in the apps that pattern comes from, the hamburger *is* the omnipresent
  global icon, which is why it anchors there. In Meutuals, Notifications is
  the omnipresent one (every screen); the hamburger only exists on Profile.
  Same underlying rule, correctly pointed at whichever icon is actually
  persistent in this app - they're just different icons in different apps.
- Resolved by giving both a home instead of picking one: `AppHeader`
  (`Shared.tsx`) now takes `leftAction` and `rightAction` instead of one
  `action`. `leftAction` is the classic navigation-flavoured edge slot -
  Profile's hamburger moved there. `rightAction` sits beside Notifications
  for utility-flavoured icons - Discover's Search stays there, since a
  search icon conventionally lives near other top-right utility icons, not
  at a hamburger's edge. Notifications keeps its fixed position on every
  screen either way; nothing this session's earlier fix already guaranteed
  is lost.
- `VenturesScreen.tsx`/`ChatsScreen.tsx`/`TimelineScreen.tsx`/`TribeScreen.tsx`
  don't pass either slot and needed no changes.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean on all three
  touched files, full Cloudflare production build passes. Not yet exercised
  live.

### 2026-08-28 — Claude — Notifications anchored at the header's true edge

- User asked which order reads better, Search or Notifications. The real
  answer wasn't preference: `AppHeader` rendered `<NotificationBell />`
  before `{action}`, so on any screen carrying a per-screen action (Discover's
  Search, Profile's Settings shortcut) the bell shifted one slot left of the
  true edge, while screens without an action left it at the edge - its
  absolute position moved depending on which screen you were on. Swapped the
  order in `Shared.tsx` so `{action}` renders first and `NotificationBell`
  last: the one icon present on every screen now anchors at a fixed
  position everywhere, and per-screen actions sit before it instead of
  pushing it around. Fixes Profile's header too, not just Discover's.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full
  Cloudflare production build passes. Not yet exercised live.

### 2026-08-28 — Claude — Search moved into Discover's own header slot

- User's counter-proposal to putting Browse in the global header: use the
  *existing* per-screen `action` slot on `AppHeader` instead - the same
  slot Profile already uses for its Settings shortcut ("hamburger"). That
  slot only renders whatever the calling screen passes, so unlike a
  hardcoded global icon it only ever appears on Discover; it doesn't
  reappear as a non-sequitur on Timeline/Chats/etc. Agreed, this sidesteps
  the objection raised for Browse entirely.
- Moved Discover's Search trigger into `AppHeader`'s `action` prop, styled
  identically to Profile's existing header action (44px circular target,
  same hover/focus treatment). Removed the now-duplicate Search button from
  Discover's own control row, which drops from 4 icons to 3 (Mood, Area,
  Browse). `focusSearch()` and the inline search-mode row it triggers are
  unchanged - only the trigger's location moved.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full
  Cloudflare production build passes. Not yet exercised live.

### 2026-08-28 — Claude — Reverted the doors-screen illustration

- User's live screenshot showed it cramped against the "Back to today's
  five" footer, not sitting comfortably. Root cause: `FeatureIllustration`'s
  box is `aspect-[3/4]` regardless of the width override, so even at 150px
  wide it forces a ~200px-tall box - fine in the "done" phase's mostly-empty
  layout, not fine here where two cards (mood chips, Find a Venture) already
  eat most of the vertical space. Reverted; the "humanize" fix needs a
  different approach for this specific, denser screen rather than copying
  the done-phase treatment as-is.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full
  Cloudflare production build passes.

### 2026-08-28 — Claude — Doors screen gets the completion illustration; Browse stays out of the global header

- User asked whether Discover's Browse trigger (Tribes + Saved, added this
  session) should move into the global `AppHeader` beside Notifications.
  Declined, with reasoning: `AppHeader` renders on every screen (Timeline,
  Ventures, Chats, Profile, Tribe), so it's reserved for genuinely
  cross-screen concerns; Browse only means something inside Discover.
  Moving it would make it a non-sequitur everywhere else. Left as-is in
  Discover's own control row.
- User also flagged the "doors" screen (shown after Today's Five completes)
  as feeling cold - there's a real empty gap between the "Find a Venture"
  card and the "Back to today's five" footer now that "Enter a Tribe" is
  gone. Filled it the same way the 2026-08-26 completion-card fix did: the
  existing transparent Discover illustration, centered in the flexible
  space, rather than leaving a void. Same `FeatureIllustration`/`discoverArt`
  already imported in this file for the "done" phase, just reused at a
  slightly smaller size (150px vs 190px) to fit the doors screen's tighter
  vertical room.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full
  Cloudflare production build passes.

### 2026-08-28 — Claude — Removed the "Enter a Tribe" door card

- User pushback, correctly: the "doors" screen shown after every completed
  Today's Five ([ExploreDeck.tsx](src/components/mutuals/ExploreDeck.tsx))
  had an "Enter a Tribe" card sitting as a peer option next to "Find a
  Venture" - repeated every single time, framed as an inviting, low-cost
  action. That's the wrong weight for a decision gated by a 21-day cooldown
  and deliberately exclusive membership; tapping it never actually switched
  anyone (it only opened the same preview grid, with the real "Move here"
  confirm step still a layer deeper), but showing it that often, that
  casually, nudges toward tribe-switching being a repeatable browsing
  choice rather than the rare, considered one it's designed to be.
- It was also newly redundant: Discover's Browse menu (this session, same
  day) already gives Explore Tribes a permanent, always-reachable home, so
  this card wasn't adding reach, only repetition.
- Removed the card; "Find a Venture" is now the sole full-width action in
  that section instead of half of a two-column grid. Left the *other*
  `onExploreTribes` call site alone - the final "done" screen (reached once
  per session, at most, after finishing both the primary five and a
  continuation set) already uses neutral "Explore Tribes" copy and isn't
  the repeated-nudge pattern being objected to.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean (also
  dropped the now-unused `UsersRound` import), full Cloudflare production
  build passes.

### 2026-08-28 — Claude — Explore freshness live; Discover control row decluttered

- User confirmed `LOVABLE_EXPLORE_FRESHNESS_VERIFY.sql` returned all `true`
  in production - the recency-penalized `list_explore_matches` and
  `explore_impressions` from the previous entry are live.
- Built the control-row consolidation discussed in chat: Explore Tribes and
  Saved (both occasional-browse utilities, not part of the daily Mood/Search
  loop) now share one `BrowseMenuSheet` behind a single icon, instead of
  each holding a permanent slot. Row goes from 5 icons (Mood, Area, Tribes,
  Saved, Search) to 4 (Mood, Area, Search, Browse). Mood and Area stay
  separate and visible on purpose - they're state indicators (active lens,
  current radius), not just navigation, so folding them away would hide
  state rather than just declutter. Pure UI, no data/query changes -
  `BrowseMenuSheet` just opens the same existing `TribeBrowserSheet` /
  `SavedProfilesSheet` instances.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean, full
  Cloudflare production build passes. Not yet exercised live.

### 2026-08-28 — Claude — Today's Five freshness: recency-penalized ranking

- Built the server-side option discussed for the "same top-8 forever"
  problem in `curateForMood` (see the previous entry). A soft penalty, not a
  hard exclusion: someone shown in the last 3 days loses 40 points, 4-13
  days ago loses 15, 14+ days or never shown loses nothing. A genuinely
  strong match can still surface even if shown yesterday; a small Tribe
  with few candidates never runs dry from over-aggressive filtering.
- `20260828060000_explore_impressions_freshness.sql` (Red - new RLS policy,
  even though the table itself is new):
  - New `explore_impressions(user_id, shown_id, shown_at)` table, owner-only
    RLS (`for all using/with check (user_id = auth.uid())`), recency index.
    Upsert semantics - "last shown," not an append-only log.
  - `list_explore_matches` gets one addition on top of the last known-good
    version (20260820190650): a left join to the caller's own impressions,
    and the tiered penalty subtracted from score before the existing
    `least(score, 100)` (now also floored at 0 with `greatest(...)`). The
    `me`/`candidates`/`measured`/`scored` shape, distance math, venture
    lateral join, and the ORDER BY/pagination contract are all unchanged -
    written as a diff against the deployed function, not a rewrite, so it's
    reviewable as one.
- New `recordExploreImpressions` server function (`explore.functions.ts`) -
  upserts the shown ids, fire-and-forget. `ExploreDeck.tsx` calls it once
  each time the resolved primary five or a continuation five actually
  changes (keyed on the joined id set, not `dayKey` alone, so it doesn't
  re-fire on every unrelated re-render).
- Rehearsed against a throwaway Postgres 16 container seeded with the exact
  pre-migration `list_explore_matches` body plus a `request.uid`-backed
  stub of `auth.uid()` so the SECURITY DEFINER function's caller-scoping
  could actually be exercised. Four profiles with identical underlying
  match strength, shown 1/10/20 days ago and never: got the exact expected
  scores (0/25/40/40), and confirmed the never-shown one outranks the
  shown-yesterday one in the function's own returned order. All 8 verify
  checks (`LOVABLE_EXPLORE_FRESHNESS_VERIFY.sql`) pass on a second fresh
  container.
- **Not yet applied to production.**
- Verification: `npx tsc --noEmit` clean (added the new table + confirmed
  `list_explore_matches`'s existing type entry needs no change, since its
  signature and return columns are untouched), targeted ESLint clean, full
  Cloudflare production build passes.

### 2026-08-28 — Claude — Tribe preview gains Moots signal and a Move CTA; Explore card photo enlarged

- **Tribe preview redesign.** `TribePreviewSheet` (Discover → Explore Tribes →
  tap a Tribe) previously just showed a member count, a few recent posts, and
  "Close preview" - no way to act on curiosity. Added:
  - **"N of your Moots are here"** - the strongest available discovery
    signal, reusing Moots rather than inventing a second social graph. New
    `listMyMootProfiles` in `social.functions.ts` (+ `useMyMoots` hook)
    resolves the current user's accepted Hellos to lightweight profiles
    (id/name/avatar/tribe_ids); the sheet filters to whoever's in the
    previewed Tribe. **No migration needed** - reads the caller's own
    `hellos` rows under existing RLS.
  - **A real "Move to [Tribe]" CTA**, or "This is your Tribe" when
    previewing your own. `AddTribeSheet` (previously Settings-only) gained
    an optional `initialTargetId` prop that jumps straight to its existing
    confirm step (cooldown display, consequences copy, mutation - all
    reused, not duplicated) instead of showing the full Tribe list. Discover
    now mounts its own `AddTribeSheet` instance, opened from the preview.
    Two entry points to switch Tribe now exist deliberately: Settings (full
    list) and Discover's preview (single-Tribe jump).
- **Explore card photo enlarged.** User flagged visible empty space below
  the "Why you might click" checklist and above the action buttons on the
  primary Today's Five card. The photo stage was a fixed 45% of card height
  regardless of how short the bio/reasons text was; bumped to 52%
  (`ExploreDeck.tsx`, one line) since the text region was already
  over-provisioned. Left the two chevron nav buttons in the same file alone
  - they have unrelated local uncommitted changes in flight.
- Discussed but not yet built (see chat): Today's Five freshness (current
  rotation is day-seeded but capped to a window of the top 8 ranked
  candidates - fine for a small pool, means most people never surface in a
  larger one; fix needs "already shown recently" tracking, client-only via
  localStorage or a proper server-side impressions table) and whether
  Discover's Search still earns its spot in an increasingly crowded control
  row (Mood/Area/Tribes/Saved/Search).
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean on every
  touched file (`AddTribeSheet.tsx` had pre-existing formatting drift
  cleared by `--fix` since the file was substantively edited; nothing
  touched in `ExploreDeck.tsx` beyond the one intended line). Full
  Cloudflare production build passes. Not yet exercised live.

### 2026-08-28 — Claude — Saved list gets a follow-up action and drops resolved entries

- User's question: what happens after someone saves a profile - what makes
  the list stay useful as it grows? Landed on two changes, deliberately
  excluding any reminder/nudge mechanic (that's the manufactured-urgency
  pattern this app has consistently avoided elsewhere).
- **Say hello, right in the row.** `PersonRow` gained an optional
  `onSayHello` prop - when passed, a full-width "Say hello" button renders
  below the existing content, opening the real `HelloModal`. Omitted
  everywhere else (search results), so this only appears in the Saved
  sheet; the row's existing layout is byte-identical when the prop isn't
  passed. `HelloModal` itself gained an optional `onSent` callback (fires
  after a successful send, before `onClose`) so callers can react to the
  send itself - the Saved sheet uses it to refetch.
- **Resolved entries drop out of the list automatically.** `listSavedProfiles`
  now excludes anyone the user already has *any* `hellos` row with
  (whatever its status - once you've acted, the "should I say hello"
  question is answered) and anyone who already shares a Tribe with the user
  (already reachable without a Hello at all). The underlying `follows` row
  is untouched - this is a display filter, not a delete, so re-saving or
  toggling elsewhere is unaffected. **No migration needed** - both new
  reads (`hellos` scoped to the caller, `profiles.tribe_ids` for the caller)
  already work under existing RLS.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean on all three
  touched files (`profile.functions.ts`'s one remaining finding is the
  pre-existing, unrelated `any`-cast at line 155), full Cloudflare
  production build passes. Not yet exercised live.

### 2026-08-28 — Claude — Saved sheet couldn't scroll to its last rows

- User reported (with a screenshot, `localhost:8082`, signed in) that the new
  Saved sheet's list could not be scrolled to the bottom.
- Could not reproduce directly - no signed-in session available here, and
  the browser tab reached is signed out. Diagnosed from the code instead.
- Likely cause: `SavedProfilesSheet`'s scroll region lived inside an inner
  `<div className="flex h-full min-h-0 flex-col">` wrapper - copied from
  `TribeBrowserSheet`, which never had enough content to expose this. A
  percentage height (`h-full`) only resolves against a parent with a
  *definite* height. The wrapper's parent (`AnimatedModal`'s `Content`) used
  `sm:h-auto` at wider viewports, and `auto` isn't definite - so `h-full`
  silently collapsed to the wrapper's own content size instead of Content's
  bounded box. `flex-1`/`overflow-y-auto` on the list then had no real
  height to scroll within, and Content's own `overflow-hidden` just clipped
  whatever didn't fit, with no way to reach it.
- Fix: moved `flex flex-col` onto `Content` itself via `contentClassName`
  (no more percentage-height wrapper), and replaced `sm:h-auto sm:max-h-[90dvh]`
  with a definite `sm:h-[85dvh] sm:max-h-[85dvh]` - so the flex column has a
  real bounded height at every breakpoint, not just on mobile. Scoped to
  this one sheet only; `TribeBrowserSheet`/`NearbyPreferencesSheet` use the
  same older pattern and weren't touched, since they aren't reported broken
  and changing shared-shaped code without a failing case to verify against
  is how regressions happen.
- **Not verified live** - this is a reasoned fix for the most likely cause,
  not a confirmed one. Needs a retest on a real signed-in session.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean (`--fix`
  only reformatted this sheet's own indentation after the restructure - no
  other file touched), full Cloudflare production build passes.

### 2026-08-28 — Claude — Saved-list screen in Discover

- Fourth and last slice of the Moots-replaces-Follow design: a way to
  actually browse who you've Saved, closing the gap left by keeping Save
  (backed by `follows`) deliberately separate from Moots. Before this there
  was a Save/Saved toggle on every Discover card but no list anywhere to see
  what you'd saved.
- New `listSavedProfiles` in `profile.functions.ts`: your `follows` rows,
  most-recently-saved first, resolved to full profile rows (same shape as
  `listDiscoverProfiles`), blocked accounts filtered the same way that
  function already does. **No migration needed** - `follows`/`blocks`/
  `profiles` reads all already work under existing RLS for this shape of
  query (same pattern `listDiscoverProfiles` already uses).
- Added a bookmark icon button to Discover's compact controls row (next to
  Mood / Area / Tribes / Search) opening a new `SavedProfilesSheet` - the
  same full-height sheet pattern as `TribeBrowserSheet`, reusing the
  existing `PersonRow` card and Save-toggle wiring rather than building a
  new list component. Did not touch `ExploreDeck.tsx` (it has unrelated
  local changes in flight) - this lives entirely in `DiscoverScreen.tsx`'s
  search-mode machinery instead.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean on both
  files (ran `eslint --fix` on `profile.functions.ts` for pre-existing
  formatting drift elsewhere in the file - `git diff -w` confirms nothing
  beyond whitespace changed outside the new function), full Cloudflare
  production build passes. Not yet exercised in a live browser session.

### 2026-08-28 — Claude — Venture invite eligibility moved off the follow graph

- Third slice of the Moots-replaces-Follow design. A host could previously
  only invite people they followed or were followed by
  (`ventures.functions.ts:860-863`, old). Confirmed replacement rule (user,
  2026-08-28): **same Tribe is always inviteable, or already Moots with the
  host in any Tribe** - no fresh Hello required either way.
- Replaced `fetchConnectionIds` (queried `follows`) with
  `fetchInviteEligibleIds`: host's own `tribe_ids` (via the existing
  `fetchProfiles` helper) drive a `profiles.tribe_ids` overlap query for
  same-Tribe candidates, unioned with the host's own accepted `hellos` rows
  (either direction) for Moots. Both queries run entirely inside existing
  RLS - `hellos` is scoped to rows the host is already a participant in, and
  `profiles` reads were already broadly open. **No migration needed for this
  one** - pure application-layer change.
- `VentureInviteRelationship` changed from `"following" | "follower" |
  "mutual"` to `"same_tribe" | "moot" | "same_tribe_moot"`; the invite
  eligibility check in `inviteUserToVenture` now reads
  `sameTribe.has(target) || moots.has(target)` instead of the follow-graph
  check, with matching copy ("You can only invite people in your Tribe, or
  people you're Moots with.").
- Updated the invite picker in `VenturesScreen.tsx`: panel copy, search
  placeholder, empty state, and `RelationshipPill` labels ("Tribe" / "Moot" /
  "Tribe · Moot") all moved off follow language.
- No existing test coverage of this eligibility logic before or after (the
  old follow-based version had none either) - the `createServerFn` handlers
  aren't structured for lightweight mocking the way `listVentureParticipants`
  is. Verified by tracing the RLS each new query runs under instead; real
  device/two-account acceptance of the actual invite flow remains open.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean (no findings
  on either touched file), full Cloudflare production build passes.

### 2026-08-28 — Claude — Hosted/Joined now only count completed Ventures

- User caught that `get_profile_stats` (from the profile-stats work earlier
  today, already live in production) counted **Hosted** the moment a Venture
  was created and **Joined** the moment an application was accepted -
  neither required the Venture to have actually happened. A cancelled or
  still-upcoming Venture already inflated both numbers.
- Decision: both now require `ventures.status = 'closed'`, matching how the
  rest of the app already treats a closed Venture as the real, done thing
  (Venture Memories, the Moot recap). Moots is untouched - an accepted Hello
  is already a deliberate two-way action with no earlier "not yet happened"
  phase.
- `20260828050000_profile_stats_completed_ventures_only.sql` replaces
  `get_profile_stats` in place (same signature, same grants) rather than
  editing the already-applied `20260828030000` file - that one's live in
  production and stays as history. Added
  `LOVABLE_PROFILE_STATS_COMPLETED_VERIFY.sql`.
- Rehearsed against a throwaway Postgres 16 container: applied the original
  function body first (as if `20260828030000` had already run), then this
  migration on top, then seeded one profile with a closed + open + full
  hosted Venture and a closed + open + full accepted application - got the
  expected `hosted=1, joined=1` instead of `3, 3`. All 6 verify checks pass
  on a second fresh container.
- No app-side change needed - the client only calls the RPC and never
  encoded the counting rule itself.
- **Not yet applied to production.**

### 2026-08-28 — Claude — Hello retry window + context-split monthly cap

- Second slice of the Moots-replaces-Follow design. Confirmed shape (user,
  2026-08-28): a Hello that goes unanswered or is declined can be retried
  **30 days** later, *except* if the recipient has blocked the sender, which
  keeps blocking every send unconditionally until they unblock — that part
  needed no new code, since the existing `hellos` insert policy's
  `not has_blocked(...)` check already covers it and this migration never
  touches that policy. The flat 5/month cap becomes a **context-split 30**:
  it only counts cold cross-Tribe contact — a Hello to a Tribemate or an
  active shared Venture co-member no longer touches it at all.
- Schema (`20260828040000_hello_retry_and_split_cap.sql`, Red — drops a
  unique constraint and replaces triggers on a table with real rows):
  - Dropped `hellos_one_per_pair`. A retry is a **new row** in the same
    direction, not a mutated old one — `hellos.status` gained `'expired'`
    for a superseded row, and a partial unique index
    (`hellos_one_pending_per_pair ... where status='pending'`) is the hard
    backstop against two live pending rows for one direction.
  - New `trg_hellos_retry_window` (before insert): looks up the latest row
    for that exact direction; blocks the insert if it's `accepted`
    (permanent), or `pending`/`declined` and still inside the 30-day window;
    otherwise allows it — and if the superseded row was a stale `pending`,
    flips it to `expired` as part of the same trigger so exactly one live
    row per direction ever exists. Expiry is lazy (happens on the next send
    attempt), not scheduled.
  - New `hello_is_capped(sender, recipient)` — same-Tribe or active-shared-
    Venture is `false` (uncapped); everything else `true`. Reused by both
    the replaced `hellos_enforce_monthly_cap` trigger (now capped at 30, not
    5) and a new `hellos_capped_sent_this_month(user)` function, so the "N
    left this month" number shown to the user can never drift from what the
    trigger actually enforces.
- App side (`social.functions.ts`): `getContactStatus` now reads the
  **latest row per direction** rather than assuming at most one row ever
  existed (a retry can leave several historical rows), and — since expiry is
  lazy — if *this viewer* is the one who sent a Hello that's now 30+ days
  stale (pending or declined), it's presented as if there's no active Hello
  at all, so the profile offers Say hello again instead of a stuck disabled
  button. A recipient can still answer an old pending request regardless of
  age; that path is unchanged. `hellos_left_this_month` now calls
  `hellos_capped_sent_this_month` instead of a flat count. Updated
  `HelloModal.tsx` and the public-profile copy that assumed "one Hello per
  person, ever."
- Added `LOVABLE_HELLO_RETRY_CAP_VERIFY.sql`. Rehearsed against a throwaway
  Postgres 16 container seeded with the real pre-migration `hellos` schema
  (inline check constraint, named unique constraint, both existing triggers)
  plus stub `is_venture_host`/`is_venture_member`. All 8 verify checks
  passed. Ran 13 functional scenarios end to end: first Hello allowed;
  immediate retry while pending blocked; retry allowed + old row auto-
  expired after backdating 31 days; immediate retry after decline blocked;
  retry allowed 31 days after decline; resend after accepted blocked
  permanently; same-Tribe and active-shared-Venture both correctly uncapped;
  closed Venture does **not** exempt; exactly 30 capped sends allowed, 31st
  rejected; an uncapped-context send still succeeds even with the capped
  count maxed out. All 13 passed (one test's own setup bug on the first run,
  not the migration — a sender profile row was never inserted; fixed the
  test and reran clean).
- **Not yet applied to production** — needs the manual SQL-editor step
  before the matching app code takes effect; until then Hello still runs on
  the old flat-5, no-retry rules.
- Verification: `npx tsc --noEmit` clean, targeted ESLint clean on every
  real source file touched (ran `eslint --fix` on `social.functions.ts` and
  `HelloModal.tsx` to clear formatting-only findings in the touched regions;
  `git diff -w` confirms it changed nothing beyond whitespace), full
  Cloudflare production build passes.

### 2026-08-28 — Claude — Profile stat row: Moots / Hosted / Joined

- First slice of the Moots-replaces-Follow design (full journey, retry rules,
  and split cap discussed with the user but not yet built — this is scoped to
  the stat row only). Public profile (`u.$handle.tsx`) and own Profile both
  now show **Moots | Hosted | Joined**, replacing Following/Followers (and,
  on the public profile, Posts). The Follow button and Following/Followers
  stat are removed from the public profile entirely; Say hello / Message /
  Hello sent / Hello received / Not accepting is now the only relationship
  action there.
- Hosted/Joined intentionally split rather than one combined "Ventures"
  number — organizing vs. showing up are different facts, and it's a cheap
  head start on the still-unresolved Host program question in
  `MEUTUALS_PRODUCTION_AUDIT.md`.
- None of the three numbers were readable for an arbitrary *other* profile
  under existing RLS (`hellos`, `ventures`, and `venture_applications` are all
  scoped to the caller). Added `public.get_profile_stats(uuid)`, one
  `SECURITY DEFINER STABLE` function in the same family as
  `is_venture_scope_visible`/`can_direct_message`, returning only the three
  integers — never which Hellos or Ventures. This is additive (new function,
  new grant on that function only, nothing else touched) — Green by
  `CHANGE_PROTOCOL.md`, but grants are involved so treat the apply step the
  same as the other pending migrations below: paste and verify before relying
  on it.
- `profiles.venture_count` (hosted-only, trigger-maintained) was **not**
  reused for "Hosted" — it's the free-tier Venture-creation quota counter
  (`ProfileScreen.tsx`'s "X of 3 free Ventures left this month"), a different
  concern that happens to currently hold the same number. Left it alone;
  Hosted/Joined/Moots are computed fresh in the new function.
- Added `20260828030000_profile_relationship_stats.sql` and
  `LOVABLE_PROFILE_STATS_VERIFY.sql`. Rehearsed against a throwaway
  Postgres 16 container with stub tables matching the real `hellos` /
  `ventures` / `venture_applications` column names (the local Supabase stack
  is retired) — migration applied cleanly, all 4 verify checks passed, and a
  seeded functional test (2 accepted Hellos + 1 pending, 2 hosted Ventures +
  1 by someone else, 1 accepted + 1 pending + 1 declined application) returned
  the exact expected `(2, 2, 1)`. **Not yet applied to production** — needs
  the usual manual SQL-editor step before the matching app code actually
  shows real numbers instead of zeroes.
- Verification: `npx tsc --noEmit` clean (after adding the `get_profile_stats`
  entry to `types.ts` by hand, since codegen can't run until the migration is
  live), targeted ESLint clean on every real source file touched (`types.ts`
  itself has pre-existing repo-wide semicolon-style noise, confirmed
  unrelated to this change and left alone), and the full Cloudflare
  production build passes.

### 2026-08-28 — Codex — Profile and push release reconciled for production

- Fetched immediately before release and normally merged the three newer
  Lovable commits (`d1a52da`, `1c022d1`, `bb640da`) in an isolated worktree.
  Their generated Supabase typing and push-function type correction merge
  cleanly with the notification-category and Profile header work.
- The release keeps unrelated local `.env`, lockfile, Explore, CSS, and test
  edits outside Git.
- Verification on the merged release: focused ESLint, `npx tsc --noEmit`,
  `git diff --check`, 15/15 profile and push tests, PWA release checks, and the
  full Cloudflare production build pass.

### 2026-08-28 — Codex — Profile settings moved into the global header

- Removed the floating gear from the Profile identity block and added a
  Profile-only menu action immediately beside Notifications in `AppHeader`.
- Standardized both header actions to accessible 44 px circular touch targets
  with matching hover and keyboard-focus treatment.
- Verification: `git diff --check`, focused ESLint, `npx tsc --noEmit`, the
  profile identity test, and the full Cloudflare production build pass.

### 2026-08-28 — Codex — Durable push-notification categories

- Added five persisted, per-member Web Push categories: Messages & mentions,
  Venture activity, Comments & reactions, Tribe activity, and New Tribe posts.
  High-intent categories default on; the highest-volume new-post category
  defaults off. The in-app activity inbox remains complete regardless.
- Added authenticated server functions plus an optimistic TanStack Query store;
  identity comes only from JWT-verified context and the new table is protected
  by owner-only SELECT/INSERT/UPDATE RLS with an updated-at trigger.
- The public dispatch worker now maps every supported notification kind to one
  category and records the delivery as skipped when that member disabled it.
  Preference lookup failures fail closed rather than bypassing an opt-out.
- Added a grouped, accessible Settings surface with real persisted switches,
  44 px touch targets, loading and retry states, and clear category descriptions.
- Added `20260828020000_push_notification_preferences.sql` and
  `LOVABLE_PUSH_PREFERENCES_RELEASE_VERIFY.sql`. The user applied the migration
  in production, repaired the table grants to remove `anon` access while
  preserving authenticated writes and service-role reads, then confirmed all
  seven release-verification rows return `true`. The matching app code is now
  eligible to publish.
- Verification: `npx tsc --noEmit`, focused ESLint, 3/3 preference tests,
  11/11 existing push tests, PWA verification, `git diff --check`, and the full
  Cloudflare production build pass. The signed-in local app also confirms the
  pre-migration fallback renders safely.

### 2026-08-28 — Codex — Adaptive push-notification settings UX

- Replaced the binary push setting with one adaptive card covering device
  checking, intentionally off, connected, newly enabled, permission blocked,
  install required, unsupported/insecure, and connection-repair states.
- Existing subscriptions are reconciled before declaring the device active;
  granted permission without a subscription becomes an actionable repair
  state, while an explicit device opt-out is remembered locally and remains
  off instead of being misdiagnosed as broken.
- Removed success/error toast dependence from the enable path in favor of
  inline, consumer-facing feedback, a short success confirmation, calm amber
  recovery, and a full 44 px touch target around the compact active switch.
- Verified the real signed-in settings route in Chrome at localhost, including
  detection of a granted-but-disconnected browser. `npx tsc --noEmit`, focused
  ESLint, 11/11 push tests, PWA verification, `git diff --check`, and the full
  Cloudflare production build pass.

### 2026-08-28 — User + Codex — Mobile UX and expanded reactions released through Git

- The user manually applied
  `supabase/migrations/20260828010000_expand_chat_reactions.sql` in production
  and confirmed it succeeded before the matching frontend release.
- Fetched `origin/main` immediately before release and confirmed a clean
  fast-forward with no remote commits to reconcile. The release includes the
  mobile chat/media pass, iOS safe-area and shared glass refinements, push
  worker self-repair, visible profile handles, the restrained habitat glow,
  reliable full-screen photo controls, release-to-reply gestures, and the
  six-reaction chat vocabulary.
- Built an isolated worktree from the exact release commit so unrelated local
  `.env`, lockfile, Explore, style, push-test, and untracked artifact changes
  could not enter verification or the Git deployment.
- Release gates: 70/70 Node tests, PWA verification, `npx tsc --noEmit`,
  `git diff --check origin/main...HEAD`, and the complete Cloudflare production
  build all pass.

### 2026-08-28 — Codex — Expanded durable chat reactions

- Expanded the shared Tribe, Venture, and DM reaction vocabulary from three to
  six distinct choices: `❤️` Love, `😂` Funny, `😮` Wow, `😢` Sad, `👍` Like,
  and `🤝` Support. Labels remain available to assistive technology.
- Centralized the reaction order, emoji, labels, type guard, and zero-count
  shape in `src/lib/chat.ts` so the picker, durable count chips, optimistic
  state, server validation, and message readers cannot drift independently.
- Kept 44 px touch targets in a single compact row; on unusually narrow
  screens the tray scrolls horizontally without exposing a scrollbar.
- Added `20260828010000_expand_chat_reactions.sql` to widen both persisted
  reaction constraints and the Tribe contextual-reaction trigger without
  changing participant authorization or ownership. This RED/manual migration
  has not been applied to production.
- Validation: 11 focused chat and Tribe Room tests, `npx tsc --noEmit`,
  `git diff --check`, and `npm run build` pass.

### 2026-08-28 — Codex — Emoji reactions and release-to-reply gesture

- Replaced the Love, Funny, and Support outline glyphs in the shared chat
  reaction tray and count chips with native `❤️`, `😂`, and `🤝` emoji across
  Tribe, Venture, and DM chat.
- Reworked the shared swipe gesture to match familiar messaging behavior: the
  bubble follows a rightward drag with resistance, reveals and scales the Reply
  affordance, triggers only when released beyond the threshold, gives haptic
  feedback where supported, and snaps home. Long press no longer replies.
- Protected links and buttons from pointer capture and suppresses the bubble's
  normal click action after a drag. The existing action-menu Reply remains for
  keyboard and desktop access.
- Reply selection now focuses the shared composer, including Tribe chat which
  previously showed the reply preview without moving focus to the input.
- Validation: `node --test --test-isolation=none tests/chat.test.ts
  tests/chat-interactions.test.ts`, `npx tsc --noEmit`, `git diff --check`, and
  `npm run build` pass.

### 2026-08-28 — Codex — Reliable post lightbox controls

- Separated the full-screen post photo's pointer-capturing zoom/pan surface
  from its top and bottom controls. Touch browsers can no longer redirect the
  close-button tap to the image gesture layer; the same protection covers the
  zoom and reset controls.
- Kept the close control at a 44 px touch target and explicitly layered both
  control bars above the photo surface.
- Added a regression contract covering the gesture/control separation and the
  close button's hit target.
- Validation: `node --test --test-isolation=none
  tests/post-media-lightbox.test.ts`, `npx tsc --noEmit`, `git diff --check`,
  and `npm run build` pass.

### 2026-08-28 — Codex — Restrained habitat atmosphere

- Removed the global lower-left accent glow from `.bg-habitat`, leaving the
  lower viewport neutral so the bottom glass navigation no longer sits over a
  persistent colored halo.
- Reduced the remaining primary top glow from 12% to 7% and moved its center
  partly above the viewport for a quieter atmospheric edge rather than a
  visible radiant patch.
- Verification: focused background contract test, `npx tsc --noEmit`,
  `git diff --check`, and the full Cloudflare production build pass.

### 2026-08-28 — Codex — Visible profile handles

- Added the normalized `@handle` directly beneath the display name in both
  the signed-in user's profile identity block and public profile pages. Handles
  with a legacy leading `@` still render with exactly one prefix.
- Kept the handle visually secondary to the display name and ahead of the
  city/Tribe metadata, with truncation for narrow mobile layouts.
- Verification: focused identity test, `npx tsc --noEmit`, `git diff --check`,
  and the full Cloudflare production build pass.

### 2026-08-28 — Codex — Bottom navigation glass parity

- Matched the fixed bottom navigation to the shared app header's 56% tint,
  24 px blur, and 160% saturation, including the WebKit-prefixed filter for
  iOS Home Screen mode. The frosted surface continues through the device's
  bottom safe area while icons and labels remain unfiltered foreground content.
- Added a source parity test covering both glass surfaces and the navigation's
  safe-area padding.
- Verification: 3 focused tests, `npx tsc --noEmit`, `git diff --check`, and
  the full Cloudflare production build pass.

### 2026-08-28 — Codex — Cross-browser push worker self-repair

- Removed the all-or-nothing `cache.addAll()` dependency from service-worker
  installation. Offline assets now cache independently, so one missing or
  transiently unavailable asset cannot prevent Web Push from activating on
  iOS, Safari, Chromium, or installed desktop apps.
- Corrected the offline-shell URL to the deployed `/offline.html` asset and
  versioned the caches so affected devices fetch the repaired worker.
- Replaced the hanging `navigator.serviceWorker.ready` path with explicit
  install/activate state tracking. Push enable now promotes a waiting worker
  and, when a registration remains inactive, unregisters it and retries once
  automatically instead of asking the user to reload indefinitely.
- Verification: service-worker syntax, PWA release checks, 8 focused push
  tests, `npx tsc --noEmit`, `git diff --check`, full Cloudflare production
  build, and a real Chromium lifecycle check showing the worker `activated`
  with no installer or waiter.

### 2026-08-28 — Codex — Stronger shared header glass

- Strengthened the shared app header glass treatment to a visible 24 px blur
  with 160% saturation and a lighter 56% background tint, so content moving
  beneath the header and iOS status-bar area reads as frosted glass.
- Kept the WebKit-prefixed backdrop filter for iOS Home Screen mode and
  preserved the safe-area inset correction.
- Verification: 2 focused tests, `npx tsc --noEmit`, `git diff --check`, and
  the full Cloudflare production build pass.

### 2026-08-28 — Codex — iOS Home Screen header safe area

- Fixed the shared app header used by Timeline, Discover, Ventures, Chats,
  Profile, and the tab-mounted Tribe screen so its content begins below
  `safe-area-inset-top` in iOS standalone mode. The glass header background
  still extends behind the translucent status bar, but titles, logo, and
  notification controls no longer do.
- Added a source contract test and confirmed Tailwind emits the safe-area rule.
  Verification: 4 focused mobile tests, `npx tsc --noEmit`, `git diff --check`,
  and the full Cloudflare production build pass.

### 2026-08-28 — Codex — Mobile chat viewport, post media, and notification audience

- Made Tribe, Venture, and DM chat shells follow the actual visual viewport
  while mobile keyboards are open, opted supporting browsers into
  `interactive-widget=resizes-content`, and kept composer inputs at 16 px on
  mobile to prevent focus zoom. Attachment previews are now width-contained.
- Removed the “You're home” copy from both Tribe header variants.
- Added a Radix-backed full-screen post photo viewer with pinch, drag, wheel,
  double-tap, reset, and explicit zoom controls. Post `@handles` now render as
  highlighted, keyboard-focusable profile links without treating emails as
  mentions.
- Added `20260828010000_scope_new_post_notifications.sql`: public posts retain
  reciprocal-follow fan-out, while Tribe-only post notifications require the
  recipient to belong to the post's Tribe. The migration still needs to be
  applied before the notification correction is live.
- Verification: 15 focused tests, `npx tsc --noEmit`, `git diff --check`, a
  full Cloudflare production build, and a read-only localhost viewport check
  pass.

### 2026-08-27 — Codex — Tribe header normalized to chat shell metrics

- Matched the Tribe chat header to Venture/DM's 60 px content height and
  horizontal rhythm: 16 px side padding, 12 px gaps, a 36 px room crest, and
  the same two-line title/subtitle density.
- Collapsed the former three-line identity into a 44 px member-access target;
  home state, presence, and member count remain visible without making the
  header taller than the other chat types.
- Verification: 10 focused tests, Prettier, TypeScript, `git diff --check`,
  and the full Cloudflare production build pass.

### 2026-08-27 — Codex — Tribe room shell aligned to approved scratch

- Removed the duplicated breadcrumb plus identity stack for rooms opened from
  Chats. The replacement is one unified header with back navigation, Tribe
  crest, home status, name, member access, and notifications.
- Replaced the small left-clustered room tabs with three equal-width 56 px
  targets, larger display labels, and a clear active underline. The contextual
  New plan action now lives in Plans content instead of compressing the tabs.
- Verification: 13 focused room/chat/mention tests, Prettier, TypeScript,
  `git diff --check`, localhost source confirmation, and the full Cloudflare
  production build pass.

### 2026-08-27 — Codex — Grouped messages regain breathing room

- Replaced the zero/negative seam between connected messages with a 4 px gap.
  The reduced inner corners remain, so a burst still reads as one group without
  collapsing into a solid column.
- Updated the grouping contract test and confirmed localhost:8082 is serving
  the new spacing. Focused tests and TypeScript pass.

### 2026-08-27 — Codex — Stronger connected chat silhouettes

- Responded to signed-in localhost evidence that the first grouped-bubble pass
  was technically present but visually too subtle to register.
- Widened conversational grouping from five to fifteen minutes, collapsed the
  inter-message seam, reduced standalone pill rounding, and gave connected
  messages sharply reduced inner corners. Reaction chips now overlap the
  parent bubble more clearly.
- Applied the same shared treatment to Tribe, Venture party, and direct chat.
  Verification: 13 focused chat/mention/room tests, Prettier, TypeScript,
  `git diff --check`, and the full Cloudflare production build pass.

### 2026-08-27 — Codex — Compact grouped chat bubble model

- Reworked Tribe, Venture party, and direct-message threads around a shared
  five-minute grouping rule: consecutive messages from one sender connect,
  identity appears once at the group start, and time appears once at the end.
- Replaced pill-like system events with quiet ruled timeline notices, attached
  reaction chips to their bubbles, and retained reply swipe, quotes, mentions,
  attachments, safety actions, and the existing 44 px action targets.
- Added focused grouping regression tests. Verification: 17 chat/mention/room
  tests, `npx tsc --noEmit`, `git diff --check`, and the full Cloudflare
  production build pass. Signed-in visual acceptance remains a device check.

### 2026-08-27 — Codex — Push loading fix released to Git; Lovable publish pending

- Built an isolated release worktree from current `origin/main`, copied only
  the five verified push files, reran eleven tests, PWA checks, targeted lint,
  TypeScript, diff checks, and the full production build, then pushed commit
  `0d5edc2` (`fix: prevent push enable from hanging`) to `main`.
- The public `https://moots.lovable.app/` host continued serving its prior
  bundle after repeated cache-busted checks. GitHub has the commit but Lovable
  did not auto-publish it during the verification window.
- Both available browser sessions reached Lovable without an authenticated
  project session, so the final Lovable Publish action remains a user handoff.
  The signed-in Chrome publish tab was left open for that step. Do not call the
  release live until the production bundle contains `Waiting for permission`
  and the push save-timeout recovery copy.

### 2026-08-27 — Codex — Push enable can no longer load indefinitely

- Bounded every asynchronous enable stage: browser permission (45s), service
  worker lookup/registration (10s), PushManager reads/subscription (20s), and
  authenticated subscription persistence (15s). A stalled browser or network
  now clears the loading state and shows a specific recovery message.
- Replaced the unexplained spinner-only state with live progress labels:
  Waiting for permission, Starting notifications, Connecting device, and
  Saving. This applies consistently to the contextual prompt, notification
  banner, and Settings.
- Stabilized automatic subscription reconciliation with refs so a changing
  server-function callback cannot repeatedly rerun the effect and contend with
  the user's explicit Enable action.
- Added a regression test proving a never-resolving push operation rejects.
- Verification: eleven push/navigation tests, PWA checks, targeted ESLint (one
  pre-existing Fast Refresh warning only), `npx tsc --noEmit`,
  `git diff --check`, and the full Cloudflare production build pass.

### 2026-08-27 — Codex — Cross-platform Web Push lifecycle hardening

- Added an explicit insecure-origin state so phone testing over a LAN HTTP URL
  gets actionable HTTPS guidance rather than an unsupported-browser diagnosis.
- Existing browser subscriptions are now serialized and re-claimed for the
  currently authenticated account when the prompt, notification inbox, or
  Settings loads. This closes the gap where a granted subscription survived a
  login change but the client skipped the server ownership update and silently
  stopped delivering to the correct account.
- Updated iPhone/iPad installation guidance to state the iOS/iPadOS 16.4+
  requirement and use browser-neutral Share-menu wording. The app still uses
  feature detection for actual support and requests permission only from the
  user's explicit Enable action.
- Verification: ten push/navigation tests, PWA release checks, targeted ESLint
  (one pre-existing Fast Refresh warning only), `npx tsc --noEmit`,
  `git diff --check`, and the full Cloudflare production build pass.

### 2026-08-27 — Codex — Push waits for an active Service Worker

- Fixed the Chromium `PushManager.subscribe()` race that produced
  "Subscription failed - no active Service Worker". Subscription now reuses
  registrations across both known scope lookups, registers without HTTP cache
  reuse when needed, promotes a waiting first install, and waits for
  `navigator.serviceWorker.ready` before accessing PushManager.
- A genuinely stalled worker now returns a short recovery instruction instead
  of exposing the raw browser exception. Existing active registrations remain
  immediate and current subscription checks ignore inactive registrations.
- Strengthened the PWA release check to require the active-worker lifecycle.
- Verification: PWA checks, nine push tests, targeted ESLint,
  `npx tsc --noEmit`, and the full Cloudflare production build pass.

### 2026-08-27 — Codex — Tribe room top-area gutter alignment

- Reduced the Tribe identity and Chat/Pulse/Plans navigation gutter from 20px
  to the same 12px used by the message list and composer. The full room now
  follows one continuous edge instead of stepping inward above the chat.
- Verification: targeted ESLint, `npx tsc --noEmit`, and `git diff --check`
  pass.

### 2026-08-27 — Codex — Tribe room width-cap follow-up

- The first gutter fix removed stacked padding, but a separate `max-w-md`
  constraint still centered the whole room inside viewports wider than 448px.
  Raised the Tribe room and its back header to a shared 576px cap so narrow
  desktop windows, large phones, and foldables use the available viewport
  instead of rendering empty side columns. Message bubbles retain their own
  percentage width caps.
- Verification: targeted ESLint, `npx tsc --noEmit`, and `git diff --check`
  pass.

### 2026-08-27 — Codex — Tribe chat viewport gutters

- Removed the page-level horizontal padding from the live Tribe conversation.
  The identity and Chat/Pulse/Plans navigation retain the established 20px
  alignment, while messages and the composer now use only their own compact
  12px gutter instead of stacking both values into oversized side rails.
- Pulse and Plans remain constrained to the normal page gutter.
- Verification: targeted ESLint, `npx tsc --noEmit`, `git diff --check`, and
  the full Cloudflare production build pass.

### 2026-08-27 — Codex — Safari typography and Discover deck overlap

- Disabled Mobile Safari's automatic text inflation so Timeline cards, tab
  controls, metadata, and action rows keep the authored responsive type scale
  after rotation and across different iPhone viewport heuristics. Browser
  pinch zoom remains available.
- Moved the mobile Discover deck chevrons into the clear upper photo field and
  reduced their visible glyph size while retaining accessible tap targets. The
  arrows no longer cross the profile name or location block; larger layouts
  retain the established outer-midpoint placement.
- Verification: targeted ESLint, `npx tsc --noEmit`, `git diff --check`, and
  the full Cloudflare production build pass.

### 2026-08-27 — Codex — Push compatibility, privacy, and delivery hardening

- Replaced binary Push API detection with explicit available, blocked,
  install-required, and unsupported states. iPhone and iPad browser tabs now
  receive Home Screen installation guidance before WebKit's intentionally
  hidden Push API is mistaken for missing browser support; desktop-mode iPads
  are detected as Apple mobile devices too.
- Moved subscription writes into a bounded authenticated database capability.
  An installed app can safely reassign its existing subscription after an
  interrupted logout or account switch, while direct unbounded inserts and
  updates are removed and each account is capped at eight active endpoints.
- Added durable delivery state and counters to notifications. The Worker now
  validates its VAPID configuration, times out provider requests, records
  skipped/delivered/partial/failed outcomes, removes expired endpoints, and
  returns non-2xx when configured recipients receive zero successful pushes.
- Private DM, Hello, Venture application, invitation, acceptance, and party-
  chat text no longer appears in lock-screen payloads. Public post activity can
  retain its useful preview. Existing inbox and deep-link semantics are
  unchanged.
- Verification passes: nine focused push/navigation tests, strengthened PWA
  release gate, service-worker syntax, targeted ESLint (one pre-existing Fast
  Refresh warning), clean TypeScript, `git diff --check`, and the full
  Cloudflare production build. The Red migration remains unapplied pending the
  user's manual SQL-editor step and physical iPhone/Android delivery acceptance.

### 2026-08-26 — Codex — Short photo actions without camera glyphs

- Removed the camera badge from both onboarding and Edit Profile because the
  action opens the device's general image-source chooser, not camera-only UI.
  Onboarding now says `Add photo`; Edit Profile says `Change photo`.
- Both avatars remain 96px tappable controls, the text actions retain 44px
  minimum touch height, and neutral spinner overlays preserve upload feedback.
  Onboarding now uses the same direct, visually hidden file-input activation
  pattern as Edit Profile for stronger Android/PWA compatibility.
- The three photo-picker regressions, targeted ESLint, TypeScript,
  `git diff --check`, and the full production build pass. The only lint output
  is Onboarding's existing Fast Refresh warning for its exported helper.

### 2026-08-26 — Codex — Android-safe profile photo picker

- Replaced the avatar label/`display:none` file-input activation with explicit
  avatar and text buttons that synchronously click one visually hidden input.
  The camera affordance is now a 44px touch target and the same photo can be
  selected again after a failed or cancelled attempt.
- Added Android content-provider compatibility for empty and generic MIME
  metadata when the filename has a known image extension. Unsupported,
  oversized, and device-undecodable photos now receive visible feedback rather
  than leaving an inert or blank cropper.
- Added `tests/profile-photo-picker.test.ts`; its three regression cases pass.
  Targeted ESLint, `npx tsc --noEmit`, `git diff --check`, and the full
  production build all pass. Physical acceptance remains for the reporting
  Android device because desktop emulation cannot prove its native picker.

### 2026-08-26 — Codex — Discover completion card gained editorial artwork

- Filled the completion card's empty center with the existing transparent
  Discover illustration, centered in the flexible space between the summary
  and the fixed action stack without adding another frame or surface.
- Removed the one-time swipe tutorial label and its local-storage state; the
  persistent card-edge chevrons already communicate navigation without
  obscuring profile actions.
- Authenticated visual acceptance measured a 253 px illustration with 32 px
  action clearance; targeted ESLint, TypeScript, `git diff --check`, and the
  Cloudflare production build pass.

### 2026-08-26 — Codex — Discover card geometry and location hierarchy aligned

- Expanded the introduction card to the same horizontal edges as the Discover
  filter row, removing the nested 12 px inset while keeping the 8 px top gap.
- Moved the city out of the Tribe identity line and paired it with the distance
  beside one map pin, so place and proximity read as a single location fact.
- Increased the reserved bottom-navigation clearance; authenticated layout
  measurements confirm matching card/control edges and roughly 14 px of visible
  space above the fixed navigation.
- Targeted ESLint, TypeScript, `git diff --check`, authenticated visual
  acceptance, and the Cloudflare production build pass.

### 2026-08-26 — Codex — Discover spacing and return action polished

- Added an explicit 8 px separation between the Discover controls and the
  fixed-height introduction stage, removing the compressed zero-gap join.
- Replaced the tiny “Revisit today’s people” utility link with a full-width,
  56 px return action: “Back to today’s five” with the supporting cue “Review
  anyone again.” The footer stays visually secondary to the next-step choices.
- Authenticated mobile acceptance measured the 8 px stage gap and 56 px return
  target; targeted ESLint, TypeScript, `git diff --check`, and the Cloudflare
  production build pass.

### 2026-08-26 — Codex — Discover chevron collision removed

- Moved the borderless previous/next chevrons from the whole-card midpoint to
  the photo-stage midpoint, eliminating the collision between the left
  chevron and the gold “In their words” rule.
- Aligned both 44 px touch targets exactly inside the card (`32–76` and
  `314–358` at 390 px viewport width). The controls remain visually unboxed,
  swipe behavior is unchanged, and profile text has a clear content plane.
- Authenticated mobile acceptance, targeted ESLint, TypeScript,
  `git diff --check`, and the Cloudflare production build pass.

### 2026-08-26 — Codex — Discover hierarchy and card-edge chevrons polished

- Moved the active deck heading and context above the compact mood/location/
  Tribe/search controls, so the default screen now reads “Today’s five” first,
  then the Surprise Me row, then the profile card.
- Replaced the overlapping circular previous/next controls with borderless
  chevrons inside the card edges. The invisible touch targets remain 44 px wide
  and the final profile uses the same forward chevron instead of changing to a
  door icon.
- Authenticated Chrome acceptance at 390×844 confirmed both controls are fully
  inside the viewport (`24–68` and `322–366`), the card ends above the fixed
  navigation, and the document remains one viewport tall. Targeted ESLint,
  TypeScript, `git diff --check`, and the Cloudflare production build pass.

### 2026-08-26 — Codex — Discover became a fixed Today’s Five stage

- Converted Discover into a `100dvh` workspace with no page-level scrolling.
  The compact mood, location, Tribe and search controls sit above one bounded
  card stage; search results scroll only inside their own region.
- Made every introduction card the same responsive height. Optional open
  Ventures now render as a one-line image overlay, long profile text is
  clamped, actions stay pinned to the card bottom, and the outer arrows remain
  at the card midpoint.
- Replaced the six equal completion rows with one primary “Meet another five”
  lens surface plus focused Venture and Tribe exits. Tribe discovery now opens
  in a full-height layer and returns to the exact deck state instead of living
  below the cards.
- Authenticated Chrome acceptance at 390×844 confirmed a document height of
  exactly 844 px, a card bottom above the fixed nav, identical 582.5 px card
  heights across four profiles with and without Ventures, full-height Tribe
  browsing, and internally scrolling search results. Targeted ESLint,
  TypeScript, all 33 Node tests, `git diff --check`, PWA verification and the
  full Cloudflare production build pass.

### 2026-08-26 — Codex — Discover became swipe-first Five + Doors

- Rebuilt the focused introduction card around a large profile-photo stage,
  with a Tribe-art identity fallback for accounts that only have an emoji or a
  failed image. The quote, two strongest factual reasons, open Venture and
  Hello/profile actions remain visible without turning the experience into an
  appearance-only deck.
- Replaced the small Back / count / Maybe later row with horizontal browsing
  and 48 px accessible arrow controls overlapping the card's outer midpoint.
  There is no numeric counter, no reject state, and edge-origin gestures are
  ignored so the PWA/browser Back gesture keeps ownership of the screen edge.
- The end of the first set now opens contextual doors: a non-repeating set for
  overlapping availability or a different mood, nearby radius preferences,
  Ventures, Tribes, and direct search. A maximum of five additional profiles
  is selected from the already-authorized ranked pool; no SQL or visibility
  rule changed.
- Verification: Prettier, targeted ESLint, `npx tsc --noEmit`, all 33 Node
  tests, `git diff --check`, PWA release checks and the full Cloudflare
  production build pass. The localhost app hot-reloads cleanly, but that
  browser origin is signed out, so authenticated phone gesture and crop
  acceptance remains for the user's existing session.

### 2026-08-26 — Codex — General Lovable shared-link thumbnail

- Created `public/meutuals-lovable-share-general.png` (1727×908) as the
  preferred general MEUTUALS shared-link cover. It derives from the published
  app illustrations rather than a single Tribe: five people, balanced accent
  details from the Tribe family, general messaging and plan-making cues, and
  the exact shipped MEUTUALS eye mark composited above the wordmark. It is a
  publishing artifact only and is not imported by the app.

### 2026-08-26 — Codex — Editorial Lovable shared-link thumbnail

- Created `public/meutuals-lovable-share-editorial.png`, a 1729×910 wide
  social-preview image in the established MEUTUALS screen-print illustration
  language: warm ivory figures, near-black ink, tactile print grain, Tribe
  masks worn up with visible faces, and the existing fuchsia/rose/coral palette.
  This is the preferred shared-link thumbnail; the earlier photo-editorial
  option remains as a separate file for recovery, not an application import.

### 2026-08-26 — Codex — Lovable shared-link thumbnail

- Created `public/meutuals-lovable-share.png`, a 1730×909 social-preview
  graphic for MEUTUALS. It uses the established charcoal, fuchsia, rose, and
  coral palette with a diverse connected-friends scene and a legible MEUTUALS
  wordmark; it is a publishing artifact and is not imported by the app.

### 2026-08-26 — Codex — Settings became a full-screen navigation space

- Replaced the long Settings dialog with an authenticated `/settings` route;
  the bottom navigation is absent and the sticky mobile header respects safe
  areas.
- Split account, notifications, nearby discovery, installation, privacy and
  safety, and blocked accounts into focused route-history views. Header Back,
  Android system Back, and iOS edge Back now unwind the same browser history.
- Preserved all existing controls: profile editing, Tribe movement, password
  reset, push preferences, PWA installation, approximate-location privacy,
  blocked-account management, legal links, sign-out, and account deletion.
- Validation: targeted ESLint and `tsc --noEmit` pass; app-navigation tests are
  3/3; PWA release checks pass; the production Cloudflare build exits 0. The
  signed-out local route redirects cleanly to login with no console errors.
  Authenticated device acceptance remains for the user session.

### 2026-08-26 — User + Codex — Flexible scheduling released to production

- The user manually applied
  `supabase/migrations/20260826020000_tribe_plan_availability.sql` in Lovable
  and confirmed every row from
  `LOVABLE_TRIBE_PLAN_AVAILABILITY_VERIFY.sql` returned `true`. Production now
  accepts the bounded `time_1`–`time_3` availability reactions and rejects
  malformed or out-of-context votes.
- Fetched `origin/main` immediately before release and confirmed a clean
  fast-forward with no remote divergence. The matching UI requires an exact
  host-confirmed Venture schedule while allowing flexible Tribe-plan windows
  and member availability polling.
- Release gates were already completed against this application commit:
  Prettier, targeted ESLint, `npx tsc --noEmit`, all 31 Node tests,
  `git diff --check`, and the complete Cloudflare production build. Local
  `.env`, `package-lock.json`, and `HANDOFF.md` changes remain outside the
  committed release.

### 2026-08-26 — Codex — Tribe availability resolves into an exact Venture time

- Replaced the fixed rough-timing chips in Tribe plans with two intentional
  paths: one flexible date/window, or an “Ask the room” poll containing two or
  three distinct options. Dates use the phone's native picker while all public
  labels use unambiguous localized copy such as `Sat 29 Aug · Afternoon`.
- Members can select every poll option that works for them. Availability uses
  the existing normalized, member-authorized Tribe reaction table with stable
  option keys, bounded plan metadata, one vote per member and option, and a
  trigger that rejects votes against any other message or malformed option.
- Turning a Tribe plan into a Venture now opens schedule confirmation first,
  prefills the highest-availability window, and still requires the host to
  publish an exact start and end. The Venture picker adds This weekend,
  morning/afternoon/evening start shortcuts, a visible localized date, and a
  custom end clock that supports after-midnight plans without a second date
  picker. The authenticated create boundary now refuses timestamp-free
  Ventures rather than relying only on form state.
- Added `20260826020000_tribe_plan_availability.sql` and
  `LOVABLE_TRIBE_PLAN_AVAILABILITY_VERIFY.sql`. This Red migration was not run
  by Codex; apply it manually in Lovable and require every verification row to
  return `true` before releasing the matching UI.
- Validation passed Prettier, targeted ESLint, `npx tsc --noEmit`, all 31 Node
  tests, `git diff --check`, and the complete Cloudflare production build.

### 2026-08-26 — User + Codex — Venture coordination production release

- The user manually applied
  `supabase/migrations/20260826010000_venture_chat_coordination.sql` in Lovable
  and confirmed every row from
  `LOVABLE_VENTURE_CHAT_COORDINATION_VERIFY.sql` returned `true`. Production
  now has the arrival states, host announcement, and protected system-event
  schema required by the Venture coordination UI.
- Fetched `origin/main` immediately before release and confirmed a clean
  fast-forward with no remote commits to reconcile. The release contains the
  Tribe and Venture participant-directory refinements plus the completed
  Venture coordination room; Google Places remains disabled by the settled
  feature-flag decision.
- Release gates passed immediately before deployment: Prettier, targeted
  ESLint, `npx tsc --noEmit`, all 28 Node tests, `git diff --check`, and the
  complete Cloudflare production build. Local `.env`, `package-lock.json`, and
  `HANDOFF.md` changes remain outside the committed release.

### 2026-08-26 — Codex — Venture chat became a coordination room

- Added a compact Venture Brief inside party chat with the scheduled time,
  host-authored place and private arrival instructions, a useful two-hour
  countdown, and meet-safely guidance. Quiet rooms now offer contextual starter
  prompts instead of ending at “No messages yet.”
- Added member-owned arrival states (on my way, arrived, running late, and
  cannot make it), a host-managed pinned update, status visibility in the
  participant directory, and centered non-interactive system events for
  meaningful plan, participant, arrival, announcement, and closure changes.
- Kept the release backwards compatible before the Red migration is applied:
  ordinary chat continues working while coordination controls stay hidden.
  Apply `supabase/migrations/20260826010000_venture_chat_coordination.sql`
  manually in Lovable, then run
  `LOVABLE_VENTURE_CHAT_COORDINATION_VERIFY.sql`; every returned check must be
  `true`. The migration was not executed by Codex because the local app uses
  production and database changes are manual by user decision.
- Validation passed Prettier, targeted ESLint, `npx tsc --noEmit`, all 28 Node
  tests, `git diff --check`, and the complete Cloudflare production build.

### 2026-08-26 — Codex — Venture party participant directory

- Replaced the Venture chat header's passive slot fraction with an exact,
  selectable participant count that opens the shared bottom-sheet pattern.
- The directory is built only from the host and accepted applications, keeps
  the host first, labels roles, supports search and public-profile navigation,
  and exposes the existing report/block controls. Active Venture members can
  move directly into a DM; completed memories omit that shortcut and retain the
  established Moot recap flow.
- Added focused tests for accepted-only membership and ordering. Validation
  passed targeted ESLint, `npx tsc --noEmit`, all 26 Node tests,
  `git diff --check`, and the complete Cloudflare production build. No database
  migration or new participant query was required.

### 2026-08-26 — Codex — Tribe member hover kept flat

- Removed the rounded filled hover/pressed surface from profile-capable member
  rows. The directory now preserves one continuous list while communicating
  the profile action through restrained text emphasis and chevron movement.
- Validation passed Prettier, targeted ESLint, `npx tsc --noEmit`, all 24 Node
  tests, and the complete Cloudflare production build.

### 2026-08-26 — Codex — Tribe member profiles made discoverable

- Turned each member's avatar, name, and handle into one clear profile target
  with pressed/focus feedback and a small navigation chevron, while preserving
  Message and report/block as independent actions.
- The current account's row now opens its own public profile instead of being a
  disabled identity row. Members without a routable handle remain safely
  non-interactive.
- Validation passed targeted ESLint, `npx tsc --noEmit`, all 24 Node tests, and
  the complete Cloudflare production build. No database change was required.

### 2026-08-26 — Codex — Tribe Room member directory

- Made the live member summary in the Tribe Room identity header a 44 px
  control that opens the shared accessible mobile bottom sheet without
  changing the fixed-height chat layout or adding another room tab.
- Added one authenticated, membership-authorized and bounded member query that
  now powers the header count, mention candidates, and directory instead of a
  second direct profile fetch. Presence supplies exact online account ids;
  the directory keeps the current account first, then live members, then the
  remaining alphabetical list.
- Added search by display name or handle, real loading/empty/error/retry states,
  profile and same-Tribe Message actions, a `You` state, lazy avatars, and the
  existing report/block menu with a full-size touch target. No database
  migration or new public presence disclosure was introduced.
- Validation passed targeted ESLint, `npx tsc --noEmit`, all 24 Node tests
  (including two directory ordering/search cases), `git diff --check`, and the
  complete Cloudflare production build. The local browser reached the real
  app successfully but had no signed-in session, so populated-room visual
  acceptance remains for the user's device.

### 2026-08-26 — Codex — Production release verified for Git deployment

- Prepared the 28-commit release range after fetching `origin/main` and
  confirming production had not moved. The release includes nationwide
  Indonesian GPS labels, installed-PWA guidance, the Tribe participation room,
  unified live-chat capabilities, Today's five Explore, and the notification
  activity inbox with exact destination routing.
- Confirmed the required Tribe Room and chat-parity database migrations were
  manually applied and returned all-green release checks. Google Venue
  precision remains intentionally disabled behind `GOOGLE_PLACES_ENABLED`.
- Release gates passed: `npx tsc --noEmit`, 22/22 Node tests, PWA verification,
  and the complete Cloudflare production build. Repository-wide lint remains a
  known baseline of 2,402 mostly-Prettier findings and was not mass-reformatted
  during deployment. Local `.env`, `package-lock.json`, and `HANDOFF.md` changes
  are outside the committed release.

### 2026-08-26 — Codex — Notification taps land on their source

- Replaced the notification screen's module-memory-only handoff with validated,
  URL-backed destinations for Chats, Venture tickets/chat, Tribe rooms, and
  root tabs. The destination now survives route chunk remounts and installed
  PWA navigation, and it explicitly selects the correct tab instead of
  inheriting whichever tab the member last used.
- Post activity now opens the existing dedicated `/p/$postId` screen, so likes,
  comments, mentions, and new-signal notifications land on the exact Signal
  instead of merely returning to Timeline. Profile notifications continue to
  use the exact public profile route.
- Prevented account/tab restoration from overwriting an incoming notification
  target, retained native back-state behavior, and made older in-app intents
  choose their canonical Chats or Feed tab.
- No database or RLS change was needed. Validation passed targeted ESLint,
  `npx tsc --noEmit`, all 5 notification presenter/navigation tests, a full
  Cloudflare production build, and signed-in browser checks against populated
  production-backed local data: a real like opened its exact post URL and a
  real Venture acceptance opened **My Ventures** for its ticket.

### 2026-08-26 — Codex — Notification activity inbox

- Replaced the stacked notification-card feed with a restrained activity
  stream grouped into **New**, **Today**, **This week**, and **Earlier**. The
  calendar groups use the member's local day, unread state is communicated by
  structure plus color, and the header exposes a real count with 44 px Back
  and Read-all controls. Loading, empty, query-error, retry, and visible focus
  states are all covered.
- Removed the 1.5-second screen timer that silently marked every row read.
  Selecting a row now optimistically marks only that notification; Read all is
  explicit; both mutations restore the cache and surface an error if the
  authenticated database write fails.
- Centralized category, action-copy, grouping, and destination decisions in a
  pure presenter. Likes/comments/replies reach their source, DMs and accepted
  Hellos open the person, incoming Hellos open the review surface, Venture
  applications focus Hosting, invites/acceptances focus the relevant ticket,
  Venture messages open the exact party chat, and Tribe joins open the room.
- Push payloads now retain the real event verb and deep-link through
  `/notifications?open=<id>`. The old post query parameter was never consumed,
  while other push kinds discarded context on the home screen.
- No database migration or policy change was required. Validation passed:
  targeted ESLint, `npx tsc --noEmit`, all 4 notification-presenter tests,
  `git diff --check`, and the complete Cloudflare production build. A real
  browser pass covered the responsive empty state at desktop and 390×844;
  both available signed-in sessions had no notification rows, so populated
  visual acceptance remains for a member with activity.
- The frontend skill drove the plain-list hierarchy and restrained semantic
  color; the full-stack skill drove explicit state feedback, typed cross-screen
  handoffs, optimistic rollback, and testable presentation logic.

### 2026-08-26 — Codex — Explore “Today’s five” invitation deck

- Rebuilt Explore around a focused daily set of five people. The experience
  now asks what the member is up for — Surprise me, Coffee nearby, Make
  friends, Create something, or Tonight — then presents one person at a time
  through their own bio, explainable shared signals, and an open Venture when
  relevant. Tribe previews moved below the people experience.
- Removed the deck/list switcher and match percentages from discovery. Search
  deliberately remains a compact list, while the default flow uses Back and
  **Maybe later**; completing a round explicitly says nobody was rejected.
  Save is a quiet bookmark action, and the primary contact action adapts from
  contextual Hello to direct Message once contact access exists.
- Added a pure, tested mood-curation helper. It only reorders the server's
  authorized Explore page, keeps Surprise based on the canonical rank, and
  rotates within the strongest eight on the user's local day. No database,
  RLS, or API contract changed.
- The frontend and full-stack skills drove the restrained editorial card,
  honest explainability, 44 px controls, minimal CSS-only transitions, and the
  separation of discovery from search instead of adding decorative chrome.
- Validation: focused ESLint, `npx tsc --noEmit`, all 3
  `tests/explore-moods.test.ts` cases, `git diff --check`, and the complete
  Cloudflare production build pass. The build retains the existing large-chunk
  warning; no new build failure was introduced.

### 2026-08-26 — Codex — One chat capability system across Tribe, Venture, and DM

- Extracted `ChatComposer` and `ChatMessageActions` from the newest Tribe-chat
  interaction into shared modules. All three live chat surfaces now use the
  same right-aligned attachment, camera, and send controls; the same structured
  reply preview; and the same Love / Funny / Support reaction tray and counts.
- Upgraded direct and Venture messages from text-only rows to structured rich
  messages with private photo paths, reply targets, and durable normalized
  reactions. Replies are database-guarded to the same DM pair or Venture;
  reaction access is checked through pinned `SECURITY DEFINER` helpers rather
  than RLS-filtered cross-user subqueries.
- Added a private, MIME-restricted, 5 MB `chat-attachments` bucket. Reads are
  limited to the DM participants or Venture members, ownership is encoded in
  upload paths, in-use files cannot be directly removed, failed message sends
  clean up their unused upload, and the UI renders one-hour signed URLs.
- DM and active Venture rooms now support tap-for-actions plus swipe-to-reply.
  Venture message polling was aligned with DM polling; reaction overrides yield
  back to fresh server state. Completed Venture Memories deliberately disable
  reply/reaction writes and keep their recap available.
- Added `LOVABLE_CHAT_PARITY_RELEASE_VERIFY.sql` and a focused shared-chat
  test. `20260825020000_chat_capability_parity.sql` is **RED and not applied**;
  localhost talks production, so signed-in acceptance must wait for the manual
  Lovable migration and all-green verification query.
- Validation: `npx tsc --noEmit`, focused ESLint on all changed application
  files, `tests/chat.test.ts`, all four `tests/tribe-room.test.ts` cases, and
  the full Cloudflare production build pass. Repository-wide lint remains
  pre-existing red (2,423 mostly-Prettier findings outside this feature). The
  browser reached the local app successfully but only the signed-out login
  state was available, so no authenticated visual mutation was performed.

### 2026-08-25 — Codex — Full-height Tribe Chat and native back navigation

- Rebuilt the Tribe Room as a viewport-locked `100dvh` shell. The document no
  longer scrolls while Chat is active; the identity, `Chat / Pulse / Plans`
  navigation, and composer remain fixed, and only the message pool owns
  vertical scrolling. Pulse and Plans are now focused sibling panes instead
  of permanently consuming the chat viewport.
- Added an app navigation snapshot to browser history without replacing
  TanStack Router state. Bottom-tab changes and primary full-screen layers
  (Tribe room, DM/Venture chat, and post comments) now create real history
  entries. Android system Back and iOS/browser edge-back therefore restore the
  previous Meutuals surface before the browser or installed PWA can exit.
- Added focused tests for valid, layered, and unrelated browser history state.
  Verification passed: targeted ESLint, `npx tsc --noEmit`, 3/3 navigation
  tests, and the Cloudflare production build. Both local browser contexts
  reached the login screen, so signed-in physical-device gesture acceptance
  remains to be performed by the user.
- The frontend skill led to the single-active-surface layout rather than
  squeezing Room activities above a tiny message list; the full-stack skill
  kept the back behavior in a typed, router-state-preserving helper.

### 2026-08-25 — User + Codex — Tribe Room production database verified

- The user manually applied `20260825010000_tribe_room.sql` followed by
  `20260825011000_tribe_chat_reactions.sql` in the Lovable SQL Editor.
- The updated `LOVABLE_TRIBE_ROOM_RELEASE_VERIFY.sql` completed with every
  reported check `true`. Structured Room activities, durable Tribe reads, and
  chat reactions now have their required production schema and policies.
- No additional database action remains for this release. Signed-in mobile
  interaction and visual acceptance remain the next validation step.

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
  accepted member read the other _accepted_ applications of the same Venture.
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

**Bug Kila found:** an accepted member could see _that_ they were in and nothing
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
   `D:\Dheoryans\Meutuals\mobile-vision-unleashed` _before_ writing and
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
  The protocol's core: _additive changes fail loudly, access changes fail
  silently_. Green work proceeds; Red — RLS, triggers, grants, updates on live
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
masquerade is _about concealment_, and this product is built on the opposite.
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

| Tribe       | key    | crest file        | palette             |
| ----------- | ------ | ----------------- | ------------------- |
| Iron Wolf   | `wolf` | `iron-wolf.webp`  | `var(--tribe-wolf)` |
| Mindful Koi | `koi`  | `koi.webp`        | `var(--tribe-koi)`  |
| Studio Cat  | `cat`  | `studio-cat.webp` | `var(--tribe-cat)`  |
| Night Owl   | `owl`  | `night-owl.webp`  | `var(--tribe-owl)`  |
| Honeybee    | `bee`  | `honeybee.webp`   | `var(--tribe-bee)`  |

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
_both_ sides and requires `discoverable`. So any user who had not granted
browser geolocation got zero scored rows and fell through to
`listDiscoverProfiles`, which is `order by created_at desc`. At launch density
that is what Explore actually was for nearly every user: a list of whoever
signed up last, with no relevance signal of any kind. Nothing errored, so it
looked like it worked.

**New:** `supabase/migrations/20260820002200_explore_relevance.sql` —
`public.list_explore_matches(_limit, _offset)`.

Scoring, 0–100:

| Signal                                 | Points     |
| -------------------------------------- | ---------- |
| Any shared social intent               | 30         |
| Each shared interest (capped)          | 10, max 30 |
| Any shared availability                | 15         |
| Hosts an open Venture with a free seat | 15         |
| Within the mutual radius               | 10         |

- **Location is a LEFT JOIN.** No location means no proximity bonus, not an
  empty result set. This is the whole fix.
- **Sharing a Tribe is worth 0, deliberately.** Under exclusive membership,
  tribemates are already directly reachable and Explore is the _cross-Tribe_
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
queries: no search term is a _ranking_ question and uses the RPC; a search term
is a _lookup_ and stays on `listDiscoverProfiles`.

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
  in _both_ `user_id` and `profile_id`, so match on either.
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
