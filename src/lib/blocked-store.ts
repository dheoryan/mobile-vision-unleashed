import { useSyncExternalStore } from "react";

const KEY = "mutuals.blocked";

const load = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
};

let blocked = load();
const listeners = new Set<() => void>();
const persist = () => { try { window.localStorage.setItem(KEY, JSON.stringify([...blocked])); } catch {} };
const emit = () => { persist(); listeners.forEach((l) => l()); };

export const blockedStore = {
  get: () => blocked,
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  block: (userId: string) => { blocked = new Set(blocked).add(userId); emit(); },
  unblock: (userId: string) => { const next = new Set(blocked); next.delete(userId); blocked = next; emit(); },
  isBlocked: (userId: string) => blocked.has(userId),
};

export function useBlocked() {
  return useSyncExternalStore(blockedStore.subscribe, blockedStore.get, blockedStore.get);
}
