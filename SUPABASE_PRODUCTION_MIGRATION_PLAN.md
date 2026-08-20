# Taking local → production (`ppdfglcpsnllziotfiso`)

23 migrations were written in this session. Local has them all; production has
none of them (assumed — **step 0 proves it**). Several of them rewrite existing
rows or add restrictive policies, so this is not a "run migration up and watch
the log" job.

Read this first. The dangerous parts are §2 and §3.

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

## 1. Does production have real users?

This decides whether §2 is a careful data migration or a formality.

```sql
select
  (select count(*) from auth.users)                                    as users,
  (select count(*) from public.profiles)                               as profiles,
  (select count(*) from public.profiles where cardinality(tribe_ids) > 1) as multi_tribe,
  (select count(*) from public.profiles where adult_verified_at is null) as unverified,
  (select count(*) from public.posts)                                  as posts,
  (select count(*) from public.ventures)                               as ventures;
```

If `users` is small and all of them are you and Codex's test accounts, the
honest and much safer move is to **reset production instead of migrating it**:

```bash
npx supabase db reset --linked      # destroys all production data
```

That skips every risk in §2 entirely. Given the app has not launched, this is
what I would recommend unless the numbers above say otherwise.

---

## 2. Five migrations that change existing rows

These are fine on an empty database and consequential on a populated one.

### 2a. `20260820000900_enforce_adult_verification.sql` — the one that can take the app down

It adds `as restrictive` policies to **profiles, posts, comments, messages,
tribe_messages and ventures**. Restrictive policies are AND-ed with everything
else, so a user who does not satisfy them loses access regardless of what other
policies allow.

If production profiles have `adult_verified_at IS NULL` — which they will,
because the column is added in this same migration — **every existing user is
locked out of all six tables the moment this applies.** Not an error, just an
empty app.

Pre-flight: the `unverified` count from §1. If it is greater than zero, decide
before deploying:

```sql
-- Option A: grandfather everyone who already signed up.
update public.profiles set adult_verified_at = now() where adult_verified_at is null;

-- Option B: leave them locked and make them re-verify. Only sane if the
-- accounts are test accounts.
```

Run the backfill **immediately after** this migration, in the same session.

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
