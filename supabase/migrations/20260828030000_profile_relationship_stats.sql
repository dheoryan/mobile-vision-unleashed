-- Profile stat row is moving from Following/Followers/Posts to
-- Moots / Hosted / Joined (user decision, 2026-08-28).
--
-- All three numbers need to be readable for an ARBITRARY profile, not just
-- your own, and none of the three source tables grant that under their
-- existing RLS:
--   - hellos:               "sender_id = auth.uid() or recipient_id = auth.uid()"
--   - ventures:              your own, ones you applied to, or others' *open* ones
--   - venture_applications:  effectively applicant/host only
-- A plain client query for someone else's counts would not error, it would
-- just silently return a number too low (often zero) - the exact "access
-- change fails silently" failure mode this repo's CHANGE_PROTOCOL exists for.
--
-- One SECURITY DEFINER function, same shape as is_venture_scope_visible and
-- can_direct_message: it deliberately reads across the RLS boundary, but can
-- only ever hand back three integers - never a row, a title, or a date.
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
    ) as hosted_count,
    (
      select count(*)::int
      from public.venture_applications a
      where a.applicant_id = _target_id
        and a.status = 'accepted'
    ) as joined_count;
$$;

revoke all on function public.get_profile_stats(uuid) from public, anon;
grant execute on function public.get_profile_stats(uuid) to authenticated;

comment on function public.get_profile_stats(uuid) is
  'Moots/Hosted/Joined counts for the profile stat row. Aggregates only - never exposes which Hellos or Ventures, just how many. Callable for any profile, matching the existing public exposure of profiles.venture_count.';
