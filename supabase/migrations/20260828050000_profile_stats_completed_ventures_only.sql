-- Hosted/Joined should mean "actually happened," not "signed up for" (user
-- decision, 2026-08-28) - consistent with how the rest of the app already
-- treats a closed Venture as the real, done thing (Venture Memories, the
-- Moot recap). Without this, a cancelled or still-upcoming Venture already
-- inflated both numbers the moment it was created or accepted into.
--
-- Replaces get_profile_stats from 20260828030000_profile_relationship_stats.sql
-- in place - same function, same grants, only the two counts' predicates
-- change. Moots is untouched: an accepted Hello is already the deliberate,
-- two-way confirmed state, there's no earlier "not yet happened" phase for it.
create or replace function public.get_profile_stats(_target_id uuid)
returns table(moots_count integer, hosted_count integer, joined_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      select count(*)::int
      from public.hellos h
      where h.status = 'accepted'
        and (h.sender_id = _target_id or h.recipient_id = _target_id)
    ) as moots_count,
    (
      select count(*)::int
      from public.ventures v
      where v.user_id = _target_id
        and v.status = 'closed'
    ) as hosted_count,
    (
      select count(*)::int
      from public.venture_applications a
      join public.ventures v on v.id = a.venture_id
      where a.applicant_id = _target_id
        and a.status = 'accepted'
        and v.status = 'closed'
    ) as joined_count;
$$;

revoke all on function public.get_profile_stats(uuid) from public, anon;
grant execute on function public.get_profile_stats(uuid) to authenticated;

comment on function public.get_profile_stats(uuid) is
  'Moots/Hosted/Joined counts for the profile stat row. Hosted and Joined only count closed (completed) Ventures. Aggregates only - never exposes which Hellos or Ventures, just how many. Callable for any profile, matching the existing public exposure of profiles.venture_count.';
