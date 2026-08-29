-- Backfill: anyone who already has real message history together becomes
-- Moots, even though no Hello was ever sent or accepted between them (user
-- decision, 2026-08-29, following 20260829030000_same_tribe_requires_hello).
-- That migration's message-history branch already keeps their DM access -
-- this covers the other half: without it, they could keep messaging each
-- other forever but never show up in each other's Moots list/count, or
-- qualify for Moots-based Venture invite eligibility. An existing
-- conversation without an accepted Hello could previously only happen via
-- the old same-Tribe auto-DM bypass (just removed) or a shared active
-- Venture (still allowed) - either way, it's a real relationship, not a
-- cold contact, so it gets treated as one.
--
-- One synthetic 'accepted' row per pair that has message history and no
-- existing accepted Hello in either direction - sender/recipient direction
-- is whoever sent the first message between them, `created_at` is that
-- first message's timestamp (when the relationship actually started),
-- `decided_at` is now() (when this migration is the thing doing the
-- deciding).
--
-- Triggers are disabled for the insert on purpose: hellos_enforce_retry_window
-- and hellos_enforce_monthly_cap exist to gate a live user's send action, not
-- an administrative backfill, and trg_notify_on_hello would otherwise fire a
-- fresh "X said hello" notification for a conversation that may be months
-- old - confusing, not informative. Re-enabled immediately after.
--
-- USER, not ALL: the Supabase SQL editor role isn't a Postgres superuser, so
-- it cannot touch the RI_ConstraintTrigger_* system triggers that back the
-- sender_id/recipient_id foreign keys - DISABLE TRIGGER ALL fails with
-- "permission denied" on those. USER only touches the three triggers this
-- migration actually needs to bypass, and leaves FK integrity enforcement
-- untouched (which was never the intent anyway).
--
-- messages has orphaned rows referencing deleted accounts (unlike hellos,
-- its sender_id/recipient_id aren't a cascading FK to auth.users, so a
-- deleted account's old messages just stick around with a UUID that no
-- longer exists anywhere) - hellos DOES enforce that FK, so inserting a
-- synthetic row for a pair involving a deleted account fails outright.
-- Filtered out below with an exists() check against auth.users for both
-- sides, which is correct regardless of the FK: a deleted account can't
-- retroactively become anyone's Moot.
--
-- This is Red under CHANGE_PROTOCOL.md - it inserts real rows into an
-- existing production table. Back up before running.
alter table public.hellos disable trigger user;

insert into public.hellos (sender_id, recipient_id, message, status, created_at, decided_at)
select
  first_msg.sender_id,
  first_msg.recipient_id,
  'Already messaging before Moots required a Hello - backfilled automatically.',
  'accepted',
  first_msg.created_at,
  now()
from (
  select distinct on (least(sender_id, recipient_id), greatest(sender_id, recipient_id))
    sender_id, recipient_id, created_at
  from public.messages m
  where exists (select 1 from auth.users u where u.id = m.sender_id)
    and exists (select 1 from auth.users u where u.id = m.recipient_id)
  order by least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at asc
) as first_msg
where not exists (
  select 1 from public.hellos h
  where h.status = 'accepted'
    and (
      (h.sender_id = first_msg.sender_id and h.recipient_id = first_msg.recipient_id)
      or (h.sender_id = first_msg.recipient_id and h.recipient_id = first_msg.sender_id)
    )
);

alter table public.hellos enable trigger user;
