-- HELLO, and gating who may open a DM.
--
-- Product decision (user, 2026-08-20): the Global timeline is look-but-don't-
-- touch. You can see, like, comment on and repost anyone's global post, but you
-- cannot slide into their DMs from it. Private contact with someone outside your
-- Tribe has to be earned rather than assumed.
--
-- Why this matters beyond product taste: unsolicited stranger DMs are the
-- primary harassment vector in this category, and until now any authenticated
-- user could message any other with no relationship required at all. Requiring a
-- deliberate, rationed, single-shot request is a real protection.
--
-- The release valve is a Hello: one short message request. Accept and a normal
-- thread opens; decline and the sender cannot try again. Without it, "you must
-- find them through Explore" would be a dead end — the app would show you
-- someone and then hide them.
--
-- "Hello" already existed in the product's vocabulary (the pricing copy sells
-- "3 Hellos / month", VenturesScreen threads an onSendHello prop) but was never
-- built. This gives that concept its job.

-- ---------- 1. hellos ----------

create table if not exists public.hellos (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(btrim(message)) between 1 and 280),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint hellos_no_self check (sender_id <> recipient_id),
  -- One Hello per direction, ever. A declined Hello cannot be retried: that is
  -- the whole point — it makes "no" final instead of an invitation to persist.
  constraint hellos_one_per_pair unique (sender_id, recipient_id)
);

create index if not exists hellos_recipient_idx on public.hellos(recipient_id, status, created_at desc);
create index if not exists hellos_sender_idx on public.hellos(sender_id, created_at desc);

alter table public.hellos enable row level security;

create policy "Participants read their hellos"
  on public.hellos for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "Senders create their own hellos"
  on public.hellos for insert to authenticated
  with check (
    sender_id = auth.uid()
    and status = 'pending'
    and not public.has_blocked(auth.uid(), recipient_id)
  );

-- ONE update policy, not several. Postgres OR-combines permissive policies of
-- the same command separately for USING and WITH CHECK, so a row need only
-- satisfy *some* USING and *some* WITH CHECK — splitting this into
-- "recipient accepts" / "recipient declines" would let the two halves be mixed
-- and matched. That exact mistake was the venture_applications self-accept
-- vulnerability. The legal transition is enforced in the trigger below, because
-- WITH CHECK cannot see OLD.
create policy "Recipients answer their hellos"
  on public.hellos for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid() and status in ('accepted', 'declined'));

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
    new.decided_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_hellos_guard on public.hellos;
create trigger trg_hellos_guard
before update on public.hellos
for each row execute function public.hellos_guard();

-- Monthly send cap. Anti-spam first: a rationed request is deliberate, an
-- unrationed one is a mail-merge. Deliberately plan-independent for now —
-- monetization is off, so a plan-gated cap would evaluate to unlimited for
-- everyone and the safety property would evaporate. Tier it when billing is real.
create or replace function public.hellos_enforce_monthly_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sent_this_month int;
  monthly_cap constant int := 5;
begin
  select count(*) into sent_this_month
  from public.hellos h
  where h.sender_id = new.sender_id
    and h.created_at >= date_trunc('month', now());

  if sent_this_month >= monthly_cap then
    raise exception 'You have used all % Hellos this month', monthly_cap
      using hint = 'Hellos reset at the start of each month.';
  end if;

  return new;
end;
$$;

revoke all on function public.hellos_enforce_monthly_cap() from public, anon, authenticated;

drop trigger if exists trg_hellos_monthly_cap on public.hellos;
create trigger trg_hellos_monthly_cap
before insert on public.hellos
for each row execute function public.hellos_enforce_monthly_cap();

-- ---------- 2. who may open a DM ----------

-- SECURITY DEFINER because every branch reads rows the caller cannot see under
-- RLS (the other person's Tribe, their side of a Hello, venture membership).
-- An inline sub-select would be silently RLS-filtered and evaluate false —
-- the same bug that made blocking one-way.
create or replace function public.can_direct_message(_a uuid, _b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _a is not null
    and _b is not null
    and _a <> _b
    and not public.has_blocked(_a, _b)
    and (
      -- Tribemates talk freely. Sharing a Tribe *is* the relationship.
      exists (
        select 1
        from public.profiles pa, public.profiles pb
        where pa.id = _a and pb.id = _b and pa.tribe_ids && pb.tribe_ids
      )
      -- An accepted Hello, in either direction.
      or exists (
        select 1 from public.hellos h
        where h.status = 'accepted'
          and ((h.sender_id = _a and h.recipient_id = _b)
            or (h.sender_id = _b and h.recipient_id = _a))
      )
      -- People who are actually going somewhere together. They already share a
      -- party chat; refusing them a DM would be theatre.
      or exists (
        select 1
        from public.ventures v
        where coalesce(v.status, 'open') <> 'closed'
          and (
            (v.user_id = _a and public.is_venture_member(v.id, _b))
            or (v.user_id = _b and public.is_venture_member(v.id, _a))
            or (public.is_venture_member(v.id, _a) and public.is_venture_member(v.id, _b))
          )
      )
      -- An existing thread. Prevents a conversation from being severed when
      -- someone switches Tribe; it is not a loophole, because the first message
      -- still had to satisfy one of the branches above.
      or exists (
        select 1 from public.messages m
        where (m.sender_id = _a and m.recipient_id = _b)
           or (m.sender_id = _b and m.recipient_id = _a)
      )
    );
$$;

revoke all on function public.can_direct_message(uuid, uuid) from public, anon;
grant execute on function public.can_direct_message(uuid, uuid) to authenticated;

drop policy if exists "Senders insert messages" on public.messages;
create policy "Senders insert messages"
on public.messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and not public.has_blocked(auth.uid(), recipient_id)
  and public.can_direct_message(auth.uid(), recipient_id)
);

-- ---------- 3. notify the recipient ----------

-- Give Hellos their own notification kinds. Reusing 'message' is what made the
-- Venture notifications read as "sent you a message" when someone applied to a
-- Venture, leaving three fully-styled notification types unreachable. Not
-- repeating that.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array[
    'like', 'comment', 'reply', 'mention', 'follow', 'message', 'new_post',
    'venture_apply', 'venture_invite', 'venture_accept', 'venture_message', 'tribe_join',
    'hello', 'hello_accepted'
  ]));

create or replace function public.notify_on_hello()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, actor_id, kind, preview)
    values (new.recipient_id, new.sender_id, 'hello', left(new.message, 140));
  elsif new.status = 'accepted' and old.status = 'pending' then
    insert into public.notifications (user_id, actor_id, kind, preview)
    values (new.sender_id, new.recipient_id, 'hello_accepted', 'accepted your Hello');
  end if;
  return null;
end;
$$;

revoke all on function public.notify_on_hello() from public, anon, authenticated;

drop trigger if exists trg_notify_on_hello on public.hellos;
create trigger trg_notify_on_hello
after insert or update of status on public.hellos
for each row execute function public.notify_on_hello();
