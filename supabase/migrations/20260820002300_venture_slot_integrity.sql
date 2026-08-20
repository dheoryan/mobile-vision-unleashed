-- VENTURE SLOT INTEGRITY, and an honest venture_count.
--
-- ==========================================================================
-- M1a — a Venture can be over-subscribed without limit, and it looks fine.
-- ==========================================================================
--
-- This was filed as a race, but the race is the smaller half of it. There is
-- no cap on accepting at all:
--
--   * is_venture_joinable() checks `filled_slots < max_slots`, but it is only
--     wired into the INSERT policy — i.e. it gates *applying*, not accepting.
--   * The host UPDATE policy ("Hosts decide venture applications") lets a host
--     move any number of applications to 'accepted'.
--   * sync_venture_slots() then recounts and writes
--         least(1 + accepted_count, max_count)
--     and that `least` is the real problem: it CLAMPS. Accept six people into
--     a four-slot Venture and filled_slots reads 4. The board says "Full", the
--     party chat has six people in it, and nothing anywhere reports a
--     discrepancy.
--   * The `filled_slots between 1 and max_slots` check constraint never fires,
--     because the clamp guarantees it is satisfied. The one backstop that
--     could have caught this was disarmed by the code it was meant to check.
--
-- On top of that sits the actual race: two hosts' tabs (or a host and an
-- invitee) accepting simultaneously both read the same count and both proceed.
--
-- Fix: a BEFORE trigger that takes a row lock on the Venture before counting,
-- so concurrent accepts serialise on that row rather than racing, and refuses
-- the transition when the seat is not there. Then remove the clamp, so the
-- check constraint becomes a live backstop again instead of a decoration.
--
-- The guard lives on venture_applications rather than in a policy because
-- there are two legitimate ways into 'accepted' — the host deciding, and an
-- invitee responding to an invite — and a WITH CHECK cannot see OLD or take a
-- lock.

create or replace function public.enforce_venture_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_count int;
  venture_status text;
  accepted_count int;
begin
  -- Only transitions INTO 'accepted' consume a seat. Leaving 'accepted'
  -- (declined, cancelled, rejected) frees one and needs no check.
  if new.status is distinct from 'accepted' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'accepted' then
    return new;  -- already holds a seat; not a new claim
  end if;

  -- FOR UPDATE is the whole point. It serialises concurrent accepts on the
  -- Venture row, so the count below cannot be read by two transactions that
  -- then both decide there is room. Without this lock, two simultaneous
  -- accepts of the last seat both succeed.
  select v.max_slots, v.status
    into max_count, venture_status
  from public.ventures v
  where v.id = new.venture_id
  for update;

  if not found then
    raise exception 'Venture % no longer exists', new.venture_id;
  end if;

  if venture_status = 'closed' then
    raise exception 'This Venture is closed'
      using hint = 'Reopen it before accepting anyone else.';
  end if;

  select count(*) into accepted_count
  from public.venture_applications
  where venture_id = new.venture_id
    and status = 'accepted'
    and id is distinct from new.id;

  -- The host occupies seat 1, so total occupancy after this accept is
  -- 1 (host) + accepted_count (already in) + 1 (this one).
  if 1 + accepted_count + 1 > max_count then
    raise exception 'This Venture is already full (% of % seats taken)',
      1 + accepted_count, max_count
      using hint = 'Someone else took the last spot.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_venture_capacity() from public, anon, authenticated;

drop trigger if exists trg_enforce_venture_capacity on public.venture_applications;
create trigger trg_enforce_venture_capacity
before insert or update on public.venture_applications
for each row execute function public.enforce_venture_capacity();

-- ---------- remove the clamp that hid the overflow ----------

create or replace function public.sync_venture_slots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_venture uuid;
  accepted_count int;
  next_filled int;
  max_count int;
  current_status text;
begin
  target_venture := coalesce(new.venture_id, old.venture_id);

  select count(*) into accepted_count
  from public.venture_applications
  where venture_id = target_venture and status = 'accepted';

  select max_slots, status into max_count, current_status
  from public.ventures
  where id = target_venture;

  if max_count is null then
    return null;  -- venture was deleted in the same transaction
  end if;

  -- No least(). With enforce_venture_capacity in front of every accept this
  -- can no longer exceed max_slots, and if it somehow does, the
  -- ventures_filled_slots_check constraint should fail loudly rather than
  -- letting us round the number down and pretend.
  next_filled := 1 + accepted_count;

  update public.ventures
  set
    filled_slots = next_filled,
    status = case
      when current_status = 'closed' then 'closed'
      when next_filled >= max_count then 'full'
      else 'open'
    end
  where id = target_venture;

  return null;
end;
$$;

-- ---------- repair anything already over-subscribed ----------
-- Keeps the earliest-decided accepts, since those are the people who have
-- been in the party chat longest and most plausibly still expect to attend.
-- Demoted rows go to 'rejected' rather than being deleted, so the applicant
-- keeps a visible record instead of silently vanishing from the list.

with ranked as (
  select
    va.id,
    row_number() over (
      partition by va.venture_id
      order by coalesce(va.decided_at, va.created_at), va.id
    ) as seat,
    v.max_slots
  from public.venture_applications va
  join public.ventures v on v.id = va.venture_id
  where va.status = 'accepted'
)
update public.venture_applications va
set status = 'rejected'
from ranked
where ranked.id = va.id
  -- seat + 1 because the host already occupies one.
  and ranked.seat + 1 > ranked.max_slots;

-- Recompute every counter now that the clamp is gone, so no row carries a
-- number that was rounded down under the old function.
update public.ventures v
set filled_slots = 1 + (
      select count(*) from public.venture_applications va
      where va.venture_id = v.id and va.status = 'accepted'
    ),
    status = case
      when v.status = 'closed' then 'closed'
      when 1 + (
        select count(*) from public.venture_applications va
        where va.venture_id = v.id and va.status = 'accepted'
      ) >= v.max_slots then 'full'
      else 'open'
    end;

-- ==========================================================================
-- M1b — profiles.venture_count is a read-modify-write from the client.
-- ==========================================================================
--
-- createHostedVenture did SELECT venture_count, then UPDATE to value + 1, with
-- the arithmetic in JavaScript between the two. Two Ventures created at once
-- both read N and both write N + 1, so the second one is free.
--
-- That counter is the free-tier quota (`ventureCount >= 3` gates hosting), so
-- an undercount is a paywall bypass — dormant while MONETIZATION_ENABLED is
-- off, live the moment it is switched on, which is exactly the kind of bug
-- that ships because nobody re-audits a flag flip.
--
-- Maintained by trigger instead. The database owns the number, the client
-- cannot skew it, and there is no window between the read and the write.

create or replace function public.bump_host_venture_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set venture_count = venture_count + 1
  where id = new.user_id;
  return null;
end;
$$;

revoke all on function public.bump_host_venture_count() from public, anon, authenticated;

drop trigger if exists trg_bump_host_venture_count on public.ventures;
create trigger trg_bump_host_venture_count
after insert on public.ventures
for each row execute function public.bump_host_venture_count();

-- Backfill from the actual rows, repairing any drift the read-modify-write
-- already caused. This counts Ventures that still exist; a host who deleted
-- one gets that quota back, which is the more defensible reading of a
-- "how many have you hosted" allowance anyway.
update public.profiles p
set venture_count = coalesce((
  select count(*) from public.ventures v where v.user_id = p.id
), 0);

comment on function public.enforce_venture_capacity() is
  'Refuses a transition into accepted when the Venture has no seat left. Takes FOR UPDATE on the ventures row first so concurrent accepts serialise instead of both reading the same count.';

comment on function public.bump_host_venture_count() is
  'Maintains profiles.venture_count in the database so the client cannot lose increments to a read-modify-write race.';
