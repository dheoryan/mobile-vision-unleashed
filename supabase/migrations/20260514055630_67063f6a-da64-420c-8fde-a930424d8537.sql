
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);

CREATE INDEX idx_messages_pair_time ON public.messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX idx_messages_recipient_time ON public.messages (recipient_id, created_at DESC);
CREATE INDEX idx_messages_sender_time ON public.messages (sender_id, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read messages"
  ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Senders insert messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = recipient_id AND b.blocked_id = sender_id)
         OR (b.blocker_id = sender_id AND b.blocked_id = recipient_id)
    )
  );

CREATE POLICY "Participants delete own messages"
  ON public.messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
