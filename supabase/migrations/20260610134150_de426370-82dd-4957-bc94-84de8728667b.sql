
-- 1) Comments SELECT policy: enforce same audience/membership check as posts
DROP POLICY IF EXISTS "Comments visible if author not blocked" ON public.comments;

CREATE POLICY "Comments visible if post visible and author not blocked"
ON public.comments
FOR SELECT
USING (
  NOT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = auth.uid() AND b.blocked_id = comments.author_id)
       OR (b.blocker_id = comments.author_id AND b.blocked_id = auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = comments.post_id
      AND (
        p.author_id = auth.uid()
        OR p.audience = 'all'
        OR (
          p.audience = 'tribe'
          AND EXISTS (
            SELECT 1 FROM public.profiles pr
            WHERE pr.id = auth.uid()
              AND p.tribe_id = ANY (pr.tribe_ids)
          )
        )
      )
  )
);

-- 2) Storage: enforce tribe membership on uploads to tribe-chat-attachments
DROP POLICY IF EXISTS "Authenticated users can upload tribe chat attachments" ON storage.objects;

CREATE POLICY "Tribe members upload tribe chat attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tribe-chat-attachments'
  AND owner = auth.uid()
  AND public.is_tribe_member((storage.foldername(name))[1], auth.uid())
);

-- 3) Storage: allow owners to update/delete their own tribe chat attachments
CREATE POLICY "Owners delete own tribe chat attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tribe-chat-attachments'
  AND owner = auth.uid()
);

CREATE POLICY "Owners update own tribe chat attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tribe-chat-attachments'
  AND owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'tribe-chat-attachments'
  AND owner = auth.uid()
);
