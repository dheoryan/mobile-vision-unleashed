// VAPID public key (safe to ship in the client bundle)
export const VAPID_PUBLIC_KEY =
  "BJPHTQJ4qyDf9_YrT0HbcZ6GeNMs-3DsV7Awdos-dj1F8FmvqcTMCBs5nSNQ2Uw2nt-uJ8bkHB-Abh-599_wqJk";

export type PushAvailability =
  | "available"
  | "blocked"
  | "needs-install"
  | "insecure"
  | "unsupported";

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushEnableStage = "permission" | "service" | "subscription";

const SERVICE_WORKER_TIMEOUT_MS = 12_000;
const PERMISSION_TIMEOUT_MS = 45_000;
const SUBSCRIPTION_TIMEOUT_MS = 20_000;

export async function withPushTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export interface PushCapabilitySnapshot {
  appleMobile: boolean;
  standalone: boolean;
  secureContext: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotifications: boolean;
  permission: NotificationPermission | null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  // iOS
  // @ts-expect-error - non-standard
  if (window.navigator.standalone) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const classicIos = /iPad|iPhone|iPod/.test(ua);
  // Since iPadOS 13, Safari can identify itself as macOS in desktop mode.
  const desktopModeIpad =
    (/Macintosh/.test(ua) || navigator.platform === "MacIntel") &&
    (navigator.maxTouchPoints ?? 0) > 1;
  return classicIos || desktopModeIpad;
}

/** Chrome / Firefox / Edge on iOS are WebKit shells and share iOS PWA limits. */
export function isIosThirdPartyBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return isIosSafari() && /CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export type PushBlocker = "none" | "needs-install" | "insecure" | "unsupported";

export function getPushBlocker(): PushBlocker {
  const availability = getPushAvailability();
  if (availability === "needs-install") return "needs-install";
  if (availability === "insecure") return "insecure";
  if (availability === "unsupported") return "unsupported";
  return "none";
}

export function evaluatePushAvailability(snapshot: PushCapabilitySnapshot): PushAvailability {
  if (!snapshot.secureContext) return "insecure";
  // iOS/iPadOS deliberately hides Push API support from normal browser tabs.
  // Preserve this state before generic feature detection so the UI can explain
  // how to install the Home Screen web app instead of saying "unsupported".
  if (snapshot.appleMobile && !snapshot.standalone) return "needs-install";
  if (!snapshot.hasServiceWorker || !snapshot.hasPushManager || !snapshot.hasNotifications) {
    return "unsupported";
  }
  return snapshot.permission === "denied" ? "blocked" : "available";
}

export function getPushAvailability(): PushAvailability {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "unsupported";
  return evaluatePushAvailability({
    appleMobile: isIosSafari(),
    standalone: isStandalonePwa(),
    secureContext: window.isSecureContext,
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotifications: "Notification" in window,
    permission: "Notification" in window ? Notification.permission : null,
  });
}

export function getPushPermission(): PushPermission {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission as PushPermission;
}

async function waitForActiveWorker(
  registration: ServiceWorkerRegistration,
): Promise<ServiceWorkerRegistration> {
  if (registration.active) return registration;

  registration.waiting?.postMessage({ type: "SKIP_WAITING" });
  const worker = registration.installing ?? registration.waiting;
  if (!worker) throw new Error("The notification service has no worker to start.");

  return withPushTimeout(
    new Promise<ServiceWorkerRegistration>((resolve, reject) => {
      const inspect = () => {
        if (registration.active || worker.state === "activated") {
          worker.removeEventListener("statechange", inspect);
          resolve(registration);
          return;
        }
        if (worker.state === "installed") {
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        }
        if (worker.state === "redundant") {
          worker.removeEventListener("statechange", inspect);
          reject(new Error("The notification service worker installation failed."));
        }
      };

      worker.addEventListener("statechange", inspect);
      inspect();
    }),
    SERVICE_WORKER_TIMEOUT_MS,
    "The notification service worker did not activate in time.",
  );
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  let lastError: unknown;

  // A failed install can leave a registration with no active worker. Repair
  // that state in-place, then do one clean re-registration if it stays stuck.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const registration = await withPushTimeout(
      navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      }),
      SERVICE_WORKER_TIMEOUT_MS,
      "MEUTUALS could not register its notification service.",
    );

    try {
      return await waitForActiveWorker(registration);
    } catch (error) {
      lastError = error;
      if (registration.active) return registration;
      await registration.unregister().catch(() => false);
    }
  }

  throw new Error(
    lastError instanceof Error
      ? `MEUTUALS could not repair notifications: ${lastError.message}`
      : "MEUTUALS could not repair notifications on this device.",
  );
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg?.active) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

function subscriptionData(sub: PushSubscription): PushSubscriptionData {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const p256dh = json.keys?.p256dh ?? arrayBufferToBase64Url(sub.getKey("p256dh")!);
  const auth = json.keys?.auth ?? arrayBufferToBase64Url(sub.getKey("auth")!);
  return { endpoint: sub.endpoint, p256dh, auth };
}

/**
 * Returns the browser's existing subscription in the format accepted by the
 * server. This does not request permission and is safe to use after login to
 * re-attach an already-authorized installation to the current account.
 */
export async function getCurrentSubscriptionData(): Promise<PushSubscriptionData | null> {
  const sub = await getCurrentSubscription();
  return sub ? subscriptionData(sub) : null;
}

export async function subscribeToPush(
  onStage?: (stage: PushEnableStage) => void,
): Promise<PushSubscriptionData> {
  const blocker = getPushBlocker();
  if (blocker === "needs-install") {
    throw new Error(
      "On iPhone and iPad, add MEUTUALS to your Home Screen first, then open it from there to turn notifications on.",
    );
  }
  if (blocker === "insecure") {
    throw new Error("Push requires a secure HTTPS connection.");
  }
  if (!isPushSupported()) throw new Error("Push not supported on this device.");

  onStage?.("permission");
  const permission = await withPushTimeout(
    Notification.requestPermission(),
    PERMISSION_TIMEOUT_MS,
    "The notification permission prompt did not respond. Close any open browser prompt and try again.",
  );
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked. Enable them in your browser settings."
        : "Permission was not granted.",
    );
  }

  onStage?.("service");
  const reg = await getRegistration();
  onStage?.("subscription");
  let sub = await withPushTimeout(
    reg.pushManager.getSubscription(),
    SUBSCRIPTION_TIMEOUT_MS,
    "MEUTUALS could not read this device's notification subscription. Try again.",
  );
  if (!sub) {
    const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    sub = await withPushTimeout(
      reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key.buffer.slice(
          key.byteOffset,
          key.byteOffset + key.byteLength,
        ) as ArrayBuffer,
      }),
      SUBSCRIPTION_TIMEOUT_MS,
      "This device did not finish enabling notifications. Check browser notification settings and try again.",
    );
  }

  return subscriptionData(sub);
}

export async function unsubscribeFromPush(): Promise<string | null> {
  const sub = await getCurrentSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
  return endpoint;
}
