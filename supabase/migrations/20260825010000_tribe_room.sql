-- Tribe Room participation primitives.
--
-- Daily Pulse answers, plan proposals, and Venture announcements remain in
-- tribe_messages so the room has one chronological stream. Structured data is
-- bounded JSON, while reactions and read state are normalized because both
-- are per-user facts.

alter table public.tribe_messages
  add column if not exists room_kind text,
  add column if not exists room_metadata jsonb not null default '{}'::jsonb;

alter table public.tribe_messages
  drop constraint if exists tribe_messages_room_kind_valid;

alter table public.tribe_messages
  add constraint tribe_messages_room_kind_valid
  check (room_kind is null or room_kind in ('pulse_answer', 'plan', 'venture'));

alter table public.tribe_messages
  drop constraint if exists tribe_messages_room_metadata_bounded;

alter table public.tribe_messages
  add constraint tribe_messages_room_metadata_bounded
  check (octet_length(room_metadata::text) <= 4096);

alter table public.tribe_messages
  drop constraint if exists tribe_messages_room_metadata_shape;

alter table public.tribe_messages
  add constraint tribe_messages_room_metadata_shape
  check (
    room_kind is null
    or (
      room_kind = 'pulse_answer'
      and jsonb_typeof(room_metadata -> 'prompt_id') = 'string'
      and jsonb_typeof(room_metadata -> 'prompt') = 'string'
    )
    or (
      room_kind = 'plan'
      and jsonb_typeof(room_metadata -> 'when_label') = 'string'
      and jsonb_typeof(room_metadata -> 'area') = 'string'
      and jsonb_typeof(room_metadata -> 'max_slots') = 'number'
    )
    or (
      room_kind = 'venture'
      and jsonb_typeof(room_metadata -> 'venture_id') = 'string'
      and reply_to_id is not null
    )
  );

create index if not exists tribe_messages_room_stream_idx
  on public.tribe_messages (tribe_id, created_at desc)
  where room_kind is not null;

create unique index if not exists tribe_messages_one_daily_pulse_answer_idx
  on public.tribe_messages (
    tribe_id,
    sender_id,
    (room_metadata ->> 'prompt_id')
  )
  where room_kind = 'pulse_answer';

create unique index if not exists tribe_messages_one_venture_announcement_idx
  on public.tribe_messages ((room_metadata ->> 'venture_id'))
  where room_kind = 'venture';

create or replace function public.enforce_tribe_room_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row public.tribe_messages%rowtype;
  venture_row public.ventures%rowtype;
  venture_id uuid;
begin
  if new.room_kind is distinct from 'venture' then
    return new;
  end if;

  begin
    venture_id := (new.room_metadata ->> 'venture_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'Invalid Venture reference';
  end;

  select * into source_row
  from public.tribe_messages
  where id = new.reply_to_id
    and tribe_id = new.tribe_id
    and room_kind = 'plan'
    and sender_id = new.sender_id;

  if not found then
    raise exception 'Venture announcements must reply to the author''s Tribe plan';
  end if;

  select * into venture_row
  from public.ventures
  where id = venture_id
    and user_id = new.sender_id;

  if not found then
    raise exception 'Only the Venture host can announce it';
  end if;

  new.content := venture_row.title;
  new.room_metadata := jsonb_build_object(
    'venture_id', venture_row.id,
    'starts_at', venture_row.starts_at,
    'max_slots', venture_row.max_slots
  );
  return new;
end;
$$;

revoke all on function public.enforce_tribe_room_message() from public;
revoke execute on function public.enforce_tribe_room_message() from anon, authenticated;

drop trigger if exists enforce_tribe_room_message on public.tribe_messages;
create trigger enforce_tribe_room_message
before insert on public.tribe_messages
for each row execute function public.enforce_tribe_room_message();

create or replace function public.can_access_tribe_room_message(
  target_message_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tribe_messages tm
    where tm.id = target_message_id
      and public.is_tribe_member(tm.tribe_id, target_user_id)
  );
$$;

revoke all on function public.can_access_tribe_room_message(uuid, uuid) from public;
revoke execute on function public.can_access_tribe_room_message(uuid, uuid) from anon;
grant execute on function public.can_access_tribe_room_message(uuid, uuid)
  to authenticated, service_role;

create table if not exists public.tribe_room_reactions (
  message_id uuid not null references public.tribe_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('spark', 'interested')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, reaction)
);

create index if not exists tribe_room_reactions_message_idx
  on public.tribe_room_reactions (message_id, reaction);

alter table public.tribe_room_reactions enable row level security;

create or replace function public.enforce_tribe_room_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  message_kind text;
begin
  select room_kind into message_kind
  from public.tribe_messages
  where id = new.message_id;

  if message_kind is null
     or (new.reaction = 'spark' and message_kind <> 'pulse_answer')
     or (new.reaction = 'interested' and message_kind <> 'plan') then
    raise exception 'Reaction does not apply to this room item';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_tribe_room_reaction() from public;
revoke execute on function public.enforce_tribe_room_reaction() from anon, authenticated;

drop trigger if exists enforce_tribe_room_reaction on public.tribe_room_reactions;
create trigger enforce_tribe_room_reaction
before insert or update on public.tribe_room_reactions
for each row execute function public.enforce_tribe_room_reaction();

drop policy if exists "Members read Tribe Room reactions" on public.tribe_room_reactions;
create policy "Members read Tribe Room reactions"
on public.tribe_room_reactions
for select
to authenticated
using (
  public.is_verified_adult(auth.uid())
  and public.can_access_tribe_room_message(message_id, auth.uid())
);

drop policy if exists "Members add own Tribe Room reactions" on public.tribe_room_reactions;
create policy "Members add own Tribe Room reactions"
on public.tribe_room_reactions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_verified_adult(auth.uid())
  and public.can_access_tribe_room_message(message_id, auth.uid())
);

drop policy if exists "Members remove own Tribe Room reactions" on public.tribe_room_reactions;
create policy "Members remove own Tribe Room reactions"
on public.tribe_room_reactions
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.can_access_tribe_room_message(message_id, auth.uid())
);

create table if not exists public.tribe_room_reads (
  tribe_id uuid not null references public.tribes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (tribe_id, user_id)
);

create index if not exists tribe_room_reads_user_idx
  on public.tribe_room_reads (user_id, last_read_at desc);

alter table public.tribe_room_reads enable row level security;

drop policy if exists "Members read own Tribe Room pointer" on public.tribe_room_reads;
create policy "Members read own Tribe Room pointer"
on public.tribe_room_reads
for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_tribe_member(tribe_id, auth.uid())
);

drop policy if exists "Members create own Tribe Room pointer" on public.tribe_room_reads;
create policy "Members create own Tribe Room pointer"
on public.tribe_room_reads
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_verified_adult(auth.uid())
  and public.is_tribe_member(tribe_id, auth.uid())
);

drop policy if exists "Members update own Tribe Room pointer" on public.tribe_room_reads;
create policy "Members update own Tribe Room pointer"
on public.tribe_room_reads
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_tribe_member(tribe_id, auth.uid())
)
with check (
  user_id = auth.uid()
  and public.is_verified_adult(auth.uid())
  and public.is_tribe_member(tribe_id, auth.uid())
);

drop trigger if exists require_adult_before_write on public.tribe_room_reactions;
create trigger require_adult_before_write
before insert or update on public.tribe_room_reactions
for each row execute function public.require_verified_adult();

drop trigger if exists require_adult_before_write on public.tribe_room_reads;
create trigger require_adult_before_write
before insert or update on public.tribe_room_reads
for each row execute function public.require_verified_adult();

grant select, insert, delete on public.tribe_room_reactions to authenticated;
grant select, insert, update on public.tribe_room_reads to authenticated;

comment on column public.tribe_messages.room_metadata is
  'Bounded structured payload for Daily Pulse answers, plans, and Venture announcements.';
