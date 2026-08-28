-- Sender can cancel their own pending Hello, and a cancelled Hello is
-- refunded from the monthly cap (user decision, 2026-08-28).
--
-- Cancelling is different from being declined: the sender changed their own
-- mind before anyone answered, rather than receiving a "no" - so it doesn't
-- cost the monthly allowance, and (per hellos_enforce_retry_window, already
-- unchanged by this migration) it doesn't carry a 30-day cooldown either.
-- Neither branch of that trigger matches 'cancelled', so a retry after a
-- cancel already falls through to "allowed" for free.
--
-- This is Red under CHANGE_PROTOCOL.md - it replaces the RLS update policy
-- and a trigger on an existing table with real rows.

alter table public.hellos drop constraint if exists hellos_status_check;
alter table public.hellos add constraint hellos_status_check
  check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled'));

-- ---------- 1. let the sender update their own row too ----------
--
-- Landmine 2.1 (see AGENTS.md): a second permissive UPDATE policy would let
-- Postgres OR-combine USING and WITH CHECK across both policies separately -
-- exactly the bug that made Venture self-accept possible. One policy, wide
-- enough for both participants; the trigger below is what actually decides
-- who may make which transition.
drop policy if exists "Recipients answer their hellos" on public.hellos;
create policy "Participants update their own side of a hello"
  on public.hellos for update to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid())
  with check (sender_id = auth.uid() or recipient_id = auth.uid());

create or replace function public.hellos_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.message is distinct from old.message then
    raise exception 'A Hello''s participants and message are immutable';
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'pending' then
      raise exception 'This Hello has already been answered';
    end if;

    if new.status in ('accepted', 'declined') then
      if auth.uid() is distinct from old.recipient_id then
        raise exception 'Only the recipient can answer a Hello';
      end if;
    elsif new.status = 'cancelled' then
      if auth.uid() is distinct from old.sender_id then
        raise exception 'Only the sender can cancel a Hello';
      end if;
    else
      raise exception 'Invalid Hello status transition';
    end if;

    new.decided_at := now();
  end if;

  return new;
end;
$$;

-- ---------- 2. refund: a cancelled Hello never counted, going forward ----------

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
    and h.status <> 'cancelled'
    and public.hello_is_capped(h.sender_id, h.recipient_id);
$$;

comment on function public.hellos_guard() is
  'Enforces Hello transition rules: participants/message are immutable, a row can only be decided once, and only the recipient may accept/decline while only the sender may cancel.';
comment on function public.hellos_capped_sent_this_month(uuid) is
  'Capped Hellos sent this month, excluding cancelled ones - matches hellos_enforce_monthly_cap so the displayed count and the enforced cap never drift.';
