# AGENTS.md — read this before touching the codebase

Conventions and landmines for any AI agent (Claude, Codex, …) working on MEUTUALS.
This file is **stable reference**. For current state and who's doing what, read
`DEVLOG.md`.

**If you change something that contradicts this file, update this file in the
same commit.**

---

## 1. What this app is

MEUTUALS — a social app built around **Tribes** (five interest communities:
wolf / koi / cat / owl / bee), a **Timeline** feed, **Discover**, **Ventures**
(user-organised real-world meetups with an apply → accept → party-chat flow),
and DMs.

**Stack:** TanStack Start (React 19) + TanStack Router (file-based) + TanStack
Query, deployed as a **Cloudflare Worker**. Backend is **Supabase**
(Postgres + Auth + Realtime + Storage). Tailwind v4 + Radix + shadcn/ui.

**Status:** pre-launch. Target is App Store + Play + web, free at launch.
Full audit in `MEUTUALS_PRODUCTION_AUDIT.md` — read it before proposing work.

---

## 2. Landmines — these have already cost real debugging time

### 2.1 RLS: Postgres OR-combines USING and WITH CHECK *separately*

This caused a critical vulnerability (any user could self-accept into any
Venture). If two permissive policies exist for the same command, a row only has
to satisfy **some** `USING` and **some** `WITH CHECK` — not both halves of the
same policy. Attackers mix and match across policies.

**Rule:** for a given table + command, prefer **one** policy. If you need
different rules for different actors, branch inside one policy expression, or
enforce it in a `BEFORE` trigger.

`WITH CHECK` cannot see `OLD`. Any rule about a *transition* (old value → new
value) **must** be a trigger. See
`supabase/migrations/20260820000000_fix_venture_application_self_accept.sql`.

### 2.2 Sub-selects inside an RLS policy are themselves RLS-filtered

A policy doing `select 1 from blocks where blocker_id = <other user>` silently
matches nothing, because the current user can't see those rows. This is why
blocking is currently one-way and broken (see `DEVLOG.md` → Known Issues).

**Rule:** cross-user checks in policies go through a `SECURITY DEFINER STABLE`
helper with `search_path = public` pinned and `EXECUTE` revoked from `anon`.

### 2.3 Realtime bindings MUST carry a `filter:`

`src/lib/realtime-bridge.tsx` previously subscribed every client to every
`likes` / `shares` / `comments` / `posts` / `profiles` change platform-wide.
At ~1k concurrent users that's ~14k messages/sec. All bindings are now
per-user filtered.

**Rule:** never add an unfiltered table binding to the global bridge. If a
component needs live updates for one object, subscribe from that component and
unsubscribe on unmount.

### 2.4 Never copy `package-lock.json` between machines

Doing this once cost ~19 minutes of a hung `npm install` that wrote nothing.
The cloud container and the user's Windows box reconcile `^` ranges at
different times, producing different trees; npm then re-resolves everything.

**Rule:** sync `package.json`, never the lockfile. Let each machine's npm
maintain its own. If a lockfile is truly broken, rebuild it from
`node_modules/.package-lock.json` (npm's record of what's actually installed).

### 2.5 Migrations do not apply themselves

Editing a file in `supabase/migrations/` changes nothing until:

```bash
npx supabase db reset      # replays every migration from scratch
```

`supabase stop` / `start` **preserves the volume**, so a new migration will
*not* run on a plain restart. If a change seems to have no effect, this is
almost always why.

### 2.6 Local Supabase uses a fixed JWT secret

The CLI's local stack signs with the same key across resets, so a
`localStorage` session from *before* a `db reset` still verifies — the app
thinks you're logged in as a user that no longer exists. Symptom: `PGRST116`
"Cannot coerce the result to a single JSON object".

**Fix:** `localStorage.clear()` in devtools, then sign up again.

### 2.7 Counter columns are trigger-maintained

`likes_count`, `replies_count`, `shares_count`, `filled_slots` are maintained
by Postgres triggers. Do not write them from application code — you'll create
drift. (`profiles.venture_count` is the exception and is currently a
read-modify-write race; see Known Issues.)

### 2.8 There is no JS animation library

`motion` was installed and then removed. Animation is CSS only: Radix
`data-[state=open]` / `data-[state=closed]` plus `tw-animate-css` (already
imported in `styles.css`). See `src/components/ui/animated-modal.tsx`.

**Rule:** don't reintroduce framer-motion/motion. The user explicitly asked for
minimal animation.

---

## 3. Code conventions

### Server functions

Every server function lives in `src/lib/*.functions.ts` and **must**:

```ts
export const doThing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])              // ← never omit
  .inputValidator((input: unknown) => schema.parse(input))   // ← zod, bounded
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;          // userId is JWT-verified
    ...
  });
```

- **Never** trust an identity from client input. Derive it from `context.userId`.
- If the client passes an id as a *target*, re-authorize it server-side.
- All 56 existing functions follow this. Keep it at 100%.

### The two Supabase clients

| Import | Respects RLS? | Use for |
|---|---|---|
| `@/integrations/supabase/client` | yes | browser + normal server fns |
| `@/integrations/supabase/client.server` (`supabaseAdmin`) | **no** | server-only, last resort |

`supabaseAdmin` has exactly two legitimate importers today
(`account.functions.ts`, `push.dispatch.ts`). Adding a third needs a strong
reason — it bypasses every RLS protection in the app.

### Client data layer

Server fn → hook in `src/lib/*-store.ts` → component. Mutations use optimistic
updates with `onMutate` snapshot / `onError` rollback / `onSettled` invalidate.
Follow the existing pattern in `posts-store.ts`.

### Feature flags

`MONETIZATION_ENABLED` in `src/lib/feature-flags.ts` is `false`. It gates the
Plus UI **and** now hard-gates four routes (`/tiers`, `/upgrade`, `/host`,
`/host-dashboard`) via `beforeLoad` + `notFound()`. Those routes contain
pricing and fabricated data that would fail App Store review — do not ungate
them without wiring real IAP first.

---

## 4. Environment

**Two separate filesystems. Don't mix them up.**

| | Path | Notes |
|---|---|---|
| Cloud container (Claude) | `/home/claude/projects/mobile-vision-unleashed` | has `.git`, has network |
| User's machine | `D:\Dheoryans\Meutuals\mobile-vision-unleashed` | **no `.git`**, runs the dev server + Docker Supabase |

The user's copy is the one that actually runs. Changes made in the cloud must
be synced to the device to have any effect.

`device_bash` (Claude's bridge to the user's machine) **cannot delete files** —
`rm` fails with "Operation not permitted". Move unwanted files to
`_to_delete/` and tell the user to bin the folder.

### Local setup from scratch

```bash
npm install
npx supabase start          # needs Docker Desktop running
npx supabase db reset       # applies all migrations
npm run dev
```

Studio: http://127.0.0.1:54323 · App: http://localhost:3000

Migration replay from a fresh database used to fail three times. Those fixes
are now **in the repo** (guards in `20260517012906`, `20260517013816`,
`20260517014151`, plus `20260811000000_local_dev_base_grants.sql`). If you hit
a replay failure, fix it *in the migration file* and note it in `DEVLOG.md` —
don't patch only your local copy, which is how the repo drifted before.

### Verification before any commit

```bash
npx tsc --noEmit      # must be clean
npm run build         # must exit 0
```

---

## 5. Multi-agent protocol

More than one agent may be working here. To avoid collisions:

1. **Read `DEVLOG.md` first.** It has current state, an in-flight claims table,
   and known issues.
2. **Claim before you start.** Add a row to the "In flight" table in
   `DEVLOG.md` with your agent name, the area, and the files you expect to
   touch. Commit that claim before doing the work.
3. **Stay in your lane.** If a file is claimed by another agent, don't edit it —
   note what you need in "Cross-agent notes" instead.
4. **Log when you finish.** Append a dated entry to the Work Log with what
   changed, why, and anything the other agent must know. Release your claim.
5. **Never rewrite history** (`rebase`, `commit --amend`, force-push) — the
   other agent may have already built on it.
6. **Don't re-litigate settled decisions.** See the "Decided" section in
   `DEVLOG.md`. If you disagree, raise it with the user; don't just change it.
7. **Ask the user before pushing to the remote.** Both agents should treat
   `git push` as user-authorised only.
