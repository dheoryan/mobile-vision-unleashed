-- The push-dispatch shared secret was previously hardcoded in plaintext inside
-- migration 20260517012906 (and, before that, 20260515023826). Both of those
-- files are committed to the public GitHub repo, so anyone who reads the repo
-- history already has that secret memorized by the pg_net trigger below and by
-- the /api/public/push/dispatch endpoint's PUSH_DISPATCH_SECRET env var. A
-- secret that ships in source control is not a secret.
--
-- This migration replaces it with a value nobody (including this file) ever
-- writes down: it's generated server-side, at apply time, straight into
-- Supabase Vault. Nothing in git ever contains the plaintext.
--
-- IMPORTANT — after applying this migration you must retrieve the new value
-- and put it in your app's PUSH_DISPATCH_SECRET env var (local .dev.vars /
-- .env for `wrangler dev`, and your Cloudflare Worker's secret store for
-- production), or push notifications will silently stop dispatching (the
-- endpoint will 401 and the trigger swallows the error). Retrieve it with:
--
--   select decrypted_secret from vault.decrypted_secrets
--   where name = 'push_dispatch_secret';
--
-- Run that in Supabase Studio's SQL editor (local: http://127.0.0.1:54323,
-- production: your hosted project's dashboard) against WHICHEVER project you
-- want the new secret for — this migration only rotates the project it's
-- applied to. It must be applied and rotated separately on your hosted
-- production project too; I have no access to that project from here.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_id uuid;
  v_new text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select id into v_id from vault.secrets where name = 'push_dispatch_secret';
  if v_id is null then
    perform vault.create_secret(v_new, 'push_dispatch_secret', 'Shared secret for push dispatch trigger');
  else
    perform vault.update_secret(v_id, v_new);
  end if;
end $$;
