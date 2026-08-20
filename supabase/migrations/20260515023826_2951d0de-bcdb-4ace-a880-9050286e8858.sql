create or replace function public.dispatch_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  dispatch_url text := 'https://project--5e588783-4218-47ec-92d6-0d373760aeb8.lovable.app/api/public/push/dispatch';
  dispatch_secret text := 'mtl_psh_8f4a2c6e9d1b7a3f5e8c2d6b9a4f7e1c3d5b8a2f6e9c4d7b1a5f8e3c6d9b2a4f';
begin
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