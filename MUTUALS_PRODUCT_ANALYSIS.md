# MUTUALS ("Moots") — End-to-End Product & Codebase Analysis

_Generated from a full read of the codebase at `dheoryan/mobile-vision-unleashed` — TanStack Start (React 19) + Supabase (Postgres/Auth/Realtime/Storage), deployed as a Cloudflare Worker. Originally built with Lovable.dev._

## 1. What the product is

MUTUALS is a mobile-first social app organized around interest-based communities ("Tribes") rather than a flat friend graph, with a real-world meetup layer ("Ventures") on top. A user picks one home Tribe (of five fixed ones: Wolf, Koi, Cat, Owl, Bee), gets a scoped group chat and feed for it, can also post to a global "For You" timeline, browse/search everyone on the platform in Discover, and host or join small IRL meetups through Ventures. DMs, notifications, and web push tie it together.

The five core tabs: **Tribe** (home community + chat), **Timeline** (Tribe feed / For You feed), **Discover** (directory + search + tribe previews), **Ventures** (host or apply to meetups), **Profile** (self profile, posts, settings).

## 2. Auth & onboarding

Sign-in is email+password (Supabase Auth) or Google OAuth via a Lovable Cloud wrapper that does the OAuth handshake externally and hands Supabase a session. Password reset uses Supabase's standard magic-link flow. On signup, a database trigger (`handle_new_user`) immediately creates an empty stub row in `profiles` — the app doesn't create that row itself.

The single `/` route checks whether the profile has a `display_name` and one `tribe_ids` entry; if not, it renders onboarding instead of the app shell. Age is gated at 18+ through an immutable submitted date of birth, server-derived verification, restrictive RLS, and write triggers.

Every server-side call re-verifies identity independently: server functions run through `requireSupabaseAuth`, which validates the bearer JWT and hands back a Postgres client scoped to that user's own Row Level Security policies — so even a bypassed client-side check still can't read or write data the database itself wouldn't allow.

## 3. Tribes

`profiles.tribe_ids` (a text array) is the source of truth for membership; a DB trigger keeps a separate `tribe_members` join table in sync with it (that table is what Row Level Security actually checks for chat/attachment access), posts an automatic "X joined Tribe" system message, and fans out join notifications to existing members. A user can belong to up to 3 tribes — this cap is enforced by a Postgres trigger (`enforce_tribe_limit`), not just the UI.

Tribe chat is its own realtime table (`tribe_messages`, distinct from the DM `messages` table) supporting text, one image attachment via signed URLs, swipe/long-press reply threading, @mention autocomplete, and a live "N online" presence count per tribe via a Supabase Realtime presence channel.

## 4. Timeline & posts

Two feeds: "Tribe" (scoped to your active tribe) and "For You" (everything you're allowed to see). The audience of a new post — `tribe` or `all` — is decided by _which feed you tapped the compose button from_, not chosen inside the composer itself. Likes/comments/shares counts are recomputed via `count(*)` triggers rather than incremented/decremented, so they can't drift. Comments support one level of threading (a reply-to-a-reply gets flattened onto the root comment, Instagram-style) with @mentions and deep-link-to-comment support from notifications.

## 5. Discover

A server-paginated (20/page), searchable directory of every registered user (excluding yourself and anyone blocked), plus a horizontally scrolling "Explore Tribes" strip. Nothing here implements the "priority visibility" or "stealth mode" features advertised on the pricing page — see §8.

## 6. Ventures (IRL meetups)

This is the most complex screen in the app. A host creates a Venture with a title, 1–5 "intents" (from a fixed list), a scope (`mine` = visible only to people who share a tribe with the host, `all` = visible to everyone), a free-text time window, and a slot count (2–20, host counts as slot 1). Other users either apply to open ones (host accepts/declines, capacity re-checked server-side at accept time) or get personally invited — but invites can only go to people already in the host's follow graph, not arbitrary strangers. Slot counts and status (`open`→`full`→`closed`) are kept in sync automatically by a database trigger on every application insert/update/delete, so the app layer never has to manage that bookkeeping directly. Accepted members plus the host get a group "party chat," which shows up in the same Messages panel as DMs.

**Worth knowing before touching this screen**: there are two separate, inconsistent server-side implementations of Ventures in the codebase. `ventures.functions.ts` is the current, fully-wired one described above. But `posts.functions.ts` still exports an older, simpler set (`listMyVentures`/`launchVenture`/`endVenture`) that writes to the _same_ `ventures` table with a different shape, and it's still what powers the "Ventures" tab on your own Profile page. These should be reconciled before building new Ventures features, or you'll be maintaining two code paths against one table.

## 7. Messaging & notifications

DMs and Venture party chats are unified in one Messages panel but come from different tables and different sync strategies: DMs are polled every 8–15 seconds (no live subscription in that component), while unread state for DMs is tracked entirely in the browser's `localStorage` — there's no `read_at` column in the database, so unread counts don't sync across devices and reset if the user clears site data.

Notifications are entirely trigger-driven: there is no app code anywhere that inserts a row into `notifications` directly. Every like, comment, follow, message, tribe join, and venture event triggers a Postgres function that writes the notification, and a separate `AFTER INSERT` trigger on that table fires the push dispatch (see §9). This means the notification system is fully server-authoritative — a client bug can't fail to notify someone or spam duplicate notifications.

## 8. Monetization — marketing vs. what's actually built

This needs real attention before you build anything monetization-related, because the pricing pages don't reflect the code at all:

- `/tiers` advertises three tiers (Explorer free / Venturer $9.99 / Scene Maker $24.99). `/upgrade` separately advertises a _different_ single tier, "MUTUALS+," at $6.99/mo or $49.99/yr. Neither matches the database, which only has a binary `profiles.plan` (`free` / `plus`).
- The only two things ever actually gated by plan in code: Tribe count (a DB trigger, currently flattened to allow 3 tribes for everyone — see below) and the Ventures-hosting cap (a client-only check, never enforced server-side).
- Every other advertised perk — priority match visibility, venture analytics, stealth mode in Discover, read receipts, recurring weekly windows, private sub-tribes, pinned event cards, priority Discover placement — has **zero implementation** anywhere. It's marketing copy with no backing field, query, or gate.
- A feature flag, `MONETIZATION_ENABLED = false` (`src/lib/feature-flags.ts`), currently disables all plan gating app-wide — every user effectively gets Plus behavior for free right now, with Plus badges hidden.
- Even if that flag were flipped back on, there's no real payment processor wired up. The `/upgrade` button has no click handler at all (literally does nothing). The in-app "Pay" flow in `UpsellModal` is a hardcoded 1.2-second fake-processing animation with a pre-filled test card number and copy that says "No real charges in this demo" — and because of a defense-in-depth database trigger (`prevent_plan_self_change`, which blocks any authenticated user from changing their own `plan`, by design), that fake flow can't even fake its way into actually setting the database field. It reverts to `free` on next reload. **Real billing needs a payment processor plus a webhook that flips `plan` via the trusted service-role client** — there's no shortcut here.

## 9. Host program (`/host`, `/host-dashboard`)

Entirely a UI stub today. The "Apply to host a Tribe" form doesn't call any server function or write to any table — submitting it just shows a static "we'll be in touch" confirmation locally. `/host-dashboard` (not linked from anywhere in the live app) is 100% mock data: hardcoded member counts, an invented growth chart, and buttons that only touch local component state. There's no `host_applications` table, no `verified`/`hosted_by` columns on tribes or profiles — the one "hosted" tribe (Bee/Honeybee) is just a hardcoded flag in a client-side data file, not a real feature.

## 10. Push notifications

The subscribe flow is standard Web Push (service worker + VAPID key, subscription saved server-side keyed by endpoint). Dispatch, though, is entirely database-driven: any insert into `notifications` fires a trigger that calls an internal API route (`/api/public/push/dispatch`) with a shared secret, which loads the recipient's subscriptions and sends via Web Push, pruning any that come back expired. The app itself never explicitly "sends a push" — it all traces back to the same DB triggers that create notifications.

**One real security issue here**: the shared secret used to authorize that dispatch call was committed in plaintext directly into a migration file — and when it was later "rotated" into Supabase Vault for safekeeping, the _new_ secret value was also hardcoded in plaintext in the migration that seeds the Vault. Both the old and current values are sitting in git history in cleartext. This should be rotated through a real out-of-band secret (generated fresh, injected via Supabase's secrets tooling, never committed) before this matters for anything beyond a dev sandbox.

## 11. Other known gaps worth knowing before you start building

- **Delete Account doesn't delete anything.** It signs the user out and shows a success toast — no data is actually removed. If this ever needs to be real (App Store/Play Store account-deletion requirements are relevant here), it needs an actual server-side deletion flow.
- **The Blocked Accounts list in Settings is broken** — it tries to resolve blocked user IDs against old placeholder demo data instead of real profiles, so it renders empty even when real blocks exist. The underlying block relationship itself works fine (enforced by RLS); it's just the settings UI that's wrong.
- **Leftover demo/seed data is still partially live** in `src/lib/mutuals-data.ts` — mostly dead now, but still used for the "sample posts" placeholder shown on a brand-new profile with zero real posts, and fully powers the fake `/host-dashboard`.
- **Tribe member counts are a mix of real and fake numbers** depending on load timing — falls back to hardcoded numbers (e.g. "12,480 members") if the real count hasn't loaded yet.
- **Branding is inconsistent** between "MUTUALS" (package name, database, pricing copy) and "Moots" (page title, some UI copy) — worth deciding on one before it ships more broadly.

## 12. Suggested priority order if this is about to go into active development

1. Decide product name (Mutuals vs. Moots) and fix the pricing page mismatch (`/tiers` vs `/upgrade` disagree with each other and with the code).
2. Rotate the leaked push-dispatch secret.
3. Reconcile the two Ventures implementations before extending that feature.
4. Fix or remove the broken Blocked Accounts UI and the non-functional Delete Account flow — both are real user-facing trust issues, not just cosmetic bugs.
5. If monetization matters soon: real payment processor + webhook is a from-scratch build, not a flag flip. Budget for it accordingly.
