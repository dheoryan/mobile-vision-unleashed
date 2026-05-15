import type { PushPromptTrigger } from "./push-prompt-events";

const SESSION_KEY = "mutuals.push-prompt.shownThisSession";
const STATE_PREFIX = "mutuals.push-prompt.state:";

const SOFT_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const HARD_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type DismissReason = "soft" | "hard";

interface State {
  lastDismissedAt?: number;
  dismissReason?: DismissReason;
  enabled?: boolean;
}

function safeWindow(): boolean {
  return typeof window !== "undefined";
}

function key(userId: string) {
  return STATE_PREFIX + userId;
}

function readState(userId: string): State {
  if (!safeWindow()) return {};
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as State) : {};
  } catch {
    return {};
  }
}

function writeState(userId: string, s: State) {
  if (!safeWindow()) return;
  try { localStorage.setItem(key(userId), JSON.stringify(s)); } catch { /* ignore */ }
}

export function shouldShowPrompt(
  userId: string,
  trigger: PushPromptTrigger,
): boolean {
  if (!safeWindow()) return false;
  // One prompt per session, regardless of trigger.
  if (sessionStorage.getItem(SESSION_KEY) === "1") return false;

  const state = readState(userId);
  if (state.enabled) return false;

  const now = Date.now();
  const since = state.lastDismissedAt ? now - state.lastDismissedAt : Infinity;

  if (state.dismissReason === "hard" && since < HARD_COOLDOWN_MS) return false;
  if (state.dismissReason === "soft" && since < SOFT_COOLDOWN_MS) {
    // High-intent triggers bypass the soft cooldown.
    if (trigger === "session") return false;
  }
  return true;
}

export function markShownThisSession() {
  if (!safeWindow()) return;
  try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
}

export function markSkipped(userId: string, reason: DismissReason) {
  const s = readState(userId);
  writeState(userId, { ...s, lastDismissedAt: Date.now(), dismissReason: reason });
  markShownThisSession();
}

export function markEnabled(userId: string) {
  writeState(userId, { enabled: true });
  markShownThisSession();
}
