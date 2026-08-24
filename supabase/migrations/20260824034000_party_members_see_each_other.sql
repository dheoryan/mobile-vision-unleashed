-- Accepted members can see who else was accepted.
--
-- RED under CHANGE_PROTOCOL: this adds an RLS policy. Read it before running it.
--
-- The problem, stated plainly: an accepted member could see that they were in,
-- and nothing about who they were meeting. The read policy on
-- venture_applications is
--
--     applicant_id = auth.uid() or is_venture_host(venture_id, auth.uid())
--
-- so a member reads exactly one row — their own. The host has had a full view
-- of their applicants the whole time. The people actually turning up to meet
-- strangers had a stub and a chat button.
--
-- ---------- why this is not a new disclosure ----------
--
-- venture_messages already reads with is_venture_member(), so anyone accepted
-- can already see every name in the party chat the moment somebody speaks. The
-- identities are mutually visible today; they are just not available as a list.
-- This makes explicit what the chat policy already made true, which is a
-- different and much smaller thing than opening something that was shut.
--
-- ---------- what it deliberately does not expose ----------
--
-- `status = 'accepted'` is load-bearing. Members see who is IN. They do not see
-- who applied and was declined, who is still pending, or who was invited and
-- passed. A declined applicant should never be visible to the party that
-- declined them — that is a small humiliation the schema can simply refuse to
-- make possible.
--
-- ---------- blast radius ----------
--
-- Permissive policies OR together, so this is purely additive: no existing
-- access is narrowed, no current query starts returning less. The worst case if
-- the reasoning above is wrong is that members see each other's display names
-- and avatars — which the party chat already shows them.
--
-- Idempotent: drop-then-create, because Postgres has no CREATE POLICY IF NOT
-- EXISTS even in 16.

drop policy if exists "Party members see each other" on public.venture_applications;

create policy "Party members see each other"
on public.venture_applications for select to authenticated
using (
  status = 'accepted'
  and public.is_venture_member(venture_id, auth.uid())
);

comment on policy "Party members see each other" on public.venture_applications is
  'Lets an accepted member list the other accepted members of the same Venture. Accepted rows only: declined and pending applicants stay visible to the host alone. Mirrors the venture_messages policy, which already exposes these identities in the party chat.';
