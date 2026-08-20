-- 1) Rotate hardcoded push dispatch secret into Supabase Vault
do $$
declare
  v_id uuid;
  v_new text := '9f570ac62694cec98371f437a112b825e7d0e25365cf545a8c9697316017112b';
begin
  select id into v_id from vault.secrets where name = 'push_dispatch_secret';
  if v_id is null then
    perform vault.create_secret(v_new, 'push_dispatch_secret', 'Shared secret for push dispatch trigger');
  else
    perform vault.update_secret(v_id, v_new);
  end if;
end $$;

create or replace function public.dispatch_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  dispatch_url text := 'https://project--5e588783-4218-47ec-92d6-0d373760aeb8.lovable.app/api/public/push/dispatch';
  dispatch_secret text;
begin
  select decrypted_secret into dispatch_secret
  from vault.decrypted_secrets
  where name = 'push_dispatch_secret'
  limit 1;

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
  return new;
end;
$func$;

revoke all on function public.dispatch_push_for_notification() from public;
revoke all on function public.dispatch_push_for_notification() from anon;
revoke all on function public.dispatch_push_for_notification() from authenticated;

-- 2) Restrict tribe_messages SELECT to members of the tribe
-- LOCAL-DEV PATCH: original file order predates the table's creation
-- (20260517133500_create_tribe_messages.sql) when replayed fresh via
-- `supabase start`/`db reset`. Guarded so a from-scratch local database
-- doesn't error; on production the table already exists so this still runs.
do $$
begin
  if to_regclass('public.tribe_messages') is not null then
    drop policy if exists "Authenticated users can read tribe messages" on public.tribe_messages;

    create policy "Members read tribe messages"
      on public.tribe_messages
      for select
      to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and tribe_messages.tribe_id = any(p.tribe_ids)
        )
      );
  end if;
end $$;

-- 3) Drop overly broad public listing policy on avatars; public URLs still work via CDN
drop policy if exists "Avatars are publicly readable" on storage.objects;
