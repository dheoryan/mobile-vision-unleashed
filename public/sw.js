// MEUTUALS service worker: Web Push plus a deliberately small offline shell.
// Authenticated pages and API responses are never cached.

const SHELL_CACHE = "meutuals-shell-v3";
const STATIC_CACHE = "meutuals-static-v3";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  // Push must never depend on the optional offline cache. `cache.addAll()` is
  // transactional: one unavailable icon used to reject the whole install and
  // leave PushManager waiting forever on both Safari and Chromium.
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(SHELL_CACHE);
        await Promise.allSettled(
          PRECACHE.map(async (url) => {
            const response = await fetch(url, { cache: "reload" });
            if (response.ok) await cache.put(url, response);
          }),
        );
      } catch (_) {
        // Offline support may be unavailable (private mode/storage pressure),
        // but the worker must still activate so Web Push can be enabled.
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) => key.startsWith("meutuals-") && ![SHELL_CACHE, STATIC_CACHE].includes(key),
              )
              .map((key) => caches.delete(key)),
          ),
        ),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache authenticated HTML. If navigation fails, show a static page
  // that contains no account data and automatically retries after reconnect.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL);
        return offline || Response.error();
      }),
    );
    return;
  }

  // Cache only immutable build assets and explicit public app assets. Server
  // functions, API routes, and user content remain network-only.
  const isStaticAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.png" ||
    url.pathname === "/manifest.webmanifest";

  if (!isStaticAsset) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return Response.error();
      }
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: "MEUTUALS", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "MEUTUALS";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    data: { url: payload.url || "/" },
    tag: payload.tag,
    renotify: Boolean(payload.tag),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            await client.focus();
            await client.navigate(targetUrl);
            return;
          }
        } catch (_) {
          /* ignore */
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
