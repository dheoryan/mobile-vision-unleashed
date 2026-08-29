-- Tribemates must send and accept a Hello like anyone else before they can
-- DM or count as Moots (user decision, 2026-08-29) - Tribe membership alone
-- no longer auto-grants messaging. The difference for same-Tribe Hellos is
-- unchanged and needs no further work here: hello_is_capped() already
-- excludes same-Tribe pairs from the monthly cap
-- (20260828040000_hello_retry_and_split_cap.sql) - this migration only
-- removes the branch that let Tribemates skip sending a Hello at all.
--
-- The message-history branch is left untouched on purpose: a pair who
-- already has real messages under the old same-Tribe rule keeps being able
-- to message each other - this changes what's required to START a new
-- conversation, not one already in progress.
--
-- This is Red under CHANGE_PROTOCOL.md - it redefines the SECURITY DEFINER
-- function backing the messages insert RLS policy.
create or replace function public.can_direct_message(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _a is not null and _b is not null and _a <> _b
    and not public.has_blocked(_a, _b)
    and (
      exists (select 1 from public.hellos h where h.status = 'accepted'
        and ((h.sender_id = _a and h.recipient_id = _b) or (h.sender_id = _b and h.recipient_id = _a)))
      or exists (select 1 from public.ventures v where coalesce(v.status, 'open') <> 'closed'
        and ((v.user_id = _a and public.is_venture_member(v.id, _b))
          or (v.user_id = _b and public.is_venture_member(v.id, _a))
          or (public.is_venture_member(v.id, _a) and public.is_venture_member(v.id, _b))))
      or exists (select 1 from public.messages m
        where (m.sender_id = _a and m.recipient_id = _b) or (m.sender_id = _b and m.recipient_id = _a))
    );
$$;

revoke all on function public.can_direct_message(uuid, uuid) from public, anon;
grant execute on function public.can_direct_message(uuid, uuid) to authenticated;

comment on function public.can_direct_message(uuid, uuid) is
  'True once _a and _b have an accepted Hello, share an active Venture, or already have message history between them. Tribe membership alone no longer qualifies (2026-08-29) - Tribemates must Hello like anyone else, but hello_is_capped() already exempts them from the monthly cap.';
