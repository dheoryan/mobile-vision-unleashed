# DEVLOG — MEUTUALS

Shared state between agents working on this repo. **Read `AGENTS.md` first** for
conventions and landmines; this file is the moving parts.

Keep this file current. An out-of-date devlog is worse than none, because the
other agent will trust it.

---

## Current state

**Phase:** pre-launch hardening. Target: App Store + Play + web, **free at
launch** (no real payments).

**Branch:** `main`. **5 commits unpushed** — the user has not authorised a push.
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
| Week 2 — safety & correctness | ⬜ **next** |
| Week 3 — compliance & launch prep | ⬜ not started |
| Product: audience-primitive decision | 🟡 recommended, **awaiting user decision** |

---

## In flight

Claim before you start. Remove your row when done and log it below.

| Agent | Area | Files | Started |
|---|---|---|---|
| _(none)_ | | | |

---

## Decided — do not re-litigate

| Decision | Detail |
|---|---|
| **Brand name** | `MEUTUALS` (not MUTUALS, not Moots). User chose this spelling explicitly. Internal identifiers stay lowercase `mutuals` — component dir, `mutuals-data.ts`, package name. Don't "fix" those. |
| **Pricing copy** | User said **leave both** `/tiers` and `/upgrade` as-is. They contradict each other and the DB; that is known and accepted. Don't touch pricing content. Both routes are now gated behind `MONETIZATION_ENABLED`. |
| **Payments** | Free at launch. No processor. When it happens: StoreKit / Play Billing / hosted checkout — **never** an in-app card form (Apple 3.1.1). Entitlement must be granted server-side from the store webhook, since `profiles.plan` is deliberately not user-writable. |
| **Animation** | Minimal CSS fades only. `motion` was added then removed at user request. Don't reintroduce a JS animation library. |
| **Modals** | All go through `src/components/ui/animated-modal.tsx` (Radix Dialog + CSS). It provides focus trap, ESC, click-outside. Don't hand-roll `fixed inset-0` modals. |
| **Pushing to remote** | User-authorised only. Both agents. |

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

## Known issues — prioritised, not yet fixed

Full detail and file:line evidence in `MEUTUALS_PRODUCTION_AUDIT.md`.

### Week 2 — safety & correctness (next up)

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

### Week 3 — compliance

| ID | Issue |
|---|---|
| **L1** | **No moderation surface at all.** Reports insert into a table with no status column, no moderator role, no admin route, no trigger. UI claims "we'll review it shortly." Apple 1.2 requires acting within 24h. **Longest pole — 3–5 days.** |
| **L2** | No content filtering of any kind — text or image. |
| **L5** | Privacy policy names Vercel, Stripe, PostHog, Sentry (none are used) and omits Cloudflare, Supabase, Google OAuth, push data, public image storage. Both stores read this URL. |
| **L8** | Ventures have zero safety layer — no guidance, no report/block on venture surfaces, `listVentureMatches` doesn't filter blocked users. |
| **L9** | Placeholder contact emails (`privacy@`, `appeals@`, `hello@` — all TODO). Missing Sign in with Apple. Metadata name inconsistency (manifest says `MUTUALS`). |

### Deferred / lower priority

- **P5** push fan-out is one Worker invocation per recipient (5k followers = 5k invocations from one post).
- **P7** inbox rebuilt from last 500 raw messages (heavy users lose threads; unread badge counts every inbound message ever); no feed pagination; unbounded `.in()` lists → HTTP 414; full-resolution avatars (`compressImage` exists but is called from one place); failed queries render "No posts yet".
- **M1** `profiles.venture_count` is a read-modify-write race; venture slot acceptance is check-then-act (two simultaneous accepts can over-subscribe).
- Dead code: `joinTribe` / `leaveTribe` / `listVentureMatches` have zero call sites. No way to leave a tribe.
- Venture notification triggers all insert `kind = 'message'`, so three styled notification types are unreachable.
- `PostCard.tsx` share copies `https://mutuals.app/p/${id}` — **there is no `/p/` route.** Every share is a dead link.
- `.env` is tracked in git despite being in `.gitignore` (contents are only the publishable key, so hygiene not leak).

---

## Cross-agent notes

Leave messages for the other agent here.

_(empty)_

---

## Work log

Newest first. Append; don't edit past entries.

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
