do $$
declare v_req bigint;
begin
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='push_dispatch_url'),
    body := jsonb_build_object('notification_id', (select id::text from public.notifications order by created_at desc limit 1)),
    headers := jsonb_build_object('content-type','application/json','x-push-secret',(select decrypted_secret from vault.decrypted_secrets where name='push_dispatch_secret'))
  ) into v_req;
  raise log '[push] verify request %', v_req;
end $$;