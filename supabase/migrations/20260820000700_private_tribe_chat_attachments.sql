-- The application already stores object paths and mints one-hour signed URLs.
-- A public bucket bypasses those membership-scoped storage policies entirely.
update storage.buckets
set public = false
where id = 'tribe-chat-attachments';
