export type PushPromptTrigger = "session" | "dm" | "post";

type Listener = (trigger: PushPromptTrigger) => void;
const listeners = new Set<Listener>();

export function onPushPromptRequest(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function requestPushPrompt(trigger: PushPromptTrigger) {
  for (const fn of listeners) {
    try { fn(trigger); } catch { /* ignore */ }
  }
}
