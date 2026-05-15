
create or replace function public.ensure_profile_handle()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.handle is null or new.handle = '' then
    new.handle := lower(regexp_replace(coalesce(nullif(new.display_name,''), 'user'), '[^a-zA-Z0-9]', '', 'g'))
                 || '_' || substring(new.id::text, 1, 6);
  end if;
  return new;
end;
$$;
