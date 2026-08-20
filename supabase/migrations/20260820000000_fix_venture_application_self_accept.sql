-- SECURITY FIX: any authenticated user could accept themselves into any open
-- Venture, gaining the private party chat and the meetup location without the
-- host's approval.
--
-- Root cause: two separate permissive UPDATE policies existed for applicants —
--
--   "Applicants cancel own applications"
--       using       (applicant_id = auth.uid())
--       with check  (applicant_id = auth.uid() and status = 'cancelled')
--
--   "Applicants respond to own venture invites"
--       using       (applicant_id = auth.uid() and status = 'invited')
--       with check  (applicant_id = auth.uid() and status in ('accepted','declined'))
--
-- PostgreSQL OR-combines permissive policies of the same command SEPARATELY for
-- USING and for WITH CHECK. A row therefore only has to satisfy *some* USING and
-- *some* WITH CHECK — not both halves of the same policy. So an attacker could
-- apply to any open venture (status 'pending'), then PATCH their own row to
-- status 'accepted': USING passed via the first policy, WITH CHECK via the
-- second. The existing immutable-fields trigger did not catch it because only
-- `status` changed.
--
-- Fix, in two layers:
--   1. Collapse the two applicant policies into ONE, so USING and WITH CHECK
--      can no longer be mixed and matched across policies.
--   2. Enforce the legal OLD -> NEW status transitions in the BEFORE UPDATE
--      trigger. This has to be a trigger rather than a policy because WITH CHECK
--      cannot see OLD, and the whole vulnerability is about the transition.

-- ---------- 1. one policy instead of two ----------

drop policy if exists "Applicants cancel own applications" on public.venture_applications;
drop policy if exists "Applicants respond to own venture invites" on public.venture_applications;

create policy "Applicants update own applications"
on public.venture_applications
for update
to authenticated
using (applicant_id = auth.uid())
with check (
  applicant_id = auth.uid()
  and status in ('cancelled', 'accepted', 'declined')
);

-- ---------- 2. transition rules in the guard trigger ----------

create or replace function public.venture_applications_guard_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Identity columns can never move (pre-existing rule, retained).
  if new.applicant_id is distinct from old.applicant_id
     or new.venture_id is distinct from old.venture_id
     or new.id is distinct from old.id then
    raise exception 'applicant_id, venture_id and id cannot be changed';
  end if;

  -- No JWT => service_role or a SECURITY DEFINER path. RLS is already bypassed
  -- there by design, so don't second-guess it.
  if auth.uid() is null then
    return new;
  end if;

  -- The host decides applications; RLS ("Hosts decide venture applications")
  -- already constrains which rows and which target statuses they may write.
  if public.is_venture_host(new.venture_id, auth.uid()) then
    return new;
  end if;

  -- Applicant path. Only two transitions are legitimate.
  if new.status is distinct from old.status then
    if new.status = 'cancelled' then
      -- Withdrawing your own application is always allowed.
      null;
    elsif old.status = 'invited' and new.status in ('accepted', 'declined') then
      -- Responding to an invite the host actually issued.
      null;
    else
      raise exception
        'applicants cannot move an application from % to %', old.status, new.status
        using hint = 'Only the host can accept or reject an application.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_venture_applications_guard on public.venture_applications;
create trigger trg_venture_applications_guard
before update on public.venture_applications
for each row execute function public.venture_applications_guard_immutable_fields();
