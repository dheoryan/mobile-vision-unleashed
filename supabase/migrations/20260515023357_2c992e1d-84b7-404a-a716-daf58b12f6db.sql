create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.push_subscriptions enable row level security;

create policy "own subs read"
  on public.push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "own subs delete"
  on public.push_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);

create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

create extension if not exists pg_net with schema extensions;

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
  begin
    dispatch_secret := current_setting('app.push_dispatch_secret', true);
  exception when others then
    dispatch_secret := null;
  end;

  perform net.http_post(
    url := dispatch_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-push-secret', coalesce(dispatch_secret, '')
    )
  );
  return new;
exception when others then
  return new;
end;
$func$;

drop trigger if exists notifications_dispatch_push on public.notifications;
create trigger notifications_dispatch_push
  after insert on public.notifications
  for each row execute function public.dispatch_push_for_notification();