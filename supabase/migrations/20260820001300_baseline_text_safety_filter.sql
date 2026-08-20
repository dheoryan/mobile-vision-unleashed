-- Baseline server-side text safety filter. This is deliberately small and
-- high-confidence; it complements (not replaces) human moderation and reports.

create table if not exists public.blocked_content_patterns (
  id bigint generated always as identity primary key,
  pattern text not null unique,
  category text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.blocked_content_patterns enable row level security;

drop policy if exists "Moderators read safety patterns" on public.blocked_content_patterns;
create policy "Moderators read safety patterns"
on public.blocked_content_patterns for select to authenticated
using (public.current_user_is_moderator());

insert into public.blocked_content_patterns (pattern, category) values
  ('(?i)\m(csam|child[[:space:]]+porn(ography)?)\M', 'sexual-safety'),
  ('(?i)\m(sex|nudes?|naked)[[:space:]]+(with|from|of)[[:space:]]+(a[[:space:]]+)?minor\M', 'sexual-safety'),
  ('(?i)\m(kill|murder|shoot|stab)\M.{0,40}\m(you|him|her|them)\M', 'credible-threat'),
  ('(?i)\mn+[i1]+g+[e3]*r+s?\M', 'hateful-slur'),
  ('(?i)\mf+[a@]+g+[o0]*t+s?\M', 'hateful-slur')
on conflict (pattern) do nothing;

create or replace function public.content_is_blocked(value text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(bool_or(coalesce(value, '') ~ p.pattern), false)
  from public.blocked_content_patterns p
  where p.active
$$;

revoke all on function public.content_is_blocked(text) from public, anon, authenticated;

create or replace function public.reject_blocked_text()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text := '';
  row_data jsonb := to_jsonb(new);
begin
  candidate := case tg_table_name
    when 'posts' then row_data->>'content'
    when 'comments' then row_data->>'content'
    when 'messages' then row_data->>'content'
    when 'tribe_messages' then row_data->>'content'
    when 'venture_messages' then row_data->>'content'
    when 'venture_applications' then row_data->>'message'
    when 'ventures' then concat_ws(' ', row_data->>'title', row_data->>'note')
    when 'profiles' then concat_ws(' ', row_data->>'display_name', row_data->>'handle', row_data->>'bio')
    else ''
  end;

  if public.content_is_blocked(candidate) then
    raise exception 'Content violates community safety filters';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_blocked_text() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'posts', 'comments', 'messages', 'tribe_messages',
    'ventures', 'venture_applications', 'venture_messages'
  ] loop
    execute format('drop trigger if exists reject_blocked_text_before_write on public.%I', table_name);
    execute format(
      'create trigger reject_blocked_text_before_write before insert or update on public.%I for each row execute function public.reject_blocked_text()',
      table_name
    );
  end loop;
end
$$;

comment on table public.blocked_content_patterns is
  'High-confidence baseline filter managed through service-role operations; extend from moderation outcomes.';
