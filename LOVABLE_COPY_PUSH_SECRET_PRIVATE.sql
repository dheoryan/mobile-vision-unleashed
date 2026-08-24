-- PRIVATE STEP — never screenshot or share this result.
--
-- Run only after 20260824060000_rotate_exposed_push_dispatch_secret.sql.
-- Copy the single result directly into the Lovable production secret named
-- PUSH_DISPATCH_SECRET, save it, and then clear the SQL result panel.

select decrypted_secret
from vault.decrypted_secrets
where name = 'push_dispatch_secret';
