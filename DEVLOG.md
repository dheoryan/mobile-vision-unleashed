# DEVLOG — MEUTUALS

Shared state between agents working on this repo. **Read `AGENTS.md` first** for
conventions and landmines; this file is the moving parts.

Keep this file current. An out-of-date devlog is worse than none, because the
other agent will trust it.

---

## Current state

**Phase:** pre-launch hardening. Target: App Store + Play + web, **free at
launch** (no real payments).

**Branch:** `main`. **19 commits unpushed** — the user has not authorised a push.
Do not push without asking.

**Local dev works.** Docker Supabase + dev server run on the user's machine.
Migration replay from scratch is fixed in-repo as of 2026-08-20.

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

---

## In flight

Claim before you start. Remove your row when done and log it below.

| Agent | Area | Files | Started |
|---|---|---|---|
| _(none)_ | | | |

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
| **Nearby discovery** | Optional and mutual. Browser location is requested only after an explicit action, rounded to roughly 1 km before storage in an owner-private table, and never returned to other users. Discovery exposes distance bands plus a similarity score; no map or background tracking. |
| **Pushing to remote** | User-authorised only. Both agents. |
| **One Tribe per user** | Exclusive membership. 21-day switch cooldown with a 7-day onboarding grace window. `profiles.tribe_ids` is capped at 1 by trigger, and `tribe_members` is reconciled on every change. Multi-Tribe is gone — don't reintroduce "Add Tribe" anywhere; the affordance is **Move**. |
| **Global vs Tribe timeline** | Global is look-but-don't-touch: read, like, comment, repost — but no direct Follow or DM across Tribes. Crossing Tribes goes through Explore → Hello → accept. Enforced in `can_direct_message()`. |
| **Swipe lives on Ventures, not people** | Judging a plan, not a face. Explore uses focused one-at-a-time cards with Next/Back where Next means *later*, not *never*. Reject-forever on people needs a pool of thousands and imports dating semantics; user agreed. |
| **Illustration masks** | Tribe animals appear as masks **worn up / half-masks with faces visible** — never full face-covering. A masquerade signals anonymity, and this product is built on accountable identity (real handles, adult verification, Hello gating). Full masks would also pull toward the romantic register the Explore deck was designed away from. |
| **Which art is transparent** | `app-illustrations/*` float on the app surface and MUST be transparent. `tribes/*.webp` are full-bleed backgrounds under a gradient scrim and MUST stay opaque at 900x1200 — the black is the artwork and the scrim needs something to blend into. Art that floats needs transparency; art that sits behind content does not. |
| **Illustration assets** | `src/assets/app-illustrations/*` are **transparent WebP**. `FeatureIllustration` draws no card, border or crop. Any regeneration must preserve transparency, or ship on flat pure #000000 with no vignette/gradient/frame so it can be re-keyed. Black-backed art puts the rectangle back in every empty state. |
| **Explore ranking** | `list_explore_matches` scores on stated signals. Location is a **bonus, never a gate** — that regression is what made Explore newest-first for most users. Sharing a Tribe is worth **0** on purpose: tribemates are already reachable, and Explore is the cross-Tribe bridge. Distance bands are disclosed only inside the mutual radius. |

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
- **M1** `profiles.venture_count` is a read-modify-write race; venture slot acceptance is check-then-act (two simultaneous accepts can over-subscribe).
- `listVentureMatches` remains unused. Tribe join/leave is now reachable through Manage Tribes; the final home Tribe cannot be removed.
- Shared posts now use the current origin and a real RLS-protected `/p/$postId` route with post-login return.
- `.env` is tracked in git despite being in `.gitignore` (contents are only the publishable key, so hygiene not leak).

---

## Cross-agent notes

Leave messages for the other agent here.

_(empty)_

---

## Work log

Newest first. Append; don't edit past entries.

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
