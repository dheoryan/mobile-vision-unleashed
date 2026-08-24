-- Completed Venture rooms are readable memories, not permanent group chats.
--
-- RED under CHANGE_PROTOCOL: this replaces an INSERT RLS policy. Review and
-- explicitly run it; creating this file does not change any live database.
--
-- The application server rejects writes after status/closed_at/ended_at or the
-- scheduled ends_at. This policy is the database-side boundary for clients
-- calling Supabase directly. The helper is SECURITY DEFINER because an inline
-- sub-select from an RLS policy is itself RLS-filtered.

create or replace function public.is_venture_chat_open(_venture_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ventures v
    where v.id = _venture_id
      and coalesce(v.status, 'open') <> 'closed'
      and v.closed_at is null
      and v.ended_at is null
      and (v.ends_at is null or v.ends_at > now())
  )
$$;

revoke all on function public.is_venture_chat_open(uuid) from public, anon;
grant execute on function public.is_venture_chat_open(uuid) to authenticated;

drop policy if exists "Venture members send party chat" on public.venture_messages;

create policy "Venture members send party chat"
on public.venture_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.is_venture_member(venture_id, auth.uid())
  and public.is_venture_chat_open(venture_id)
);

comment on function public.is_venture_chat_open(uuid) is
  'True only while a Venture party room is writable. Completed rooms remain readable so members can see the recap and reconnect as Moots.';
