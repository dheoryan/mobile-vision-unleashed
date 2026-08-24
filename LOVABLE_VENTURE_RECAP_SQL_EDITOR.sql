-- ============================================================
-- PASTE THIS WHOLE FILE INTO THE LOVABLE CLOUD SQL EDITOR
-- Approved by Kila on 2026-08-24.
-- ============================================================
--
-- Purpose:
--   1. Let accepted Venture members list the other accepted participants.
--      Pending and declined applications remain visible only to the host.
--   2. Keep completed party rooms readable, but reject new messages after
--      close/end or the scheduled ends_at time.
--
-- Red-change safety:
--   - RLS access changes only; no user rows are updated or deleted.
--   - The transaction is atomic: either both policies land or neither does.
--   - Safe to run again: both policies are dropped and recreated by name.
--   - The preflight intentionally raises if the clock migration is missing.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ventures'
      and column_name = 'ends_at'
  ) then
    raise exception 'Preflight failed: public.ventures.ends_at is missing';
  end if;

  if to_regprocedure('public.is_venture_member(uuid,uuid)') is null then
    raise exception 'Preflight failed: public.is_venture_member(uuid,uuid) is missing';
  end if;
end
$$;

begin;

-- Migration 20260824034000_party_members_see_each_other.sql
drop policy if exists "Party members see each other" on public.venture_applications;

create policy "Party members see each other"
on public.venture_applications for select to authenticated
using (
  status = 'accepted'
  and public.is_venture_member(venture_id, auth.uid())
);

comment on policy "Party members see each other" on public.venture_applications is
  'Lets an accepted member list the other accepted members of the same Venture. Accepted rows only: declined and pending applicants stay visible to the host alone. Mirrors the venture_messages policy, which already exposes these identities in the party chat.';

-- Migration 20260824051000_archive_completed_venture_chat.sql
create or replace function public.is_venture_chat_open(_venture_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ventures v
    where v.id = _venture_id
      and coalesce(v.status, 'open') <> 'closed'
      and v.closed_at is null
      and v.ended_at is null
      and (v.ends_at is null or v.ends_at > now())
  )
$$;

revoke all on function public.is_venture_chat_open(uuid) from public, anon;
grant execute on function public.is_venture_chat_open(uuid) to authenticated;

drop policy if exists "Venture members send party chat" on public.venture_messages;

create policy "Venture members send party chat"
on public.venture_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.is_venture_member(venture_id, auth.uid())
  and public.is_venture_chat_open(venture_id)
);

comment on function public.is_venture_chat_open(uuid) is
  'True only while a Venture party room is writable. Completed rooms remain readable so members can see the recap and reconnect as Moots.';

commit;

-- ============================================================
-- VERIFY: both rows must return true.
-- Copy the result back to Codex/Claude if either is false.
-- ============================================================

select
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'venture_applications'
      and policyname = 'Party members see each other'
      and cmd = 'SELECT'
      and qual ilike '%status%accepted%'
      and qual ilike '%is_venture_member%'
  ) as accepted_members_policy_ready,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'venture_messages'
      and policyname = 'Venture members send party chat'
      and cmd = 'INSERT'
      and with_check ilike '%is_venture_chat_open%'
  )
  and has_function_privilege('authenticated', 'public.is_venture_chat_open(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.is_venture_chat_open(uuid)', 'EXECUTE')
    as completed_chat_policy_ready;
