# Web Push Notifications Plan

Deliver real OS-level push notifications (Android, desktop, iOS 16.4+) that fire even when Mutuals is closed. Reuses the existing `notifications` table and DB triggers — we just add a fan-out step that posts each new notification to subscribed devices.

## Important caveats (please read)

- **Only works on the published site** (`moots.lovable.app` or your custom domain). Will NOT work inside the Lovable editor preview iframe — service workers are blocked there.
- **iOS requires "Add to Home Screen"** first. iOS Safari refuses Web Push from a regular browser tab; the user must install the PWA. We'll add a manifest + an in-app prompt explaining this on iOS.
- **Permission is per-device**. Each phone/laptop must opt in once.
- **No App Store needed.**

## What gets built

### 1. Service worker + manifest (frontend)

- `public/sw.js` — handles `push` events (shows notification with title/body/icon/url) and `notificationclick` (focuses or opens the right URL).
- `public/manifest.webmanifest` — name, icons, `display: standalone`, `start_url: /`. Required for iOS install + nicer Android UX.
- `index.html` head: link manifest, theme-color, apple-touch-icon.
- Guard `navigator.serviceWorker.register('/sw.js')` so it **only runs when**:
  - not in an iframe, AND
  - hostname is not `id-preview--…` / `lovableproject.com`.
  This prevents the SW from poisoning the editor preview.

### 2. Permission UX (frontend)

- New `src/lib/push-subscribe.ts` helper: `enablePush()` requests permission, calls `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC })`, posts the subscription JSON to the server, and stores a local flag.
- New `src/components/mutuals/EnablePushBanner.tsx` — dismissible banner shown on `/notifications` and once on first login when permission is `default`. On iOS Safari (not installed), shows the "Add to Home Screen" instructions instead of the prompt button.
- Settings entry in `ProfileScreen` → "Push notifications" toggle (enable / disable / re-subscribe). Disable calls `subscription.unsubscribe()` and deletes the row server-side.

### 3. Database (Supabase migration)

```sql
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.push_subscriptions enable row level security;
create policy "own subs read"   on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "own subs delete" on public.push_subscriptions for delete using (auth.uid() = user_id);
-- Inserts go through a server fn using the admin client; no insert policy needed.
create index on public.push_subscriptions(user_id);
```

Plus a Postgres trigger on `public.notifications` that uses `pg_net` to POST the new notification id + recipient to a public server route (`/api/public/push/dispatch`) with a shared HMAC header. (`pg_net` is enabled by default in Supabase.)

### 4. Server functions / routes (TanStack)

- `src/lib/push.functions.ts`
  - `saveSubscription({ endpoint, keys, userAgent })` — `requireSupabaseAuth`, upserts row by endpoint.
  - `deleteSubscription({ endpoint })` — auth, deletes row.
- `src/routes/api/public/push.dispatch.ts` — verifies HMAC header (`x-push-secret`) against `PUSH_DISPATCH_SECRET`, loads the notification + actor, fetches the recipient's `push_subscriptions`, signs and sends a Web Push message to each endpoint via the VAPID protocol. On `404`/`410` responses, deletes the dead subscription.

### 5. VAPID + signing

VAPID keys are required for Web Push. We'll:

- Generate a P-256 keypair once (script run in `code--exec`); commit the **public** key as `VITE_VAPID_PUBLIC_KEY` in `.env`-style code constant (it's safe to ship), and store the **private** key as a runtime secret `VAPID_PRIVATE_KEY`. Also store `VAPID_SUBJECT` (a `mailto:` you control) and `PUSH_DISPATCH_SECRET` (HMAC for the pg_net→worker call).
- Use a Cloudflare Worker–compatible Web Push library (`@block65/webcrypto-web-push`) — the popular `web-push` package depends on Node crypto and won't run in our Workers runtime.

Secrets to add: `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_DISPATCH_SECRET`. I'll request them via `add_secret` after you approve.

### 6. Wiring into existing notifications

No changes to `notify_on_like` / `notify_on_comment` / `notify_on_follow` / `notify_on_message` triggers. The new dispatch trigger fires on every insert into `public.notifications`, so likes, comments, replies, mentions, follows, and DMs all get pushed automatically with the same `kind` → text mapping you already use in `/notifications`.

Click behavior in the SW mirrors the in-app handler: like/comment/reply/mention → open `/?openPost=<post_id>`, follow → open `/u/<handle>`, message → open `/`.

## Files

**Create**
- `public/sw.js`
- `public/manifest.webmanifest`
- `public/icons/icon-192.png`, `icon-512.png` (generated)
- `src/lib/push-subscribe.ts`
- `src/lib/push.functions.ts`
- `src/components/mutuals/EnablePushBanner.tsx`
- `src/routes/api/public/push.dispatch.ts`
- migration: `push_subscriptions` table + `pg_net` trigger

**Edit**
- `index.html` (manifest, icons, theme-color)
- `src/routes/__root.tsx` (register SW with iframe/preview guard)
- `src/components/mutuals/ProfileScreen.tsx` (push toggle)
- `src/routes/notifications.tsx` (banner)
- `src/start.ts` (no change unless we add middleware — likely none)
- `package.json` (add `@block65/webcrypto-web-push`)

## Out of scope

- Quiet hours / per-kind opt-out (can add later — schema supports it).
- Rich notifications with images and action buttons (basic title+body+icon first).
- Native iOS/Android app via Capacitor.

## Rollout order

1. Add secrets + generate VAPID keypair.
2. DB migration (table + trigger).
3. Server fns + dispatch route.
4. SW + manifest + icons + registration guard.
5. Subscribe UX (banner + profile toggle).
6. Test on `moots.lovable.app` from an Android phone and a desktop, then iOS after Add-to-Home-Screen.
