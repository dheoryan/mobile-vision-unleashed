import type { VentureParty } from "@/lib/ventures-store";
import type { TribeId } from "@/lib/mutuals-data";

export type AppTab = "feed" | "discover" | "ventures" | "chats" | "profile";

export type AppLayer =
  | { kind: "tribe"; tribeId?: TribeId }
  | { kind: "messages"; userId?: string | null; venture?: VentureParty | null }
  | { kind: "post"; postId: string; commentId?: string | null };

export type AppNavigationSnapshot = {
  tab: AppTab;
  layer?: AppLayer | null;
};

const APP_NAVIGATION_KEY = "__meutualsNavigation";
const APP_TABS = new Set<AppTab>(["feed", "discover", "ventures", "chats", "profile"]);

/**
 * Keep in-app screens in browser history so Android's system back and iOS's
 * edge-back gesture unwind Meutuals before the installed PWA/browser closes.
 * The existing TanStack Router state is preserved alongside our snapshot.
 */
export function writeAppNavigation(snapshot: AppNavigationSnapshot, replace = false) {
  if (typeof window === "undefined") return;
  const nextState = { ...(window.history.state ?? {}), [APP_NAVIGATION_KEY]: snapshot };
  const method = replace ? "replaceState" : "pushState";
  window.history[method](nextState, "", window.location.href);
}

export function readAppNavigation(state: unknown): AppNavigationSnapshot | null {
  if (!state || typeof state !== "object") return null;
  const candidate = (state as Record<string, unknown>)[APP_NAVIGATION_KEY];
  if (!candidate || typeof candidate !== "object") return null;
  const tab = (candidate as Record<string, unknown>).tab;
  if (typeof tab !== "string" || !APP_TABS.has(tab as AppTab)) return null;
  return candidate as AppNavigationSnapshot;
}

export function currentAppNavigation() {
  if (typeof window === "undefined") return null;
  return readAppNavigation(window.history.state);
}
