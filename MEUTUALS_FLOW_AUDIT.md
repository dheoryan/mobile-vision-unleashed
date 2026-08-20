# MEUTUALS end-to-end flow audit

**Audit date:** 2026-08-20  
**Scope:** the existing free-launch product, from account creation through all
reachable social and Venture outcomes. Monetization and the host facade remain
feature-flagged off and are not launch flows.

## Verdict

The essential social loop is implemented and works locally:

> create a verified-adult account → join a Tribe → post/chat/discover → follow,
> react, comment, share, save, and DM → create or apply to a Venture → host
> accepts → accepted party chats → block/report when needed → moderator acts.

The application is **engineering-complete for an internal beta**, but is **not
ready for public store submission**. The remaining launch blockers depend on
real operational or external configuration: image moderation, staffed report
response, verified legal/contact information, production OAuth/push setup, and
store/privacy review.

## Method and evidence

- Static trace of routes, components, authenticated server functions, storage,
  RLS policies, database triggers, and notification dispatch.
- Fresh local Supabase replay through migration
  `20260820001300_baseline_text_safety_filter.sql`.
- Two-account Playwright walkthrough covering signup, adult verification,
  onboarding, Tribe activity, Timeline, Discover, public profiles, follows,
  reactions, comments, DMs, notifications, and the complete Venture lifecycle.
- SQL adversarial checks for two-way blocking, age enforcement, private media,
  preserved reports, constant-time counters, durable DM receipts, Venture
  notification kinds, moderation actions, and rejected high-confidence text.
- Moderator browser walkthrough of `/admin/reports`, including role denial,
  pending empty state, and a resolved `hide_content` decision with audit notes.
- TypeScript and production-build checks are required after the audit fixes.

## Flow matrix

| Flow | Result | Evidence / remaining condition |
|---|---|---|
| Email signup | Pass | DOB is collected before signup; email confirmation remains environment-dependent. |
| Google sign-in | Code complete | Provider button and DOB handoff exist; production provider/redirect configuration must be verified. |
| Apple sign-in | Code complete | Login/signup button and provider call exist; Apple/Supabase production credentials must be configured and tested. |
| Login, logout, password reset | Pass with external email check | Password login/logout passed locally. Reset request and recovery handlers exist; production mail delivery must be tested. |
| 21+ eligibility | Pass | Client guidance plus immutable server-derived verification, restrictive RLS, and write triggers. Underage and incomplete accounts are rejected. |
| First-run onboarding | Pass | Four-step flow covers Tribe, identity/handle, standardized searchable city selection, interests, social intention, availability, and optional nearby consent with a labeled radius slider. Required signals gate completion; city-only fallback works. Push no longer interrupts onboarding. |
| Tribe membership | Pass | Join announcement, chat, media/reply/mention plumbing, manage memberships, and leave flow exist. The final home Tribe cannot be removed. |
| Timeline | Pass | Empty/loading/error states are distinct; create, edit/delete ownership, private media, reactions, saves, comments/replies, and scoped reads exist. |
| Shared post link | Pass | `/p/$postId` enforces authenticated RLS visibility and now returns to the shared post after sign-in. |
| Discover and search | Pass | General discovery/search and public profiles work. Optional nearby discovery uses mutual radius, coarse distance bands, similarity ranking, and two-way block exclusion without returning coordinates. A contextual radius/status control uses progressive disclosure for pause/resume and radius; nearby people are deduplicated from general discovery. |
| Follows | Functional but product effect undecided | Follow state persists, but the main feed is Tribe-based. Whether follows become an audience/feed primitive is an explicit product decision. |
| Direct messages | Pass | Thread entry/send/reply work; unread state is durable `read_at`, opening a thread marks received messages read, and blocked pairs cannot deliver. |
| Notifications | Pass | Like/comment/follow/message and Venture kinds render; DM opens the sender thread; Venture actions route to Ventures. |
| Ventures — applicant | Pass | Discover in scope, apply, pending state, acceptance, slot update, and accepted-member party chat passed with two accounts. |
| Ventures — host | Pass | Create, applicant review, accept/decline, party chat, close, safety controls, and report/block surfaces exist. Exact-location guidance is restricted to accepted chat. |
| Profile/settings | Pass | Rich-profile editing and signal display, avatar, saved posts, blocked accounts/unblock, push preferences, approximate-location enable/pause/radius/refresh/delete, logout, and delete-account UI are present. |
| Account deletion | Pass | Database/auth deletion and paginated removal of avatars, post images, and Tribe attachments; reports survive with reporter anonymized. |
| Blocking | Pass | Two-way post/comment visibility and DM delivery are enforced through security-definer checks that avoid RLS-filtered subqueries. |
| Reporting | Pass | Post, user, comment, DM, Tribe chat, Venture, applicant, and party-chat entry points write preserved reports. |
| Moderation queue | Pass | Moderator role, queue/status/SLA fields, dismiss/hide/suspend RPC, hidden-content RLS, suspension guard, and immutable audit log passed SQL and browser checks. |
| Text filtering | Baseline pass | Database triggers reject a deliberately narrow set of high-confidence harmful text across all posting and messaging surfaces. This is not a complete moderation classifier. |
| Image safety | **Launch blocker** | MIME/size/storage access are enforced, but no CSAM/NCII/explicit-image classification or hash matching exists. |
| Push notifications | Code complete | Opt-in UI, subscriptions, server dispatch, and production URL/secret lookup exist. Production Vault values, secret rotation, platform delivery, and fan-out load must be verified. |
| Legal/privacy/store metadata | Partial | Privacy data map and MEUTUALS metadata are corrected. A real controller identity/address, working contact inboxes, counsel review, store disclosures, and production URLs remain required. |

## Essential feature coverage

The beta has the expected minimum social-app capabilities:

- identity, verified-adult onboarding, profile, avatar, and account lifecycle;
- community membership and community chat;
- feed publishing, media, replies, reactions, saves, and sharing;
- people discovery, public profiles, follows, and one-to-one messaging;
- notifications with durable unread state;
- real-world event creation, application, host approval, and private group chat;
- user blocking, broad report entry points, text safety rules, and an actionable
  moderator queue with a 24-hour due timestamp and audit trail.

## Confirmed corrections made during this audit

- Replaced browser-local DM unread history with database-backed read receipts.
- Fixed DM notification routing and distinct Venture notification kinds.
- Added the missing shared-post route and post-login return path.
- Added Tribe leaving/management and Venture meet-safely guidance.
- Prevented onboarding push prompts, fixed modal descriptions and relative-time
  copy, and separated Timeline errors from legitimate empty states.
- Added moderator roles, queue, SLA state, actions, hidden/suspended RLS, and
  audit logging.
- Added a database-level baseline harmful-text filter across user-content
  surfaces.
- Added Apple sign-in entry points, browser autocomplete attributes, consistent
  MEUTUALS manifest/push metadata, and an accurate current-service privacy data
  map.

## Remaining launch blockers

1. **Image moderation vendor and incident process.** Add upload-time scanning,
   quarantine, hash matching where legally available, escalation, and appeal.
2. **Trust-and-safety operations.** Name moderators, create a monitored alert
   channel, rehearse the under-24-hour report SLA, and publish an escalation
   runbook. The code queue alone is not a moderation operation.
3. **Legal identity and working contacts.** Supply the controller/company legal
   name, postal address, jurisdictional disclosures/representatives as needed,
   and verified `privacy@`, `appeals@`, and support inboxes; obtain counsel
   review of Privacy, Terms, retention, and store questionnaires.
4. **Production identity and delivery configuration.** Configure and test Apple
   and Google OAuth, email confirmation/recovery, push Vault URL/secret, VAPID,
   and iOS/Android/browser delivery. Rotate the previously exposed production
   push secret.
5. **Store release work.** Finalize listing metadata, screenshots, privacy
   labels/data-safety answers, age rating, reviewer credentials, and deletion
   instructions; then run device builds and store review checks.

## Important post-beta work

- Batch push fan-out and replace the last-500-message inbox reconstruction with
  a paginated/thread-summary query.
- Add feed pagination and bound large ID filters.
- Make Venture slot acceptance fully atomic and replace the
  `profiles.venture_count` read-modify-write update.
- Decide the audience primitive, host program, and launch city before growth
  work. These are product decisions, not hidden engineering assumptions.
