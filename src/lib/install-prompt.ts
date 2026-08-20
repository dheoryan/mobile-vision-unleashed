// Captures the Android `beforeinstallprompt` event so we can trigger
// the native "Add to Home screen" dialog from anywhere in the app.

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BIPEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

function notify() {
  const available = deferred !== null;
  for (const fn of listeners) {
    try { fn(available); } catch { /* ignore */ }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BIPEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export function canInstallNow(): boolean {
  return deferred !== null;
}

export function onInstallAvailabilityChange(fn: (available: boolean) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export async function triggerInstallPrompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  try {
    await deferred.prompt();
    const choice = await deferred.userChoice;
    deferred = null;
    notify();
    return choice.outcome;
  } catch {
    return "dismissed";
  }
}
