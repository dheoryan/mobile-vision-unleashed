# Launch checklist

One-time. Tick it off, then delete it. The permanent process lives in
`CHANGE_PROTOCOL.md`.

Status as of 2026-08-21. Production is `ppdfglcpsnllziotfiso` with 34 real
users already on it, so "launch" here means opening the doors wider, not
switching something on.

---

## Blockers — these break real things

- [ ] **Set `push_dispatch_url` in production Vault.**
      Without it, `dispatch_push_for_notification()` hits `raise log` and
      returns. Push notifications never fire and **nothing surfaces an error** —
      not in the UI, not in the network tab. Verify it points at the live
      domain, not a preview URL.
      `sql
    select name, created_at from vault.secrets order by name;
    `

- [ ] **Seed at least one moderator.**
      `reports`, `moderate_report()` and the queue all exist, but
      `public.moderators` is empty — nothing in any migration inserts a row.
      Right now a user can report content and it lands in a queue **no human
      can open**. That is worse than having no reporting at all, because the
      UI promises action.
      `sql
    insert into public.moderators (user_id) values ('<your profile uuid>');
    `

- [ ] **Replace the placeholder contact addresses.**
      `privacy.tsx` and `terms.tsx` both name `@mutuals.app` addresses that
      nobody monitors. A privacy policy listing an unread inbox is worse than
      a missing one — it is a promise you are visibly not keeping.

- [ ] **Legal review of Terms and Privacy.**
      Both files carry `// TODO: legal review before launch`. The app collects
      precise location, is 18+ only, hosts user-to-user meetups, and stores
      DMs. This is the one item on this list that is not a coding task.

- [ ] **Take a backup immediately before opening up.**
      Lovable Cloud → Backups. You have never taken one; the big migration ran
      without a restore point.

---

## Decisions — nobody else can make these

- [ ] **Turn the adult gate on, or leave it off and say so.**
      It ships inert. Enabling it locks out every profile with
      `adult_verified_at is null` across seven tables, instantly.

      Count first, decide second:
      ```sql
      select count(*) filter (where adult_verified_at is null) as would_lose_access,
             count(*)                                          as total
      from public.profiles where suspended_at is null;
      ```
      Enable: `update app_settings set value = 'true'::jsonb where key = 'adult_gate_enabled';`
      Revert: same statement with `'false'`. One statement each way — check the
      app between them, and do it when you can watch.

- [ ] **Pricing.** `/tiers` and `/upgrade` contradict each other and the
      database, and `/upgrade` still says "Coming soon". Known and accepted
      until you say otherwise — noted here only so launch is a deliberate
      choice rather than an oversight.

---

## Should do — not blocking, but cheap

- [x] **Fix the dependency mismatch.** ~~`@lovable.dev/vite-tanstack-config`
      2.9.1 vs 2.13.1.~~ Resolved 2026-08-21 with `npm install` (no bun on the
      machine), which is also what cleared the "Invalid server function ID"
      errors. Note this rewrote `package-lock.json` — see the lockfile item
      below, still open.

- [ ] **Settle on one lockfile.** Both `bun.lock` and `package-lock.json` are
      tracked and they disagree (707 packages vs 507). Confirm how Lovable
      installs, then drop the loser.

- [ ] **Revert `daf5319`.** The storage bucket migration fixes nothing — the
      buckets were already private — and its comment header describes a
      production incident that never happened. Harmless to run, misleading to
      read. Bundle it with the next real push.

---

## Untested — know what you are shipping

Not tasks. Things nobody has exercised end to end, listed so they are a known
risk rather than a surprise.

| Flow                                    | Why it is untested                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Account deletion                        | Cascades into 14 tables. Only safe to test with an account that has touched nothing real.       |
| Suspension                              | Same reason.                                                                                    |
| Moderation queue, end to end            | Blocked on seeding a moderator.                                                                 |
| 21-day tribe switch cooldown            | Cannot be tested without editing a real `tribe_changed_at`. Will not be verified before launch. |
| Venture capacity under real concurrency | The row lock is proven in a two-session Postgres test, not with real users racing.              |

---

## Verified — do not re-litigate

Confirmed against production on 2026-08-21, not against a simulation.

- All 62 migrations replay cleanly onto an empty Postgres 16
- `tsc --noEmit` and `vite build` pass at `d8a2b09`
- Adult gate inert; unverified users retain access
- Venture self-accept blocked — full 5×5 transition matrix, both guard
  triggers present, capacity row lock intact
- All 23 tables have RLS enabled; zero policies target `anon`
- All three private buckets private; only `avatars` is public
- Migration `20260820190650` completed; zero over-subscribed ventures
