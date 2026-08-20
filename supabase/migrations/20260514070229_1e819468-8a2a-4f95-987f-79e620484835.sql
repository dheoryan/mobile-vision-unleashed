create or replace function public.enforce_tribe_limit()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- Monetization paused: allow up to 3 tribes for everyone.
  -- To re-enable Plus gating, restore the original cap (1 free / 3 plus).
  if coalesce(array_length(new.tribe_ids, 1), 0) > 3 then
    raise exception 'A profile can be in at most 3 tribes, got %', array_length(new.tribe_ids, 1);
  end if;
  new.updated_at := now();
  return new;
end;
$function$;