# MEUTUALS — Production Readiness Audit

**Date:** 20 August 2026
**Scope:** security, legal & app-store compliance, scale, product architecture
**Target:** App Store + Google Play + web, free at launch

---

## Verdict

This is a **real product, not a shell.** The backend is genuinely well built — RLS on every table, server-authoritative invariants enforced by Postgres triggers, a complete Ventures lifecycle, correctly batched queries. That is better engineering than most seed-stage apps carry into launch.

Two things stand between it and the store, and they are different in kind:

1. **A set of concrete blockers** — one exploitable security hole, six store-rejection triggers, and five scale defects that break the app somewhere between 200 and 1,000 concurrent users. All are fixable in roughly three weeks.

2. **One structural decision that has never been made** — the app has two competing answers to "who sees this?" and the feed derives from neither. This is why the product currently has no answer to *"why would the second user stay?"*, and no amount of blocker-fixing addresses it.

Fix the blockers and you can ship. Make the structural decision and you have a product that isn't just another social app.

---

# Part 1 — The structural decision

## The diagnosis

Every social product answers one question before a user will post: *who sees this, and what will they think of me?* When the answer is clear, people post. When it changes between surfaces with no cue, people hesitate and stop.

MEUTUALS currently ships **two competing primitives**:

| Primitive | Where it appears | Status |
|---|---|---|
| **Space-first** (the container is the audience) | Tribes: join to enter, chat is membership-gated in the DB, posts carry `audience: 'tribe'` | Real, enforced in Postgres |
| **Graph-first** (you pick who sees it) | Follows: Discover puts a Follow button on every row; follows drive notifications and Venture invite eligibility | Real in the DB, **invisible to the user** |

And the feed — the surface that should resolve the question — derives from **neither**:

- `listFeed` (`src/lib/posts.functions.ts:80-100`) has **no join on `follows` at all.** Following someone does not add their posts to your feed. Unfollowing does not remove them. The most-emphasised action in Discover has no visible consequence whatsoever.
- The Tribe tab filter is `tribe_id = X OR audience = 'all'` (`posts.functions.ts:95`), then takes the newest 200 globally. Once broadcast posts outpace a small tribe, **the Iron Wolf tab contains zero Iron Wolf posts** while the header says "Posts from Iron Wolf."

So the space primitive leaks and the graph primitive is inert. A user cannot learn the rule, because there isn't one.

This is context collapse produced by architecture rather than by the social graph — the self-inflicted version of the hardest problem in the field.

## The recommendation: commit to space-first

Tribes should be the audience primitive, and everything should derive from them.

**Why this specifically, for this app:**

**It matches why someone opens it.** Nobody downloads MEUTUALS to keep up with specific people — they have Instagram for that. They open it for a scene and for something to do this weekend. That routes to space-first.

**It fixes cold start by an order of magnitude.** The arithmetic is unforgiving:

| Structure | Density needed to feel alive |
|---|---|
| Follow-graph feed | ~100–200 follows *per user* |
| Bounded community | ~20–30 active members *total* |

You currently need the first number and have built for neither. Space-first means seeding **one tribe in one city with 25 real people** instead of engineering hundreds of follow relationships per user.

**It keeps chronological ranking viable.** Bounded containers cap volume naturally, so you don't need a ranking algorithm — and you don't inherit the permanent political problem that comes with owning one.

**It gives moderation a jurisdiction.** Which solves your single hardest store blocker. See below.

**It makes Ventures make sense.** A Venture is a space-scoped event — the trust context is "we're both in Iron Wolf," not "I follow her." That is also the honest safety story for meeting a stranger.

## What this means concretely

- **Feed = activity across tribes you've joined.** Tribe tab shows that tribe, strictly. Add a "For You" tab that is explicitly cross-tribe discovery, labelled as such.
- **Demote follows to a bookmark.** Keep the table — it usefully drives Venture invite eligibility. Remove the Follow button's primacy in Discover, or relabel it. Do not ship an action whose only effect is invisible.
- **Make tribe membership the growth mechanic.** Joining is the unit of onboarding, not following.
- **Ventures inherit tribe scope,** which the code already half-does in application logic (`ventures.functions.ts:313-319`) but not in RLS (see S5).

## The differentiator, stated plainly

**Ventures is the product.** It is the best-engineered thing in the codebase — two application paths, capacity re-verified under concurrency, follow-graph-gated invites, RLS-gated party chat, automatic status transitions. Nothing else in the consumer social space does bounded, interest-scoped, real-world meetup coordination well.

Everything that makes MEUTUALS feel like a generic social app — the global follow graph, the chronological broadcast feed, the like counts — is borrowed from a product category you are not competing in, and is the part that is currently broken.

**The strategic move is to make Tribes the room and Ventures the reason to be in it, and let the feed be a thin layer of ambient context between them.** Not a feed with meetups bolted on.

## The host program is the missing keystone

`/host` and `/host-dashboard` are currently facades — the application form calls `setSubmitted(true)` and writes nothing (`src/routes/host.tsx:22-25`), while a fully fabricated analytics dashboard sits on a live public route.

But the *concept* is the answer to three separate problems at once:

- **Your moderation blocker.** Tribe hosts are the natural moderation owner, with a real jurisdiction. Delegated moderation is very hard to retrofit onto a centrally-moderated product — decide now.
- **Your cold start.** Hosts recruit and seed their own community. That is the campus-by-campus playbook.
- **Your revenue story.** $199–$499/month from venues and organisers is a far better business than $6.99 consumer subscriptions, and it doesn't require App Store IAP.

Right now it's the most valuable idea in the product and the only one that's pure facade.

---

# Part 2 — Launch blockers

Nothing ships until these are done.

## Security

### 🔴 S1 — CRITICAL: any user can self-accept into any Venture and read its private party chat

`supabase/migrations/20260516123000_open_party_ventures.sql:181-189`

```sql
create policy "Applicants cancel own applications"
  using (applicant_id = auth.uid())
  with check (applicant_id = auth.uid() and status = 'cancelled');

create policy "Applicants respond to own venture invites"
  using (applicant_id = auth.uid() and status = 'invited')
  with check (applicant_id = auth.uid() and status in ('accepted', 'declined'));
```

Postgres OR-combines permissive policies **separately for `USING` and for `WITH CHECK`**. A row only has to satisfy *some* `USING` and *some* `WITH CHECK` — not both from the same policy.

**Exploit:** attacker applies to any open Venture (status `pending`), then sends `PATCH /rest/v1/venture_applications?id=eq.<own row>` with `{"status":"accepted"}` using the anon key from the JS bundle plus their own JWT. `USING` passes via policy 1, `WITH CHECK` passes via policy 2. They are now a member: they can read and write the **host's private party chat**, see the meetup location, and consume a slot — with no host approval. The immutable-field trigger doesn't stop it (it only freezes `id`/`venture_id`/`applicant_id`).

For an app coordinating real-world meetings between strangers, an uninvited party gaining the location and the chat is the worst-case failure.

**Fix:** merge into one policy, or enforce legal `old.status → new.status` transitions in a `BEFORE UPDATE` trigger (needed because `WITH CHECK` cannot see `OLD`).

### 🔴 S2 — HIGH: blocking is one-way and silently does nothing

`20260514051017_0c8e196e...sql:4-24` replaced a `SECURITY DEFINER` helper with an inline sub-select and dropped the helper. Sub-selects inside an RLS policy are **themselves RLS-filtered**, so the "did *they* block *me*" branch reads rows with `blocker_id <> auth.uid()` — which are invisible and can never match.

The same broken pattern is in the current posts policy, comments policy, and the DM insert policy (`20260514055630...sql:21-30`). Application code doesn't compensate: every consumer loads only *my* blocks.

**Impact:** B blocks their harasser A. A keeps sending DMs — they deliver, with push. A keeps seeing B's posts and comments and keeps finding B in Discover. **The core safety feature does nothing in the direction that matters.** This is also a store-review issue (Apple 1.2 requires working blocking).

**Fix:** reinstate `public.has_blocked(_a, _b)` as `SECURITY DEFINER STABLE`, `search_path = public`, `EXECUTE` granted to `authenticated` only; use it in the posts/comments/messages policies.

### 🟠 S3 — HIGH: every post image is listable and downloadable by anyone, logged in or not

`20260517013816...sql:56-60` creates a `SELECT` policy on `storage.objects` for `bucket_id = 'post-images'` **with no `TO` clause** — so it applies to `PUBLIC`, including `anon`.

Anyone takes the publishable key out of the JS bundle, lists the bucket, and downloads everything — including images on `audience: 'tribe'` posts that RLS deliberately restricts to members, with the author's user id in the path.

**Fix:** restrict listing to `TO authenticated` scoped to `(storage.foldername(name))[1] = auth.uid()::text`; make the bucket private and serve signed URLs if tribe-only images must stay private.

### 🟠 S4 — MEDIUM: a DM recipient can delete the sender's messages

`20260514055630...sql:32-34` allows `DELETE` where `auth.uid() = sender_id OR auth.uid() = recipient_id`. A harasser can destroy the evidence of their own abuse from the victim's account. **Fix:** narrow to `sender_id`; implement "delete for me" as a per-user hide flag.

### 🟠 S5 — MEDIUM: tribe-only Ventures are readable by every signed-in user

`20260516123000...sql:127-133` permits reading any `status = 'open'` venture. The scope restriction exists only in application code. Any user can query PostgREST directly and read every host's title, note, time window and intents — including meetup plans marked tribe-only. **Fix:** push the tribe-overlap rule into the policy.

### 🟠 S6 — MEDIUM: `tribe-chat-attachments` is a public bucket the code treats as private

`20260517133500...sql:268-279` sets `public = true`; `src/lib/uploads.ts:30-31` mints 1-hour signed URLs on the assumption it's private. The public flag defeats the signing — anyone with a path has permanent unauthenticated access, including after leaving the tribe.

### 🟡 S7 — Push secret rotation is not complete on production

The new migration is correctly designed (generates into Vault at apply time, nothing in git). But it only affects the project it's applied to, and the old plaintext `9f570ac6…` is still live on production and still in git history. Impact is low — it triggers a push to the notification's own owner and returns only a count — but close it.

## Legal & App Store

### 🔴 L1 — Reports go into a table no human can read

`src/lib/social.functions.ts:249-270` inserts a row. That is the entire system. The table has no `status`, no `assigned_to`, no `resolved_at`. There is no moderator role anywhere in the codebase, no admin route, no trigger, no webhook, no email. Meanwhile `SafetyMenu.tsx:114` tells the user *"We'll review it shortly"* and `:129` *"Reports are reviewed by the MEUTUALS team."* Both are currently false.

Apple Guideline 1.2 requires acting on reports **within 24 hours**. Google's UGC policy requires a moderation system. A reviewer's standard probe is "what happens after I tap Submit?"

**This is the long pole. Start it first.** Minimum: add `status`/`reviewed_by`/`reviewed_at`/`action` to `reports`, a moderator flag with an RLS policy, a `/admin/reports` queue with hide-post / suspend-user / dismiss, and an insert trigger that pings a monitored channel. **3–5 days.**

Note this is where Part 1 pays off: under space-first, tribe hosts are the natural first-line moderators.

### 🔴 L2 — No content filtering of any kind

No profanity list, no blocklist, no classifier anywhere. Post/comment/DM validation is length-only. Image uploads check MIME and size, then write straight into a **public** bucket. Apple 1.2 requires "a method for filtering objectionable material from being posted." The first CSAM or NCII upload sits on a public CDN URL. **3–5 days.**

### 🔴 L3 — Report and Block exist on exactly one surface

`SafetyMenu` is imported in one file — `PostCard.tsx`. It is absent from DMs, comments, tribe chat, Venture cards, applicant lists, party chat, and user profiles. Reviewers test the DM surface specifically, because DM harassment is the canonical case. A user harassed in DMs must go find one of that person's feed posts; if the harasser has never posted, **there is no path at all.**

The component already handles everything and `reportContent` already accepts `target_kind: 'comment'`. **1–2 days of plumbing.**

### 🔴 L4 — A credit-card checkout for a digital subscription is reachable today

Profile → "Compare tiers" → `/tiers` showing $9.99 and $24.99 plans. `/upgrade` mounts `UpsellModal` at the checkout step with live card/expiry/CVC inputs prefilled `4242 4242 4242 4242` and a **"Pay $6.99"** button that sleeps 1,200 ms and toasts success.

`MONETIZATION_ENABLED = false` correctly hides badges and paywall triggers, but the `/tiers` link at `ProfileScreen.tsx:172` sits **outside** the gate, and neither route checks the flag.

Apple 3.1.1 — digital subscriptions must use IAP; a card form is an automatic rejection. Apple 2.3.1 and Google both bar simulated functionality. The "mock checkout" disclaimers do not cure it. Also an FTC §5 exposure, and it conditions users to type card numbers into a form with no PCI handling.

**Cheapest blocker to clear — hours.** Delete the link, add `beforeLoad` guards to `/tiers`, `/upgrade`, `/host`, delete the checkout step.

### 🔴 L5 — The privacy policy describes a different application

`src/routes/privacy.tsx` names **Vercel/Netlify** (actual host: Cloudflare Workers), **Stripe** (no payments exist), **PostHog** (not present), and **Sentry** with "anonymised crash reports" (`error-capture.ts` is a 27-line in-memory buffer that transmits nothing). It omits Cloudflare, Supabase, Google OAuth, the push subscription payload, and publicly-readable image storage. It promises data portability by email with no export function behind it.

Both stores read this URL, and you cannot truthfully complete either privacy questionnaire from it. GDPR Art. 13/14 accuracy failure. Also missing: legal basis, retention, controller's legal entity and postal address, EU/UK representative, transfer mechanism, CCPA disclosures. The authors left `// TODO: legal review before launch` markers at `privacy.tsx:17` and `terms.tsx:17`.

### 🔴 L6 — Account deletion leaves every uploaded photo public forever

`account.functions.ts` deletes rows correctly — I traced every table, and row-level deletion is sound. But it **never touches Storage.** No `.remove()` call exists anywhere in the repo. After "permanently delete," the user's avatar and every photo they posted remain fetchable at their original public URLs indefinitely. Apple 5.1.1(v) requires deleting the account *and associated data*; GDPR Art. 17 covers the images. Reviewers test exactly this.

Two related defects: `reports.reporter_id` cascades on delete, so a victim deleting their account **destroys the reports they filed**; and reports *about* a deleted user keep a dangling `target_id`. **Half a day.**

### 🔴 L7 — Age gating is a client-side number field

Signup collects no age at all. Onboarding has `<Field label="Age" type="number" />` validated by `Number(age) >= 21` in the browser, with the threshold displayed in the error message. The DB column is nullable and the auto-created profile never sets it — nothing stops a null-age account from posting, DMing, or joining a Venture.

This app has DMs between strangers and **in-person meetups**. That profile is exactly what Apple 1.1.4/5.1.4, Google's Families policy, and the UK Age Appropriate Design Code target. A typed number is not reasonable age assurance. It is also the largest civil-liability event available to the product.

**Fix:** neutral date-of-birth screen *before* account creation, persisted server-side, hard-fail with a cooldown so retry-with-a-different-number doesn't work. Make `age` NOT NULL and gate DM/Venture server functions on it.

### 🟠 L8 — Ventures coordinate stranger meetups with zero safety layer

The intro is three steps about how to use the feature, with no safety guidance. The host note placeholder — *"Where to meet, vibe, or a tiny bit of context"* — actively solicits a meeting location into free text shown to all viewers, with no warning. No report/block on venture cards, applicants, or party chat. `listVentureMatches` does not filter blocked users. No check-in, no post-meetup reporting.

### 🟠 L9 — Placeholder contact addresses and missing Sign in with Apple

`privacy@mutuals.app`, `hello@mutuals.app`, `appeals@mutuals.app` are all marked TODO in comments. Apple 1.2 requires published, working contact info — and your 24-hour SLA has no intake channel without it. Separately, Google OAuth ships without Sign in with Apple; the Lovable wrapper already accepts `"apple"`, so this is one provider string and one button. Email+password is often accepted as the alternative, but losing a review cycle over "probably" is bad economics.

Also: manifest says `MUTUALS`, root title says `Meutuals`, legal pages say `MEUTUALS` — Apple 2.3 metadata consistency.

---

# Part 3 — Scale

The app melts at **a few hundred concurrent users**, not ten thousand. Items 1–3 are about a day of work and are the difference between surviving launch and not.

### 🔴 P1 — Every client is subscribed to every like, comment, share and profile update platform-wide

`src/lib/realtime-bridge.tsx:115-222` binds `postgres_changes` on `likes`, `shares`, `comments`, `posts` and `profiles` with **no `filter:`**. Because counter triggers also update the post row, one like produces **two** global broadcast events, each invalidating `["posts"]` — and TimelineScreen mounts two feed queries.

At 1,000 concurrent users producing ~7 writes/sec: ~14,000 outbound realtime messages/sec and ~5,000 `listFeed` executions/sec. This is the single largest win — delete the four unfiltered bindings. The surgical `patchPostCount` right above them is already written and is made pointless by the `invalidateQueries` call.

### 🔴 P2 — All five screens mount at once: 21 requests per page load

`routes/index.tsx:229-233` uses `hidden` (CSS only), so every tab's hooks run. Cold load = **17 server-function calls + 4 direct PostgREST calls, ~40 Postgres queries, 17 separate JWT verifications.** `refetchOnWindowFocus` is on by default, so every tab focus replays all 21.

**Fix:** render only `screens[tab]`; set `refetchOnWindowFocus: false` and `retry: 1` on the QueryClient.

### 🔴 P3 — Chats freeze permanently at 100 / 500 messages

Tribe chat, DMs, comments and party chat all use `.order("created_at", { ascending: true }).limit(N)` — the **oldest** N rows. Live messages still arrive via realtime so it looks fine, until reload throws the user back to the first 100 messages ever sent, with everything after invisible. A tribe with five active members hits this **on day one.**

**Fix:** order descending, limit 50, reverse client-side, paginate backwards with a keyset cursor.

### 🔴 P4 — Counter triggers do a full recount per like

`20260514063844...sql:12-18` runs `set likes_count = (select count(*) ...)` on every like — replacing an earlier O(1) increment. A post reaching 10,000 likes performs ~50 million tuple reads instead of 10,000, and every trigger takes a row lock on the same post, so concurrent likes **serialise**. This is the classic viral-post death. Revert to incremental with a nightly reconciliation.

### 🔴 P5 — Push fan-out is one Worker invocation per recipient

The dispatch trigger is `for each row`. An author with 5,000 followers posting once produces 5,000 notification rows → 5,000 `net.http_post` calls → 5,000 Worker invocations → 20,000+ Supabase queries **from one button press.** `pg_net`'s worker is single-threaded and the trigger swallows errors, so the backlog is invisible. Batch the dispatch and cap `new_post` fan-out.

**Related and urgent:** the dispatch URL is hardcoded to `https://project--5e588783-...lovable.app/...` (`20260517012906:22`). **Push will silently not work in production** — the trigger's `exception when others then return new` hides the failure.

### 🟠 P6 — Missing indexes

Highest damage first — `follows.followee_id` (unindexed; seq-scans the whole table on **every post created**), `likes.user_id`, `shares.post_id`, a GIN index on `profiles.tribe_ids` (every tribe member count does a full scan), `profiles.created_at`, composite `posts(tribe_id, created_at desc)`, `blocks.blocked_id`, and pg_trgm indexes for the ILIKE search that currently seq-scans on every keystroke. The first three are also unindexed FK cascade targets, so account deletion seq-scans them.

### 🟠 P7 — Other

- **Inbox rebuilt from the last 500 raw messages** — a user with one chatty thread sees exactly one conversation; unread counts every inbound message ever (badge of 31 for one new reply); polled every 15s by every user forever, on top of realtime.
- **No feed pagination** — newest 200 site-wide, no "load more."
- **Unbounded `.in()` lists** → HTTP 414 on real accounts (50 ventures × 200 applicants ≈ 370 KB URL).
- **Full-resolution avatars** — `compressImage` exists but is called from one place; the signup path uploads raw 5 MB files rendered at 40×40, with a 1-hour cache. A 200-post feed can be ~150 MB of image transfer.
- **Failed queries render "No posts yet"** — an outage is indistinguishable from an empty database, for users and for you. ProfileScreen substitutes **fake sample posts** on failure.

---

# Part 4 — Cold start

On launch day the database contains five tribe names and nothing else. There is no seed script, no `supabase/seed.sql`, no admin content path, no scheduled job. The host program — the one designed mechanism for getting curated communities in — writes nothing.

What a new user actually experiences today:

| Moment | Reality |
|---|---|
| Signup | Confirmation-email dead end. A toast, then nothing. Highest-drop-off moment in any app, zero handholding. |
| Tribe tab (default landing) | Banner reads **"12,480 members"**, then snaps to **"1 members · 0 online."** Reads as bait-and-switch. |
| Discover | Five tribe cards all reading **"0 registered members."** The surface framed as "find your people" confirms there are none. |
| Follow | The one action the app pushes. Produces a checkmark and nothing else. No reason to do it twice. |
| Ventures | Can host one, but own ventures are excluded from the board, so it stays empty. |
| Own profile | **Three fabricated posts they never wrote** (`ProfileScreen.tsx:50-53`). The moment a careful user concludes the app is faking it. |

Empty states are otherwise genuinely good — no blank screens, and the Ventures three-stage intro is well designed.

**The plan:**

1. **Delete the fake data.** Sample posts on Profile, hardcoded member counts, `/host-dashboard`. One-line fixes that remove the credibility bugs.
2. **Concentrate.** One city, one or two tribes. Five populated spaces beat fifty empty ones; empty containers actively signal a dead product. You need ~25 active people in *one* tribe, not hundreds of follows each.
3. **Recruit the first hundred by hand.** It doesn't scale and doesn't need to — it sets norms the next hundred thousand inherit.
4. **Guarantee the first response.** A first post with no reply is a lost user. Route new posts to people likely to reply; have the team answer if necessary.
5. **Add an onboarding step that ends in a populated room**, not an empty feed.
6. **Build the host program for real** — it is your seeding engine, your moderation layer, and your revenue.
7. **Fix the share link.** `PostCard.tsx:69` copies `https://mutuals.app/p/${post.id}` and **there is no `/p/` route.** Every share produces a dead URL — and sharing is your only organic acquisition channel.

**Pick a metric that only moves when something good happens.** DAU and session length rise both when a product becomes valuable and when it becomes compulsive; the dashboard can't tell them apart. Best single candidate here: **proportion of posts receiving a human response.** Runner-up: week-4 retention of users who posted at least once.

---

# Part 5 — Sequenced plan

**Week 1 — stop the bleeding**
- S1 venture RLS hole *(hours — do today)*
- L4 remove the fake checkout and gate the routes *(hours)*
- P1 delete unfiltered realtime bindings *(hours)*
- P2 render only the active tab *(hours)*
- P6 index migration, `concurrently`, no downtime *(hours)*
- Push dispatch URL, or push is dead in production *(minutes)*
- Delete fake data: sample posts, `/host-dashboard`, hardcoded counts *(hours)*
- **Start L1 moderation queue in parallel — it's the long pole**

**Week 2 — safety and correctness**
- S2 fix blocking *(this is a safety feature that currently does nothing)*
- S3 storage policies, S4 DM deletes, S5 venture scope, S6 bucket privacy
- L3 SafetyMenu on every surface
- L6 storage cleanup on delete + reports FK
- L7 real age gate
- P3 chat pagination, P4 counter triggers

**Week 3 — compliance and launch prep**
- L1 moderation queue finished, with the 24h SLA actually running
- L2 content filtering
- L5 privacy policy rewritten from the real data map, with counsel
- L8 Venture safety layer
- L9 real inboxes, Sign in with Apple, metadata consistency
- P5 push batching, P7 the rest

**Then, and only then, submit.** Do not submit before L1, L2, L3, L4, L6 and L7 are done — and L5 and L9 must be *true statements* on submission day, because both stores read those URLs.

**In parallel, on a separate track:** the Part 1 decision. Commit to space-first, make the feed derive from tribes, demote follows, build the host program. That work doesn't block the store submission, but it is the difference between launching an app and launching a product people come back to.

---

# What's already strong

Worth stating plainly, because it's a lot:

- **Security architecture is the best part of this codebase.** RLS on every table. Audience visibility enforced in Postgres, not the app. `SECURITY DEFINER` helpers with `search_path` pinned and `EXECUTE` revoked from `anon`. A trigger blocking users from changing their own `plan` even though the client tries. A trigger blocking hosts from mutating application identity columns. Timing-safe secret comparison. Several are defence-in-depth against attacks the current UI can't even mount.
- **Server-authoritative invariants throughout.** Slot counts, venture status transitions, tribe membership sync, all notification fan-out, and every post counter are Postgres triggers. The client cannot corrupt them and there is no dual-write drift.
- **Queries are correctly batched.** `attachAuthors` collects a unique id set and issues one `.in()` — a 50-post feed is 2 queries, not 51. Same pattern in five other places. The obvious N+1 traps are all avoided.
- **Ventures is a complete, non-trivial, well-reasoned feature** — and it's your differentiator.
- **All 56 server functions apply the auth middleware.** Zero exceptions. None trusts a client-supplied identity.
- **Service-role usage is minimal and justified** — two importers, every query scoped to the verified session.
- **Optimistic mutations with proper snapshot/rollback** throughout.
- **Account deletion** is correct at the row level, and its doc comment shows real understanding of which FKs cascade.
- **`MONETIZATION_ENABLED` is a clean kill switch** — L4 isn't a design failure, just two unguarded routes and one escaped link.
- **Real empty states on five of six tabs.**

The engineering is not the problem. The product decision is.
