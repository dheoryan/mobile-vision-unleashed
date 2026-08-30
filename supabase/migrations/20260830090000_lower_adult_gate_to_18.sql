-- MEUTUALS remains adult-only, with 18 as the minimum age.
-- This is a forward migration because the former threshold is already deployed.

alter table public.profiles
  drop constraint if exists profiles_age_check;

alter table public.profiles
  add constraint profiles_age_check check (age is null or age >= 18);

create or replace function public.apply_profile_age_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  years integer;
begin
  if new.date_of_birth is distinct from old.date_of_birth then
    if old.date_of_birth is not null then
      raise exception 'Date of birth cannot be changed after verification';
    end if;

    if new.date_of_birth is null
      or new.date_of_birth > current_date
      or new.date_of_birth < (current_date - interval '120 years')::date then
      raise exception 'Invalid date of birth';
    end if;

    years := public.age_in_years(new.date_of_birth);
    if years >= 18 then
      new.age := years;
      new.adult_verified_at := now();
      new.age_verification_locked_at := null;
    else
      new.age := null;
      new.adult_verified_at := null;
      new.age_verification_locked_at := now();
    end if;
  elsif new.age is distinct from old.age
    or new.adult_verified_at is distinct from old.adult_verified_at
    or new.age_verification_locked_at is distinct from old.age_verification_locked_at then
    raise exception 'Age verification fields cannot be edited directly';
  end if;

  return new;
end;
$$;

revoke all on function public.apply_profile_age_verification() from public;
revoke execute on function public.apply_profile_age_verification() from anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dob_text text;
  dob date;
  years integer;
begin
  dob_text := nullif(new.raw_user_meta_data->>'date_of_birth', '');

  if dob_text is not null then
    begin
      dob := dob_text::date;
    exception when others then
      raise exception 'Invalid date of birth';
    end;

    if dob > current_date or dob < (current_date - interval '120 years')::date then
      raise exception 'Invalid date of birth';
    end if;

    years := public.age_in_years(dob);
  end if;

  insert into public.profiles (
    id,
    display_name,
    date_of_birth,
    age,
    adult_verified_at,
    age_verification_locked_at
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    dob,
    case when years >= 18 then years else null end,
    case when years >= 18 then now() else null end,
    case when years is not null and years < 18 then now() else null end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- The first submitted DOB is immutable. Re-evaluate only accounts that were
-- locked by the former threshold and are adults under the new policy.
drop trigger if exists apply_profile_age_verification_before_update on public.profiles;

update public.profiles
set age = public.age_in_years(date_of_birth),
    adult_verified_at = coalesce(adult_verified_at, now()),
    age_verification_locked_at = null
where date_of_birth is not null
  and public.age_in_years(date_of_birth) >= 18
  and adult_verified_at is null;

create trigger apply_profile_age_verification_before_update
before update on public.profiles
for each row execute function public.apply_profile_age_verification();

create or replace function public.is_verified_adult(profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not public.adult_gate_enabled()
    or exists (
      select 1
      from public.profiles p
      where p.id = profile_id
        and p.adult_verified_at is not null
        and p.age >= 18
        and p.suspended_at is null
    )
$$;

revoke all on function public.is_verified_adult(uuid) from public;
revoke execute on function public.is_verified_adult(uuid) from anon;
grant execute on function public.is_verified_adult(uuid) to authenticated, service_role;

comment on column public.profiles.adult_verified_at is
  'Non-null only after Postgres verifies the immutable DOB is age 18+.';

comment on function public.is_verified_adult(uuid) is
  'True when the adult gate is disabled, or when the profile is a verified, non-suspended 18+ adult.';
