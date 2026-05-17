import { useSyncExternalStore } from "react";
import type { TabKey } from "@/components/mutuals/BottomNav";

export type Intent =
  | { kind: "openPost"; postId: string }
  | { kind: "openThreadWith"; userId: string }
  | { kind: "openTab"; tab: TabKey };

let intent: Intent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const getServerSnapshot = () => null;

export const intentStore = {
  get: () => intent,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  push: (i: Intent) => {
    intent = i;
    emit();
  },
  consume: () => {
    const i = intent;
    intent = null;
    emit();
    return i;
  },
};

export function useIntent() {
  return useSyncExternalStore(intentStore.subscribe, intentStore.get, getServerSnapshot);
}
