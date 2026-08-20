-- The push-dispatch trigger had its target URL hardcoded to a Lovable preview
-- domain:
--
--   dispatch_url text := 'https://project--5e588783-4218-47ec-92d6-0d373760aeb8.lovable.app/api/public/push/dispatch';
--
-- On any other deployment the trigger POSTs to that preview host, which either
-- 404s or reaches a stale build — and because the function ends with
-- `exception when others then return new`, the failure is completely silent.
-- Push notifications simply never arrive and nothing is logged.
--
-- This migration moves the URL into Vault next to the secret, and makes the
-- failure modes observable.
--
-- REQUIRED AFTER APPLYING — set the URL for whichever project this is:
--
--   select vault.create_secret(
--     'https://YOUR-DOMAIN/api/public/push/dispatch',
--     'push_dispatch_url',
--     'Absolute URL of the push dispatch endpoint for this environment'
--   );
--
-- To update it later:
--
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'push_dispatch_url'),
--     'https://YOUR-NEW-DOMAIN/api/public/push/dispatch'
--   );
--
-- Local development: point it at your dev server, e.g.
--   http://host.docker.internal:3000/api/public/push/dispatch
-- (the Postgres container cannot reach your host on localhost).
--
-- If the secret is unset the trigger now does nothing and logs a warning,
-- rather than firing requests at an unrelated domain.

create or replace function public.dispatch_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  dispatch_url text;
  dispatch_secret text;
begin
  select decrypted_secret into dispatch_url
  from vault.decrypted_secrets
  where name = 'push_dispatch_url'
  limit 1;

  if dispatch_url is null or length(trim(dispatch_url)) = 0 then
    raise log '[push] push_dispatch_url is not set in Vault; skipping dispatch for notification %', new.id;
    return new;
  end if;

  select decrypted_secret into dispatch_secret
  from vault.decrypted_secrets
  where name = 'push_dispatch_secret'
  limit 1;

  if dispatch_secret is null or length(trim(dispatch_secret)) = 0 then
    raise log '[push] push_dispatch_secret is not set in Vault; skipping dispatch for notification %', new.id;
    return new;
  end if;

  perform net.http_post(
    url := dispatch_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-push-secret', dispatch_secret
    )
  );

  return new;
exception when others then
  -- Still never block the INSERT that triggered this, but make the failure
  -- visible in the Postgres logs instead of discarding it entirely.
  raise log '[push] dispatch failed for notification %: % (%)', new.id, sqlerrm, sqlstate;
  return new;
end;
$func$;

revoke all on function public.dispatch_push_for_notification() from public;
revoke all on function public.dispatch_push_for_notification() from anon;
revoke all on function public.dispatch_push_for_notification() from authenticated;
