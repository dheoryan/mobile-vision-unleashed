import { access, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(root, "public");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(relativePath) {
  return readFile(join(root, relativePath), "utf8");
}

async function assertPublicFile(urlPath) {
  const path = join(publicDir, urlPath.replace(/^\//, ""));
  await access(path);
  const info = await stat(path);
  assert(info.size > 0, `${urlPath} is empty`);
}

const manifest = JSON.parse(await read("public/manifest.webmanifest"));
assert(manifest.name === "MEUTUALS", "Manifest name must be MEUTUALS");
assert(manifest.short_name === "MEUTUALS", "Manifest short_name must be MEUTUALS");
assert(manifest.id === "/", "Manifest needs a stable root id");
assert(manifest.start_url === "/", "Manifest start_url must stay inside the root scope");
assert(manifest.scope === "/", "Manifest scope must cover the application");
assert(manifest.display === "standalone", "Manifest must launch in standalone mode");
assert(/^#[0-9a-f]{6}$/i.test(manifest.theme_color), "Manifest theme_color must be hex");
assert(/^#[0-9a-f]{6}$/i.test(manifest.background_color), "Manifest background_color must be hex");
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 4, "Manifest needs app icons");
assert(
  manifest.icons.some((icon) => icon.sizes === "192x192" && icon.purpose === "any"),
  "Manifest needs a 192x192 app icon",
);
assert(
  manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any"),
  "Manifest needs a 512x512 app icon",
);
assert(
  manifest.icons.some((icon) => icon.purpose?.split(/\s+/).includes("maskable")),
  "Manifest needs a maskable icon",
);

await Promise.all(manifest.icons.map((icon) => assertPublicFile(icon.src)));
await assertPublicFile("/icons/apple-touch-icon.png");
await assertPublicFile("/offline.html");

const serviceWorker = await read("public/sw.js");
for (const required of [
  'addEventListener("fetch"',
  'addEventListener("push"',
  'addEventListener("notificationclick"',
  'addEventListener("message"',
  'const OFFLINE_URL = "/offline"',
]) {
  assert(serviceWorker.includes(required), `Service worker is missing ${required}`);
}
assert(
  serviceWorker.includes('request.mode === "navigate"'),
  "Service worker needs a navigation fallback",
);

const pushSubscribe = await read("src/lib/push-subscribe.ts");
assert(
  pushSubscribe.includes('return "needs-install"') && pushSubscribe.includes("desktopModeIpad"),
  "Push capability detection must preserve iPhone/iPad install guidance",
);
for (const required of [
  "navigator.serviceWorker.ready",
  'updateViaCache: "none"',
  "registration.active",
]) {
  assert(
    pushSubscribe.includes(required),
    `Push subscription must wait for an active Service Worker: ${required}`,
  );
}

const pushDispatch = await read("src/routes/api/public/push.dispatch.ts");
for (const required of [
  "VAPID_PRIVATE_KEY is not configured",
  "recordDelivery",
  "buildPushCopy",
  "AbortSignal.timeout",
]) {
  assert(pushDispatch.includes(required), `Push dispatch is missing ${required}`);
}

const pushMigration = await read("supabase/migrations/20260827043000_harden_push_delivery.sql");
for (const required of [
  "claim_push_subscription",
  "push_attempted_at",
  "push_delivered_count",
  "offset 8",
]) {
  assert(pushMigration.includes(required), `Push hardening migration is missing ${required}`);
}

const offlinePage = await read("public/offline.html");
assert(offlinePage.includes("You’re offline."), "Offline page needs a clear status");
assert(offlinePage.includes('addEventListener("online"'), "Offline page must recover on reconnect");

const rootRoute = await read("src/routes/__root.tsx");
for (const metadata of [
  "apple-mobile-web-app-capable",
  "apple-mobile-web-app-status-bar-style",
  "apple-mobile-web-app-title",
  'rel: "apple-touch-icon"',
  'rel: "manifest"',
]) {
  assert(rootRoute.includes(metadata), `Root route is missing ${metadata}`);
}

const venturesMode = await read("src/lib/ventures-mode.ts");
const venturesScreen = await read("src/components/mutuals/VenturesScreen.tsx");
const appRoute = await read("src/routes/index.tsx");
assert(
  venturesMode.includes("`${VENTURES_MODE_KEY}:${userId}`"),
  "Venture mode storage must be scoped to the signed-in user",
);
assert(
  venturesScreen.includes("`${VENTURES_INTRO_KEY}:${userId}`"),
  "Venture intro storage must be scoped to the signed-in user",
);
assert(
  appRoute.includes("`${TAB_KEY}:${userId}`"),
  "Primary tab storage must be scoped to the signed-in user",
);

console.log("PWA release checks passed: manifest, icons, offline shell, updates, and Web Push.");
