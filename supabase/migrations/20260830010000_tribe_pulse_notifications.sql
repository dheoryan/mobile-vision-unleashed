-- New Tribevia notification.
--
-- There is no cron in this stack (see CHANGE_PROTOCOL.md), so "a new day's
-- prompt is up" has no database row to hang a trigger off - the prompt
-- itself is computed client-side from the date, never stored. Instead,
-- whichever member's device is first to open the Tribe Room on a new day
-- calls fan_out_tribe_pulse_notification, which:
--   1. re-checks that the caller is actually a member of that tribe (this
--      function is security definer and therefore bypasses RLS internally,
--      so it must not trust the caller's own TanStack-layer membership
--      check - a hostile client could call the RPC directly otherwise, and
--      "insert notifications for people who never asked for them" is
--      exactly the class of bug this codebase's RLS is built to prevent);
--   2. de-dupes on the exact prompt id rather than a calendar-day window, so
--      several members' devices racing to be first cannot double-fan-out and
--      timezone edges can't cause a miss or a repeat.

alter table public.notifications
  add column if not exists tribe_pulse_prompt_id text;

create index if not exists idx_notifications_tribe_pulse_prompt
  on public.notifications(tribe_pulse_prompt_id)
  where kind = 'tribe_pulse';

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array[
    'like','comment','reply','mention','follow','message','new_post',
    'venture_apply','venture_invite','venture_accept','venture_message',
    'tribe_join','hello','hello_accepted','tribe_pulse'
  ]));

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

  insert into public.notifications (user_id, kind, preview, tribe_pulse_prompt_id)
  select p.id, 'tribe_pulse', left(p_preview, 200), p_prompt_id
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
  'Notifies every other member of a tribe once per day''s Tribevia prompt. Re-validates caller membership internally since it is security definer.';
