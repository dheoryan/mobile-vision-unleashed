-- Recipients must retain abusive messages as reportable evidence. A future
-- “delete for me” feature needs a per-user visibility table, not a row delete.
drop policy if exists "Participants delete own messages" on public.messages;

create policy "Senders delete own messages"
on public.messages
for delete
to authenticated
using (auth.uid() = sender_id);
