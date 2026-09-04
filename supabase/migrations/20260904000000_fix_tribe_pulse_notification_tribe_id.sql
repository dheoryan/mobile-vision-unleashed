-- Fix: Tribevia notifications never set notifications.tribe_id.
--
-- fan_out_tribe_pulse_notification (20260830010000_tribe_pulse_notifications.sql)
-- inserts every 'tribe_pulse' notification without a tribe_id, so the app's
-- notification-tap routing (notificationDestination in
-- notification-presenter.ts, which needs item.tribe_id to send someone to
-- the right Tribe) had nothing to route on and silently fell back to the
-- Feed tab instead. p_tribe_key is already the same stable Tribe key
-- (`wolf`, `koi`, ...) that notifications.tribe_id stores for tribe_join and
-- mention-in-tribe rows (see the comment in listNotifications,
-- src/lib/notifications.functions.ts) - just needs to be included in the
-- insert.
--
-- Function replacement only - no table/constraint change, so this is
-- additive/safe the same way every function-only fix in this project is.

create or replace function public.fan_out_tribe_pulse_notification(
  p_tribe_key text,
  p_prompt_id text,
  p_preview text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if p_tribe_key is null or p_prompt_id is null or p_preview is null then
    return 0;
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid()
      and tribe_ids @> array[p_tribe_key]::text[]
  ) then
    raise exception 'Not a member of this tribe';
  end if;

  if exists (
    select 1 from public.notifications
    where kind = 'tribe_pulse' and tribe_pulse_prompt_id = p_prompt_id
  ) then
    return 0;
  end if;

  insert into public.notifications (user_id, kind, preview, tribe_pulse_prompt_id, tribe_id)
  select p.id, 'tribe_pulse', left(p_preview, 200), p_prompt_id, p_tribe_key
  from public.profiles p
  where p.tribe_ids @> array[p_tribe_key]::text[]
    and p.id <> auth.uid();

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.fan_out_tribe_pulse_notification(text, text, text) from public, anon;
grant execute on function public.fan_out_tribe_pulse_notification(text, text, text) to authenticated;

comment on function public.fan_out_tribe_pulse_notification(text, text, text) is
  'Notifies every other member of a tribe once per day''s Tribevia prompt. Re-validates caller membership internally since it is security definer. Sets tribe_id so the app can route a tap to the right Tribe.';
