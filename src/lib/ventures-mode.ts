/**
 * Which half of the Ventures tab you were last in.
 *
 * This lives outside VenturesScreen so other screens can hand off into it —
 * Profile's Venture cards open straight into hosting rather than dropping you
 * on the deck to go find it. Keeping it in the component file would export a
 * non-component from a component module, which breaks Fast Refresh for the
 * whole screen.
 */
export type VentureMode = "look" | "host";

export const VENTURES_MODE_KEY = "mutuals:ventures:last-mode";

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredVentureMode(): VentureMode {
  return safeLocalStorage()?.getItem(VENTURES_MODE_KEY) === "host" ? "host" : "look";
}

export function saveStoredVentureMode(mode: VentureMode) {
  safeLocalStorage()?.setItem(VENTURES_MODE_KEY, mode);
}

/** Hand the Ventures tab off straight into hosting on its next open. */
export function preferVentureHostingOnNextOpen() {
  saveStoredVentureMode("host");
}
