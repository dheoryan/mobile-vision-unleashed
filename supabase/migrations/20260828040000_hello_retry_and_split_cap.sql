-- Hello retry cooldown and context-split monthly cap (user decision, 2026-08-28).
--
-- Confirmed shape (see DEVLOG.md "moots proposal" thread):
--   1. A Hello that was never answered, or was declined, can be retried
--      30 days after that state - EXCEPT if the recipient has blocked the
--      sender, which already stops all sends unconditionally (the existing
--      "not public.has_blocked(...)" clause on the insert policy below is
--      untouched by this migration and keeps working exactly as before).
--   2. The monthly send cap moves from a flat 5 to a context-split 30: it
--      only counts cross-Tribe cold contact. A Hello to someone you already
--      share a Tribe with, or an active Venture with, doesn't touch it.
--
-- This is Red under CHANGE_PROTOCOL.md - it drops a unique constraint and
-- replaces two triggers on an existing table with real production rows.

-- ---------- 1. allow more than one row per direction, over time ----------

alter table public.hellos drop constraint if exists hellos_one_per_pair;

-- A retry supersedes the stale pending row instead of coexisting with it
-- (see hellos_enforce_retry_window below), so at most one 'pending' row per
-- direction should ever exist. This index is the hard backstop against a
-- concurrent double-send race; the trigger is what makes that the common
-- case never even reach it.
create unique index if not exists hellos_one_pending_per_pair
  on public.hellos(sender_id, recipient_id)
  where status = 'pending';

alter table public.hellos drop constraint if exists hellos_status_check;
alter table public.hellos add constraint hellos_status_check
  check (status in ('pending', 'accepted', 'declined', 'expired'));

-- ---------- 2. retry window ----------

create or replace function public.hellos_enforce_retry_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_row record;
begin
  select id, status, created_at, decided_at
  into last_row
  from public.hellos
  where sender_id = new.sender_id and recipient_id = new.recipient_id
  order by created_at desc
  limit 1;

  -- First-ever Hello in this direction: nothing to check.
  if last_row is null then
    return new;
  end if;

  if last_row.status = 'accepted' then
    raise exception 'You are already Moots with this person';
  end if;

  if last_row.status = 'pending' then
    if last_row.created_at > now() - interval '30 days' then
      raise exception 'This Hello is still waiting on an answer'
        using hint = 'You can try again 30 days after you sent it.';
    end if;
    -- Unanswered for 30+ days: supersede it rather than leaving two
    -- 'pending' rows for the same direction. hellos_guard allows this
    -- transition (old.status = 'pending') and stamps decided_at itself.
    update public.hellos set status = 'expired' where id = last_row.id;
    return new;
  end if;

  if last_row.status = 'declined' and last_row.decided_at > now() - interval '30 days' then
    raise exception 'You can try again 30 days after a decline';
  end if;

  -- declined and past the cooldown, or already expired: free to retry.
  return new;
end;
$$;

revoke all on function public.hellos_enforce_retry_window() from public, anon, authenticated;

drop trigger if exists trg_hellos_retry_window on public.hellos;
create trigger trg_hellos_retry_window
before insert on public.hellos
for each row execute function public.hellos_enforce_retry_window();

-- ---------- 3. context-split cap ----------

-- true = this pair is cold cross-Tribe contact and should count against the
-- cap. false = they already share a Tribe, or an active Venture together -
-- not the cold-outreach pattern the cap exists to ration.
create or replace function public.hello_is_capped(_sender uuid, _recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not (
    exists (
      select 1
      from public.profiles pa, public.profiles pb
      where pa.id = _sender and pb.id = _recipient and pa.tribe_ids && pb.tribe_ids
    )
    or exists (
      select 1
      from public.ventures v
      where coalesce(v.status, 'open') <> 'closed'
        and (
          (v.user_id = _sender and public.is_venture_member(v.id, _recipient))
          or (v.user_id = _recipient and public.is_venture_member(v.id, _sender))
          or (public.is_venture_member(v.id, _sender) and public.is_venture_member(v.id, _recipient))
        )
    )
  );
$$;

revoke all on function public.hello_is_capped(uuid, uuid) from public, anon;
grant execute on function public.hello_is_capped(uuid, uuid) to authenticated;

-- How many capped Hellos this user has sent since the start of the month.
-- Powers the "N Hellos left this month" copy - kept as its own function
-- rather than inlined in the app so the number shown always matches exactly
-- what the trigger below enforces.
create or replace function public.hellos_capped_sent_this_month(_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.hellos h
  where h.sender_id = _user_id
    and h.created_at >= date_trunc('month', now())
    and public.hello_is_capped(h.sender_id, h.recipient_id);
$$;

revoke all on function public.hellos_capped_sent_this_month(uuid) from public, anon;
grant execute on function public.hellos_capped_sent_this_month(uuid) to authenticated;

create or replace function public.hellos_enforce_monthly_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sent_this_month int;
  monthly_cap constant int := 30;
begin
  if not public.hello_is_capped(new.sender_id, new.recipient_id) then
    return new;
  end if;

  select public.hellos_capped_sent_this_month(new.sender_id) into sent_this_month;

  if sent_this_month >= monthly_cap then
    raise exception 'You have used all % Hellos this month', monthly_cap
      using hint = 'Hellos reset at the start of each month. Hellos to someone in your Tribe or an active Venture with you don''t count against this.';
  end if;

  return new;
end;
$$;

comment on function public.hellos_enforce_retry_window() is
  'A declined or unanswered Hello can be retried 30 days later; an accepted one never needs to be. Blocking is enforced separately by the existing insert policy and is unaffected by this.';
comment on function public.hello_is_capped(uuid, uuid) is
  'Whether a Hello between these two counts against the monthly cap: false for same-Tribe or active-shared-Venture pairs, true otherwise.';
