// VAPID public key (safe to ship in the client bundle)
export const VAPID_PUBLIC_KEY =
  "BJPHTQJ4qyDf9_YrT0HbcZ6GeNMs-3DsV7Awdos-dj1F8FmvqcTMCBs5nSNQ2Uw2nt-uJ8bkHB-Abh-599_wqJk";

export type PushAvailability = "available" | "blocked" | "needs-install" | "unsupported";

export interface PushCapabilitySnapshot {
  appleMobile: boolean;
  standalone: boolean;
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
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
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
  const desktopModeIpad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return (classicIos || desktopModeIpad) && !("MSStream" in window);
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function evaluatePushAvailability(snapshot: PushCapabilitySnapshot): PushAvailability {
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

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function subscribeToPush(): Promise<{
  endpoint: string;
  p256dh: string;
  auth: string;
} | null> {
  if (!isPushSupported()) throw new Error("Push not supported on this device.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked. Enable them in your browser settings."
        : "Permission was not granted.",
    );
  }

  const reg = await getRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key.buffer.slice(
        key.byteOffset,
        key.byteOffset + key.byteLength,
      ) as ArrayBuffer,
    });
  }

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const p256dh = json.keys?.p256dh ?? arrayBufferToBase64Url(sub.getKey("p256dh")!);
  const auth = json.keys?.auth ?? arrayBufferToBase64Url(sub.getKey("auth")!);

  return { endpoint: sub.endpoint, p256dh, auth };
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
