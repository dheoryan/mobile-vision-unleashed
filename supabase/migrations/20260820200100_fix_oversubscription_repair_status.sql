-- FIX A LATENT MIGRATION-ABORTING BUG IN MY OWN OVER-SUBSCRIPTION REPAIR.
--
-- 20260820002300_venture_slot_integrity.sql repairs ventures that were already
-- over-subscribed before the capacity trigger existed, by demoting the seats
-- past max_slots:
--
--   update public.venture_applications va
--   set status = 'rejected'          <-- this value is not allowed
--   from ranked
--   where ranked.id = va.id and ranked.seat + 1 > ranked.max_slots;
--
-- `rejected` is not in venture_applications_status_check, which permits only
-- pending / accepted / declined / cancelled / invited. So that statement throws
-- the moment it matches a single row:
--
--   ERROR: new row for relation "venture_applications" violates check
--          constraint "venture_applications_status_check"
--
-- It has been silently fine everywhere it has run so far only because no
-- over-subscribed venture happened to exist there. On a database that does have
-- one — which is the entire reason the repair was written — it aborts the whole
-- migration partway through.
--
-- Lovable's squash (20260820190650) copied the statement verbatim, so
-- production carries the same latent failure. That is also the cleanest signal
-- of whether production's migration completed: app_settings is created at the
-- very end of that file, so if app_settings exists, the repair matched nothing
-- and everything after it ran.
--
-- `declined` is the right replacement. It is a valid status, it is what the
-- host path already writes when turning an applicant away, and unlike
-- `cancelled` it does not read as "the applicant withdrew".
--
-- Separately, and deliberately left alone: the trigger Lovable added in
-- 20260820191344 lists 'rejected' as a target in three of its host branches.
-- Those branches are unreachable for the same constraint reason, and the app
-- never sends 'rejected' (nothing in src/ writes it), so they are dead rather
-- than dangerous. Rewriting Lovable's trigger to tidy them would just invite a
-- conflict the next time it regenerates that file.

-- ---------- re-run the repair, correctly this time ----------
-- Idempotent: on an already-clean database this matches zero rows.

with ranked as (
  select
    va.id,
    row_number() over (partition by va.venture_id order by va.created_at) as seat,
    v.max_slots
  from public.venture_applications va
  join public.ventures v on v.id = va.venture_id
  where va.status = 'accepted'
)
update public.venture_applications va
set status = 'declined'
from ranked
where ranked.id = va.id
  and ranked.seat + 1 > ranked.max_slots;

-- ---------- resync the counters the demotion just invalidated ----------

update public.ventures v
set filled_slots = 1 + (
      select count(*)
      from public.venture_applications va
      where va.venture_id = v.id and va.status = 'accepted'
    ),
    status = case
      when v.status = 'closed' then 'closed'
      when 1 + (
        select count(*)
        from public.venture_applications va
        where va.venture_id = v.id and va.status = 'accepted'
      ) >= v.max_slots then 'full'
      else 'open'
    end
where v.filled_slots is distinct from 1 + (
      select count(*)
      from public.venture_applications va
      where va.venture_id = v.id and va.status = 'accepted'
    );

-- ---------- verification ----------
--   select count(*) from public.ventures v
--   where v.filled_slots > v.max_slots;      -- must be 0
