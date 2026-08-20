-- A “mine” Venture is visible only to people who share at least one Tribe
-- with its host. Keep that rule in Postgres so direct PostgREST calls cannot
-- bypass the application-layer filter.
create or replace function public.is_venture_scope_visible(
  _venture_id uuid,
  _viewer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _viewer_id = auth.uid()
    and exists (
      select 1
      from public.ventures v
      where v.id = _venture_id
        and (
          v.scope = 'all'
          or (
            v.scope = 'mine'
            and exists (
              select 1
              from public.profiles host
              join public.profiles viewer on viewer.id = _viewer_id
              where host.id = v.user_id
                and host.tribe_ids && viewer.tribe_ids
            )
          )
        )
    )
$$;

revoke execute on function public.is_venture_scope_visible(uuid, uuid) from public, anon;
grant execute on function public.is_venture_scope_visible(uuid, uuid) to authenticated;

drop policy if exists "Users read open or related ventures" on public.ventures;
create policy "Users read open or related ventures"
on public.ventures
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_venture_application(id, auth.uid())
  or (
    status = 'open'
    and public.is_venture_scope_visible(id, auth.uid())
  )
);

drop policy if exists "Users apply to open ventures" on public.venture_applications;
create policy "Users apply to open ventures"
on public.venture_applications
for insert
to authenticated
with check (
  applicant_id = auth.uid()
  and status = 'pending'
  and not public.is_venture_host(venture_id, auth.uid())
  and public.is_venture_joinable(venture_id)
  and public.is_venture_scope_visible(venture_id, auth.uid())
);
