-- HOSTS MAY EDIT AN OPEN VENTURE — within rules the database enforces.
--
-- Two things are happening here. The first is the feature: a host can fix a
-- typo, change the time, swap the photo. The second is closing a hole that
-- already existed and that the feature would have made trivial to hit.
--
-- The existing policy is:
--
--   create policy "Hosts update their ventures"
--     on public.ventures for update to authenticated
--     using (user_id = auth.uid()) with check (user_id = auth.uid());
--
-- That authorises the host to write *every column*. Today that means a host
-- can PATCH `filled_slots` and `status` directly, straight past the capacity
-- trigger added in 20260820002300 — the guard there is on
-- venture_applications, so writing the ventures row bypasses it entirely. A
-- host could set filled_slots to 1 on a full Venture and reopen it to
-- unlimited applications, or set status to 'open' on something the capacity
-- logic had marked 'full'.
--
-- A policy cannot express these rules: they are all about the OLD -> NEW
-- transition, and WITH CHECK cannot see OLD. So a BEFORE UPDATE trigger.

create or replace function public.enforce_venture_host_edits()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  accepted_count int;
  occupancy int;
begin
  -- Two legitimate non-host writers have to be let through.
  --
  -- 1. service_role / migrations / moderation: no JWT, so auth.uid() is null.
  --
  -- 2. sync_venture_slots(), which owns filled_slots and the 'full' status.
  --    It is SECURITY DEFINER, but that does NOT clear auth.uid() — the GUC
  --    belongs to the session, not the function — so it arrives here looking
  --    exactly like the host. Caught in testing: without this clause the guard
  --    rejects the system's own recount and accepting an applicant fails
  --    outright, which is a far worse bug than the one being fixed.
  --
  --    pg_trigger_depth() separates them cleanly. A host's UPDATE fires this
  --    trigger at depth 1; sync_venture_slots runs as an AFTER trigger on
  --    venture_applications and its UPDATE on ventures lands here at depth 2.
  if auth.uid() is null or pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Identity and provenance never move.
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'id, user_id and created_at cannot be changed';
  end if;

  -- A closed Venture is a record of something that happened. Editing it would
  -- rewrite what the people who joined actually agreed to. Reopening is the
  -- one permitted change, and it is a status change, handled below.
  if old.status = 'closed' and new.status = 'closed' then
    raise exception 'This Venture is closed'
      using hint = 'Reopen it before making changes.';
  end if;

  -- filled_slots is derived from accepted applications by sync_venture_slots.
  -- Letting the host set it directly is how the capacity guard gets bypassed.
  if new.filled_slots is distinct from old.filled_slots then
    raise exception 'filled_slots is maintained automatically'
      using hint = 'Accept or remove applicants to change the count.';
  end if;

  -- The host may close and reopen. 'full' is computed, never chosen.
  if new.status is distinct from old.status
     and new.status not in ('open', 'closed') then
    raise exception 'a host may only open or close a Venture, got %', new.status;
  end if;

  select count(*) into accepted_count
  from public.venture_applications
  where venture_id = new.id and status = 'accepted';
  occupancy := 1 + accepted_count;  -- the host holds a seat

  -- Shrinking below the people already in the room would either trip the
  -- check constraint or, worse, leave accepted members with no seat. Growing
  -- is always fine.
  if new.max_slots < occupancy then
    raise exception 'There are already % people in this Venture', occupancy
      using hint = 'You can raise the number of slots, but not below who has joined.';
  end if;

  -- Scope is a promise about who the room is for. Flipping 'all' -> 'mine'
  -- after someone from another Tribe has applied or been accepted revokes
  -- their access to the Venture, its chat and its photo, retroactively. Lock
  -- it once anyone else is involved; before that, it is still just a draft.
  if new.scope is distinct from old.scope
     and exists (
       select 1 from public.venture_applications va
       where va.venture_id = new.id
         and va.status in ('pending', 'invited', 'accepted')
     ) then
    raise exception 'Audience is locked once people have applied'
      using hint = 'Close this Venture and host a new one to change who it is for.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_venture_host_edits on public.ventures;
create trigger trg_enforce_venture_host_edits
before update on public.ventures
for each row execute function public.enforce_venture_host_edits();

-- ---------- replacing the photo removes the old object ----------
-- cleanup_venture_image only fired on DELETE, so every photo swap orphaned the
-- previous file in the bucket — still readable by the owner branch of the read
-- policy, and counting against storage forever.

create or replace function public.cleanup_replaced_venture_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.image_url is not null and new.image_url is distinct from old.image_url then
    delete from storage.objects
    where bucket_id = 'venture-images' and name = old.image_url;
  end if;
  return null;
end;
$$;

revoke all on function public.cleanup_replaced_venture_image() from public, anon, authenticated;

drop trigger if exists trg_cleanup_replaced_venture_image on public.ventures;
create trigger trg_cleanup_replaced_venture_image
after update of image_url on public.ventures
for each row execute function public.cleanup_replaced_venture_image();

comment on function public.enforce_venture_host_edits() is
  'Constrains host UPDATEs on ventures. The RLS policy authorises the host to write every column, including filled_slots and status, which would bypass the capacity guard on venture_applications; these rules are transitions, so they cannot live in a WITH CHECK.';
