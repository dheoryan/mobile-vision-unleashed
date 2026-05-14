import { useSyncExternalStore } from "react";

// Client-side only — likes & follows. Phase 3 will replace these with DB-backed
// server functions. Kept here so existing UI code keeps working.
interface State {
  liked: Set<string>;     // post ids the user has liked (local)
  following: Set<string>; // user ids the current user follows (local)
}

let state: State = {
  liked: new Set(),
  following: new Set(),
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const socialStore = {
  get: () => state,
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },

  toggleLike: (postId: string) => {
    const liked = new Set(state.liked);
    liked.has(postId) ? liked.delete(postId) : liked.add(postId);
    state = { ...state, liked };
    emit();
  },

  toggleFollow: (userId: string) => {
    const following = new Set(state.following);
    following.has(userId) ? following.delete(userId) : following.add(userId);
    state = { ...state, following };
    emit();
  },
};

export function useSocial() {
  return useSyncExternalStore(socialStore.subscribe, socialStore.get, socialStore.get);
}
