-- 1. Comments: restrict SELECT to authenticated role only
DROP POLICY IF EXISTS "Comments visible if post visible and author not blocked" ON public.comments;

CREATE POLICY "Comments visible if post visible and author not blocked"
ON public.comments
FOR SELECT
TO authenticated
USING (
  (NOT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE ((b.blocker_id = auth.uid() AND b.blocked_id = comments.author_id)
        OR (b.blocker_id = comments.author_id AND b.blocked_id = auth.uid()))
  ))
  AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = comments.post_id
      AND (
        p.author_id = auth.uid()
        OR p.audience = 'all'
        OR (p.audience = 'tribe' AND EXISTS (
          SELECT 1 FROM public.profiles pr
          WHERE pr.id = auth.uid() AND p.tribe_id = ANY (pr.tribe_ids)
        ))
      )
  )
);

REVOKE SELECT ON public.comments FROM anon;

-- 2. Venture applications: hosts may only change decision status, never identity columns
DROP POLICY IF EXISTS "Hosts decide venture applications" ON public.venture_applications;

CREATE POLICY "Hosts decide venture applications"
ON public.venture_applications
FOR UPDATE
TO authenticated
USING (public.is_venture_host(venture_id, auth.uid()))
WITH CHECK (
  public.is_venture_host(venture_id, auth.uid())
  AND status = ANY (ARRAY['pending','invited','accepted','declined','rejected','cancelled'])
);

CREATE OR REPLACE FUNCTION public.venture_applications_guard_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.applicant_id IS DISTINCT FROM OLD.applicant_id
     OR NEW.venture_id IS DISTINCT FROM OLD.venture_id
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'applicant_id, venture_id and id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venture_applications_guard ON public.venture_applications;
CREATE TRIGGER trg_venture_applications_guard
BEFORE UPDATE ON public.venture_applications
FOR EACH ROW EXECUTE FUNCTION public.venture_applications_guard_immutable_fields();