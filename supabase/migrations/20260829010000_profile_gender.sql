-- Gender is a new, optional-for-existing-rows profile attribute. Required at
-- signup going forward (enforced client-side in Onboarding, same as the
-- rest of the social-profile fields), but existing accounts predate this
-- column and stay NULL until they set it themselves via Edit profile -
-- nothing here backfills or forces a value onto a live row.
alter table public.profiles
  add column if not exists gender text;

alter table public.profiles
  add constraint profiles_gender_allowed check (
    gender is null or gender in ('woman', 'man', 'non_binary')
  );
