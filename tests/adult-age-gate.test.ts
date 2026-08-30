import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const ageSource = read("src/lib/age.ts");
const migration = read("supabase/migrations/20260830090000_lower_adult_gate_to_18.sql");

test("the client-side eligibility boundary is 18", () => {
  assert.match(ageSource, /export const MINIMUM_AGE = 18;/);
  assert.match(ageSource, /AGE_RETRY_KEY = "meutuals\.age-retry-after\.v2"/);
  assert.match(ageSource, /today\.getFullYear\(\) - MINIMUM_AGE/);
});

test("the forward migration lowers every active server-side age boundary", () => {
  assert.match(migration, /profiles_age_check check \(age is null or age >= 18\)/);
  assert.match(migration, /create or replace function public\.apply_profile_age_verification/);
  assert.match(migration, /create or replace function public\.handle_new_user/);
  assert.match(migration, /create or replace function public\.is_verified_adult/);
  assert.match(migration, /and p\.age >= 18/);
  assert.match(migration, /public\.age_in_years\(date_of_birth\) >= 18/);
  assert.doesNotMatch(migration, />= 21|< 21|21\+ adult/);
});

test("member-facing age copy consistently says 18+", () => {
  for (const path of [
    "src/components/mutuals/Onboarding.tsx",
    "src/routes/signup.tsx",
    "src/routes/__root.tsx",
    "src/routes/p.$postId.tsx",
    "src/routes/terms.tsx",
    "src/routes/privacy.tsx",
    "public/manifest.webmanifest",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /21\+|21 years old|21\+ rule/, `${path} contains stale 21+ copy`);
  }
});
