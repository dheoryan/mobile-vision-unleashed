# Change protocol

How a change reaches MEUTUALS production without breaking it.

This is the permanent document. The one-time list of things standing between
here and public launch is `LAUNCH_CHECKLIST.md`.

---

## The one principle

**Additive changes fail loudly. Access changes fail silently.**

A missing column throws an error you see immediately. A wrong RLS policy
returns *zero rows* — which looks exactly like "no data yet". Every serious bug
this codebase has had was invisible:

| Bug | What it looked like |
|---|---|
| Applicants could self-accept into any Venture | Nothing. It just worked, for the attacker. |
| Blocking was one-way | The blocked person kept seeing everything. |
| Capacity clamp hid over-subscription | Venture read "Full" with 6 people in 4 seats. |
| Adult gate on a populated DB | App renders empty. No error anywhere. |

Everything below follows from that asymmetry. Loud changes get a fast path.
Silent ones get a human.

---

## Who may change what

Three agents write this codebase — Claude (this session), Lovable, and Codex.
Only **Lovable can also write directly to the production database.** That is
the asymmetry the protocol exists to manage.

### Green — no approval needed

Flows straight through Lovable, or straight to `main`.

- New table, new column, new index
- New function that nothing depends on yet
- UI, styling, copy, assets
- Anything that errors visibly when wrong

### Red — stops for Kila

Nothing here reaches production until you have run it yourself, or explicitly
told Lovable to.

- **RLS policies** — create, drop, or alter, on any table
- **Triggers** — especially the venture guards and the tribe sync
- **Grants and roles**
- **`update` or `delete` against existing rows**
- **`app_settings`** — the adult gate lives here
- **Storage bucket `public` flags**
- Dropping or renaming anything

### The rule for Lovable's "Detected Issues" panel

Its scanner reads policies in isolation. It cannot see triggers, so it will
keep reporting the venture self-accept policy as Critical. **That finding is a
false positive and its suggested fix is not implementable in RLS** — a policy
cannot see the old and new row at once, which is exactly why the rule lives in
a `BEFORE` trigger.

Never click **"Try to fix all"** on a Red-category finding. Use **"Ignore
issue"**, and if a finding looks genuinely new, bring it here first.

---

## How a database change ships

Deployment of *code* is just `git push origin main` — Lovable rebuilds and
publishes. Schema is the part that needs care.

1. **Write it as a migration file.** Every schema change gets a file in
   `supabase/migrations/`, even when Lovable will be the one to apply it.
   The repo is the record; if a change exists only in the SQL editor, it is
   invisible to everyone including future-you.

2. **Rehearse it.** Claude replays the full migration set onto an empty
   Postgres 16 and reports what breaks. This catches ordering bugs and
   statements that abort halfway. It found the `status = 'rejected'` bug that
   would have silently truncated a migration.

3. **Back up if it is Red.** Lovable Cloud → Backups, before anything that
   rewrites rows or changes access.

4. **Apply.** Green: let Lovable. Red: paste it into the SQL editor yourself.

5. **Verify against production, not against a model.** Run the checks in
   `LOVABLE_SQL_EDITOR_PASTE.sql`. This step is not optional — see below.

---

## The drift check

**Nothing detects production drifting from this repo automatically.**

Claude's rehearsal proves the migration files are self-consistent. It cannot
connect to production, so it cannot tell you the two have diverged. On
2026-08-21 the only reason we knew they matched was that the SQL editor output
got pasted into the conversation by hand.

Run Step 4 of `LOVABLE_SQL_EDITOR_PASTE.sql`:

- before launch
- after any Lovable session that touched the database
- if anything behaves strangely in a way that smells like missing data

Every column should read `true` except `no_anon_table_grants`, which is `false`
on real Supabase and is fine — `anon` holds table grants by default and RLS is
what actually gates access. Confirmed 2026-08-21: all 23 tables have RLS
enabled and zero policies target `anon`.

---

## Rollback

There is no staging and no canary. Rollback is:

| What broke | How to undo |
|---|---|
| Code | `git revert`, push. Lovable rebuilds. |
| Adult gate | `update app_settings set value = 'false' where key = 'adult_gate_enabled';` |
| Additive schema | Usually leave it. An unused column harms nothing. |
| Rewritten rows | Lovable Cloud → Backups. This is an incident, not a workflow. |

The asymmetry is the point: code and the gate are seconds to undo, rewritten
rows are not. That is why row-rewriting changes are Red.

---

## Environments

There are none. One database, `ppdfglcpsnllziotfiso`, with real users in it.

The local Supabase stack has been retired deliberately — it played no part in
deployment, and keeping it in sync with what Lovable does to production was a
losing fight. Schema rehearsal happens in Claude's sandbox instead.

What this costs, stated plainly so nobody is surprised later:

- **Time-dependent behaviour cannot be tested.** The 21-day tribe switch
  cooldown would require editing a real user's `tribe_changed_at`.
- **Deletion tests leave marks.** Deleting a profile cascades into 14 tables.
  A test account that interacted with real users changes their seat counts,
  comment counts and follower counts when removed. Test deletion only with
  accounts that have touched nothing but other test accounts.

Keep the Supabase CLI **unlinked** (`supabase/.temp/project-ref` absent). That
is what stands between a stray `supabase db reset --linked` and 34 real users.
