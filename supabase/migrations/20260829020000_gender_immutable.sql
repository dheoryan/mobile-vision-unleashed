-- Gender may be set once and never changed after that, by request. Same
-- "immutable after first set" shape as date_of_birth
-- (20260820000900_enforce_adult_verification.sql), just without the age
-- computation - a plain BEFORE UPDATE trigger, since a policy alone cannot
-- compare OLD and NEW on the same row (see CHANGE_PROTOCOL.md 2.1). The
-- client (Onboarding, Edit profile) also disables the control once a value
-- is set, but that's UX only - this trigger is the actual enforcement.
create or replace function public.enforce_gender_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.gender is not null and new.gender is distinct from old.gender then
    raise exception 'Gender cannot be changed after it is set';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_gender_immutable() from public;
revoke execute on function public.enforce_gender_immutable() from anon, authenticated;

drop trigger if exists enforce_gender_immutable_before_update on public.profiles;
create trigger enforce_gender_immutable_before_update
before update on public.profiles
for each row execute function public.enforce_gender_immutable();

comment on column public.profiles.gender is
  'Immutable once set - enforced by enforce_gender_immutable_before_update, not just the client UI.';
