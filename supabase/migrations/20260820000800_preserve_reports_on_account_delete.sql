-- Preserve moderation evidence when either party later deletes their account.
-- Reporter identity is anonymized by the FK; target ids remain as evidence and
-- are explicitly marked deleted so the moderation queue does not treat them as
-- resolvable live content.

alter table public.reports
  add column if not exists reporter_deleted_at timestamptz,
  add column if not exists target_deleted_at timestamptz;

alter table public.reports
  alter column reporter_id drop not null;

alter table public.reports
  drop constraint if exists reports_reporter_id_fkey;

alter table public.reports
  add constraint reports_reporter_id_fkey
  foreign key (reporter_id)
  references public.profiles(id)
  on delete set null;

create or replace function public.mark_reports_for_deleted_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reports
  set reporter_deleted_at = coalesce(reporter_deleted_at, now())
  where reporter_id = old.id;

  update public.reports r
  set target_deleted_at = coalesce(r.target_deleted_at, now())
  where r.target_deleted_at is null
    and (
      (r.target_kind = 'user' and r.target_id = old.id::text)
      or (
        r.target_kind = 'post'
        and exists (
          select 1
          from public.posts p
          where p.id::text = r.target_id
            and p.author_id = old.id
        )
      )
      or (
        r.target_kind = 'comment'
        and exists (
          select 1
          from public.comments c
          where c.id::text = r.target_id
            and c.author_id = old.id
        )
      )
    );

  return old;
end;
$$;

revoke all on function public.mark_reports_for_deleted_profile() from public;
revoke execute on function public.mark_reports_for_deleted_profile() from anon, authenticated;

drop trigger if exists mark_reports_before_profile_delete on public.profiles;
create trigger mark_reports_before_profile_delete
before delete on public.profiles
for each row execute function public.mark_reports_for_deleted_profile();

comment on column public.reports.reporter_deleted_at is
  'Set when the reporter deletes their account; reporter_id is then anonymized to NULL.';
comment on column public.reports.target_deleted_at is
  'Set when the reported user or reported content author deletes their account.';
