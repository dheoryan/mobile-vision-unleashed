create or replace function public.enforce_venture_application_transitions()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  is_host boolean;
begin
  if uid is null then
    return new;
  end if;

  is_host := public.is_venture_host(new.venture_id, uid);

  if new.id is distinct from old.id
     or new.venture_id is distinct from old.venture_id
     or new.applicant_id is distinct from old.applicant_id then
    raise exception 'Application identity cannot be changed';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if is_host and uid is distinct from new.applicant_id then
    if not (
      (old.status = 'pending' and new.status in ('accepted', 'rejected', 'declined', 'invited'))
      or (old.status = 'invited' and new.status in ('rejected', 'declined', 'cancelled'))
      or (old.status = 'accepted' and new.status in ('cancelled', 'rejected'))
    ) then
      raise exception 'A host cannot move an application from % to %', old.status, new.status;
    end if;
    return new;
  end if;

  if uid = new.applicant_id then
    if not (
      (old.status = 'invited' and new.status in ('accepted', 'declined', 'cancelled'))
      or (old.status = 'pending' and new.status = 'cancelled')
      or (old.status = 'accepted' and new.status = 'cancelled')
    ) then
      raise exception 'You cannot move your application from % to %', old.status, new.status
        using hint = 'Only the host can accept a pending request.';
    end if;
    return new;
  end if;

  raise exception 'Not allowed to change this application';
end;
$$;

drop trigger if exists trg_enforce_venture_application_transitions on public.venture_applications;
create trigger trg_enforce_venture_application_transitions
before update on public.venture_applications
for each row execute function public.enforce_venture_application_transitions();

drop policy if exists "Applicants update own applications" on public.venture_applications;
create policy "Applicants update own applications"
on public.venture_applications
for update
to authenticated
using (applicant_id = auth.uid() and status in ('pending', 'invited', 'accepted'))
with check (applicant_id = auth.uid() and status in ('cancelled', 'accepted', 'declined'));