# MEUTUALS installed PWA release checklist

MEUTUALS is an installable, network-first PWA. The application shell can recover
from a lost connection, but current social data deliberately remains online-only.

## Privacy boundary

The service worker may cache only:

- the branded offline fallback;
- the web app manifest and platform icons;
- same-origin build assets under `/assets/`;
- explicit public app assets under `/icons/`.

Never cache navigation responses, server functions, Supabase responses, chats,
profiles, location results, signed media, or other user-generated content. A
shared device must not be able to reopen the previous account's private data
from Cache Storage.

## Automated release gate

Run before every PWA release:

```bash
npm run check:pwa
npx tsc --noEmit
npm run build
```

`check:pwa` validates manifest identity, install icons, the offline shell,
service-worker fetch/update/push handlers, iOS metadata, and account-scoped
installed-app preferences.

## Android — Chrome

- Open the production origin and confirm Settings → App installation offers
  **Install** or clear browser-menu guidance.
- Install and launch from the home-screen icon. Confirm browser chrome is gone.
- Confirm the splash/background stays dark and the MEUTUALS icon is not cropped.
- Move between tabs, close the app, and reopen it. The same account should return
  to its own last tab.
- Disable the network, navigate, and confirm the branded offline fallback or the
  in-app offline status appears instead of a browser error.
- Restore the network and confirm the app recovers without clearing the session.
- Enable notifications from a user gesture and open a notification deep link.

## iPhone — Safari / Home Screen

- In Safari, use Share → Add to Home Screen, then launch from the new icon.
- Confirm standalone mode, dark status area, portrait layout, safe-area padding,
  keyboard behavior, and bottom navigation on a physical iPhone.
- Confirm Settings reports **Installed app**.
- Enable Web Push only after launching from the Home Screen; verify a notification
  opens its intended destination.
- Repeat offline/reconnect and update tests on the installed copy.

## Account switching

- Account A completes Venture onboarding and opens a non-default tab.
- Log out, then sign in with a new Account B on the same installation.
- Account B must see Venture onboarding and must not inherit Account A's tab,
  Venture mode, open message thread, cached queries, or push subscription.
- Sign back in as Account A and confirm its non-sensitive preferences return.

## Update behavior

- Bump both `SHELL_CACHE` and `STATIC_CACHE` in `public/sw.js` when changing
  public icons, manifest behavior, or other non-hashed cached assets.
- Deploy a build with a changed service-worker cache version.
- Keep the old installed app open, return it to the foreground, and confirm the
  update banner appears.
- Choose **Update** and confirm the page reloads once under the new worker.
- Confirm older `meutuals-*` caches are removed during activation.

## Known intentional limitation

MEUTUALS does not support composing messages, joining Ventures, editing profiles,
or reading previously loaded private data while offline. Those actions depend on
live authorization and current social state; presenting stale or queued results
would be misleading and could expose another account's data on a shared device.
