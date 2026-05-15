## Goal
Stop showing the sender's profile picture on the right side of push notifications. Always use the MUTUALS logo instead, for consistent branding.

## Change
In `src/routes/api/public/push.dispatch.ts`, update the payload so `icon` no longer falls back to `actor.avatar_url`:

```ts
icon: "/icons/icon-192.png",
badge: "/icons/icon-192.png",
```

Also drop the now-unused `avatar_url` field from the actor profile select (keep `display_name`, `handle`).

## Notes
- `sw.js` already uses `payload.icon` directly, so no service worker change is needed.
- Existing notifications are unaffected; this only impacts new push deliveries going forward.
- No DB, no client-side, no UI changes.
