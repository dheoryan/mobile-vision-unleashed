-- LOCAL-DEV ONLY: base role grants on the public schema.
-- On a hosted Supabase project these are applied automatically at project
-- provisioning time and were never captured in a migration file, so a
-- fresh `supabase start`/`db reset` never gets them. RLS policies still
-- fully govern row-level access for anon/authenticated — this migration
-- only restores the baseline table/sequence/routine privileges Postgres
-- checks before RLS is even evaluated.
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
