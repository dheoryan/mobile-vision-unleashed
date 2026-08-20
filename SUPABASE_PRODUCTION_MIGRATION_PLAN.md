# Taking local → production (`ppdfglcpsnllziotfiso`)

**28** migrations are unapplied on production, not 23 — corrected after looking
at the history properly. Several rewrite existing rows or add restrictive
policies, so this is not a "run db push and watch the log" job.

Read this first. The dangerous parts are §2, §3 and §2f.

## This is a Lovable project, which changes two things

The migration history has two authors, and they interleave:

- **27 Lovable-generated** — `<timestamp>_<uuid>.sql`. Lovable applies these to
  the linked project itself, so production almost certainly has them.
- **28 hand-written** — Codex's and mine. Production has seen none of them.

They are not cleanly separated by date: `20260516123000_open_party_ventures.sql`
(ours) sits between Lovable migrations from 05-16 and 05-17. So you cannot infer
what production has from filenames alone — §0's `migration list` is the only
thing that answers it, and it is mandatory rather than a formality.

**The live risk: Lovable is still connected.** If anyone opens the Lovable
editor and changes anything touching the schema, Lovable generates a migration
and applies it to production directly — reintroducing drift, and potentially
regenerating RLS policies on tables we hardened. `fix_venture_application_self_accept`
is a policy rewrite; if Lovable regenerates that table's policies from its own
model, the self-accept hole reopens silently.

Before deploying: stop editing in Lovable, or disconnect it from the Supabase
project. Decide which, and write it down, because this is not a one-time
hazard — it recurs every time someone opens that editor.

---

## 0. Establish the actual gap — do this before anything else

Everything below assumes production is at the pre-2026-08-19 state. Prove it
rather than trusting it:

```bash
npx supabase link --project-ref ppdfglcpsnllziotfiso
npx supabase migration list          # local vs remote, side by side
```

Any migration showing as applied remotely that you did not deploy means someone
(or the Lovable/Supabase dashboard) has been editing production schema directly.
If that is the case, **stop** — a dashboard-edited production will diverge from
these files in ways `db push` will not reconcile, and you need a schema diff
before going further:

```bash
npx supabase db diff --linked --schema public > /tmp/prod-drift.sql
```

An empty diff means production matches the migration history. A non-empty one is
the real starting point and changes this plan.

---

## 1. Production has real users — confirmed by the user, 2026-08-20

**An earlier version of this plan recommended `supabase db reset --linked` if
the data looked disposable. It is not. Do not run that command.** It destroys
every account, post and Venture on production. That section has been deleted
rather than corrected, so nobody skims it later and reaches for it.

Everything in §2 is therefore a live data migration, not a formality. Take the
counts anyway — they tell you how much of §2 actually applies:

```sql
select
  (select count(*) from auth.users)                                       as users,
  (select count(*) from public.profiles where cardinality(tribe_ids) > 1) as multi_tribe,
  (select count(*) from public.profiles where adult_verified_at is null)  as unverified,
  (select count(*) from public.posts)                                     as posts,
  (select count(*) from public.ventures)                                  as ventures;
```

**Take a manual backup before anything else.** Dashboard → Database → Backups.
Confirm it exists. Point-in-time recovery is a paid add-on; do not assume you
have it.

---

## 2. Six migrations that touch existing rows or access

These are fine on an empty database and consequential on a populated one.

### 2a. Adult verification — SOLVED by `20260820002600_adult_gate_switch.sql`

The problem: `enforce_adult_verification` adds `as restrictive` policies to
seven tables and adds `adult_verified_at` in the same migration, so every
existing user has NULL there when it applies. Restrictive policies are AND-ed,
so all seven tables disappear for everyone at once — no error, just an empty
app.

Verified against Postgres 16: a real, unverified user could see **0 of 2**
posts.

The fix ships the gate switched off. `20260820002600` adds an `app_settings`
switch and teaches `is_verified_adult()` to short-circuit when it is off, so
the mechanism deploys inert and nothing breaks. Putting the switch inside the
function rather than in seven policy definitions means every current policy
respects it, and so will any added later.

**Nothing extra to do at deploy time.** The switch defaults to off.

When you are ready to actually enforce it, check the cost first:

```sql
select count(*) filter (where adult_verified_at is null) as still_locked_out,
       count(*)                                          as total
from public.profiles where suspended_at is null;
```

Everyone in `still_locked_out` loses access the moment you run:

```sql
update public.app_settings set value = 'true'::jsonb, updated_at = now()
where key = 'adult_gate_enabled';
```

Reversible with the same statement and `'false'`. Tested in both directions,
plus the missing-row case, which fails open — failing closed would lock
everyone out of seven tables, which is the wrong direction to be wrong in.

Before flipping it you still need an in-app way for people to verify. That does
not exist yet.

### 2b. `20260820002000_one_tribe_per_user.sql` — silently drops Tribes

```sql
update public.profiles set tribe_ids = array[tribe_ids[1]]
where coalesce(array_length(tribe_ids, 1), 0) > 1;
```

Every Tribe after the first is discarded, and the matching `tribe_members` rows
are deleted. On production that is real people losing rooms they joined, with no
notice. Check `multi_tribe` from §1. If it is non-zero, capture who lost what
before running, so they can at least be told:

```sql
create table if not exists public._tribe_migration_audit as
select id, tribe_ids, now() as captured_at
from public.profiles where cardinality(tribe_ids) > 1;
```

### 2c. `20260820002300_venture_slot_integrity.sql` — ejects over-subscribed members

Demotes `accepted` applications beyond `max_slots` to `rejected`, keeping the
earliest-decided. On production that removes real people from real plans, and
they get no notification. Check first:

```sql
select v.id, v.title, v.max_slots,
       1 + count(*) filter (where va.status = 'accepted') as real_occupancy
from public.ventures v
left join public.venture_applications va on va.venture_id = v.id
group by v.id having 1 + count(*) filter (where va.status = 'accepted') > v.max_slots;
```

Empty result = nothing to worry about.

### 2d. `20260820000400_secure_post_images.sql` + `20260820000700_private_tribe_chat_attachments.sql` — break image URLs that do not match

Both flip a public bucket to private and rewrite stored public URLs into object
paths via `split_part(...)`. Any row whose `image_url` is not in the exact
expected format keeps its old value and becomes a **broken image**, because the
bucket is now private and the stored string is not a valid path.

Find them before, not after:

```sql
select count(*) from public.posts
where image_url is not null
  and image_url not like '%/storage/v1/object/public/post-images/%'
  and image_url !~ '^[0-9a-fA-F-]{36}/';
```

Non-zero means those posts need hand-fixing.

### 2e. `20260820001500_rename_koi_tribe.sql`

Renames a Tribe key. Anything holding the old key — `profiles.tribe_ids`,
`posts.tribe_id` — must be updated by the same migration. Verify after applying:

```sql
select tribe_ids, count(*) from public.profiles group by 1;
select distinct tribe_id from public.posts;
```

Nothing should reference the old key.

### 2f. `20260811000000_local_dev_base_grants.sql` — do NOT apply this to production

It exists so a local `supabase db reset` gets the baseline grants that hosted
Supabase applies at provisioning time. Production already has them. Applying it
anyway is not a no-op, because of these two lines:

```sql
grant all on all routines in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, ...;
```

`all` on a routine means EXECUTE. The default-privileges line makes that the
**default for every function created afterwards** — so any function added later
is anonymously executable unless something explicitly revokes it. Most of the
migrations here do revoke; `fix_venture_application_self_accept` and
`secure_post_images` create functions without one, and nothing Lovable
generates in future will either.

Mark it applied without running it:

```bash
npx supabase migration repair --status applied 20260811000000
```

Then confirm anon cannot execute the SECURITY DEFINER helpers:

```sql
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and has_function_privilege('anon', p.oid, 'execute');
```

That should return **zero rows**. Anything listed is a function anonymous
visitors can run with the owner's privileges.

---

## 3. Two migrations need a secret set manually, or push dies silently

### `20260819000000_rotate_push_dispatch_secret.sql`

Generates a **new random secret** into Vault at apply time. The Worker/Edge
Function that calls the dispatch endpoint authenticates with the *old* one, so
the moment this applies, push notifications stop — with no error surfaced to
users.

After applying, read the new value and update the caller's env:

```sql
select decrypted_secret from vault.decrypted_secrets where name = 'push_dispatch_secret';
```

### `20260820000200_push_dispatch_url_from_vault.sql`

Reads the dispatch URL from Vault instead of the hardcoded `lovable.app`
preview domain. **Production has no such Vault entry**, so push silently
no-ops until you create one:

```sql
select vault.create_secret('https://YOUR-PRODUCTION-DOMAIN/api/public/push/dispatch', 'push_dispatch_url');
```

Set this **before or immediately after** the migration, and verify push
end-to-end afterwards — this is the failure mode nobody notices for a week.

---

## 4. Index creation locks writes

`20260820000100_add_missing_indexes.sql` creates 11 indexes with no
`CONCURRENTLY` (it cannot use it — migrations run inside a transaction). Each
takes an exclusive lock for the duration.

On a pre-launch database with thousands of rows this is under a second and does
not matter. It is only worth knowing so it does not surprise you later, when
`posts` is large enough for it to.

---

## 5. Order of operations

1. **Back up.** Supabase Dashboard → Database → Backups, take a manual one, and
   confirm it exists before proceeding. Point-in-time recovery is a paid
   feature; do not assume you have it.
2. Run §0 and §1. Decide reset-vs-migrate.
3. If migrating: run the §2 pre-flight queries and record the results.
4. Create the `push_dispatch_url` Vault secret (§3).
5. `npx supabase db push` — pushes only unapplied migrations.
6. Immediately: adult-verification backfill (§2a) if needed.
7. Update the push caller with the new dispatch secret (§3).
8. Run §6 verification.

Deploy the app code **after** the database, not before. Several of these
migrations add columns the new code reads (`image_url`, `tribe_changed_at`,
`interests`); old code tolerates new columns, new code does not tolerate
missing ones.

---

## 6. Verification after

```sql
-- No user locked out by the restrictive adult policies.
select count(*) from public.profiles where adult_verified_at is null;

-- No Venture over capacity.
select count(*) from public.ventures v
where v.filled_slots > v.max_slots;

-- Every profile on exactly one Tribe.
select cardinality(tribe_ids) as tribes, count(*) from public.profiles group by 1;

-- The new Explore RPC answers.
select count(*) from public.list_explore_matches(5, 0);

-- Buckets are private.
select id, public from storage.buckets
where id in ('post-images','tribe-chat-attachments','venture-images');
```

Then, in the app: sign in as a real account, load the feed, open Explore, create
a Venture with a photo, and send a push. Those five cover every migration that
can fail quietly.

---

## 7. What I cannot verify from here

- Whether production has been edited through the dashboard (§0 answers it).
- Whether the push Worker's secret is stored somewhere I can see — it is not in
  the repo, so updating it is manual.
- Whether the production domain in §3 is what you actually deploy to.
- Every migration in this plan has been tested against a local Postgres 16 and
  a local Supabase stack. **None has been run against production.** The reset
  path in §1 is safer than this whole document; prefer it if the data is
  disposable.
