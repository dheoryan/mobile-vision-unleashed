import { useSyncExternalStore } from "react";
import type { TabKey } from "@/components/mutuals/BottomNav";
import type { TribeId } from "@/lib/mutuals-data";

export type Intent =
  | { kind: "openPost"; postId: string; commentId?: string }
  | { kind: "scrollToPost"; postId: string }
  | { kind: "openThreadWith"; userId: string }
  | { kind: "openVenture"; ventureId: string; mode: "host" | "yours" }
  | { kind: "openVentureChat"; ventureId: string }
  | { kind: "openTab"; tab: TabKey }
  | { kind: "openTribe"; tribeId: TribeId };

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
  clear: () => {
    intent = null;
    emit();
  },
};

export function useIntent() {
  return useSyncExternalStore(intentStore.subscribe, intentStore.get, getServerSnapshot);
}
