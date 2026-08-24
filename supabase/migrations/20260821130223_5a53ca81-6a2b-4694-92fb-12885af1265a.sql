do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'push_dispatch_url';
  if v_id is null then
    perform vault.create_secret('https://moots.lovable.app/api/public/push/dispatch', 'push_dispatch_url', 'Absolute URL of the push dispatch endpoint');
  else
    perform vault.update_secret(v_id, 'https://moots.lovable.app/api/public/push/dispatch');
  end if;
end $$;