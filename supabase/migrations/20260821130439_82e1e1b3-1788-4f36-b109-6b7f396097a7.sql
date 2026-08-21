do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'push_dispatch_secret';
  if v_id is null then
    perform vault.create_secret('171f88ecb9b89717e97a97aa9397444e9fa7962c16cba1cfa99b46034755962a', 'push_dispatch_secret', 'Shared secret for push dispatch trigger');
  else
    perform vault.update_secret(v_id, '171f88ecb9b89717e97a97aa9397444e9fa7962c16cba1cfa99b46034755962a');
  end if;
end $$;