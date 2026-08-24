-- A later Lovable-generated migration wrote the active push dispatch secret
-- into source control again. Rotate it after every earlier push migration has
-- replayed so the value left in Vault is generated only inside Postgres and
-- never appears in Git.
--
-- RED under CHANGE_PROTOCOL: production application is manual. After running
-- this SQL, copy the new Vault value directly into the Lovable secret named
-- PUSH_DISPATCH_SECRET. Never paste that value into Git, DEVLOG, or chat.

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_id uuid;
  v_new text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select id into v_id
  from vault.secrets
  where name = 'push_dispatch_secret';

  if v_id is null then
    perform vault.create_secret(
      v_new,
      'push_dispatch_secret',
      'Shared secret for push dispatch trigger'
    );
  else
    perform vault.update_secret(v_id, v_new);
  end if;
end $$;
