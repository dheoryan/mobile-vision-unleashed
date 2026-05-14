import { useSyncExternalStore } from "react";
import type { Profile } from "@/components/mutuals/Onboarding";

let profile: Profile | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const profileStore = {
  get: () => profile,
  set: (p: Profile | null) => { profile = p; emit(); },
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useMyProfile() {
  return useSyncExternalStore(profileStore.subscribe, profileStore.get, profileStore.get);
}

/** Convenience: avatar string (emoji or data URL) for current user, with safe fallback. */
export function useMyAvatar() {
  const p = useMyProfile();
  return p?.avatar ?? "🙂";
}

/** Convenience: display name for current user. */
export function useMyName() {
  const p = useMyProfile();
  return p?.name?.trim() || "You";
}
