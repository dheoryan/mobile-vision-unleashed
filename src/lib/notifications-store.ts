import { useSyncExternalStore } from "react";
import { PEOPLE, POSTS } from "./mutuals-data";

export type NotifType = "like" | "comment" | "follow" | "hello" | "venture_match";

export interface Notif {
  id: string;
  actorId: string;
  type: NotifType;
  entityId?: string;
  text: string;
  time: string;
  readAt: number | null;
}

const seed: Notif[] = [
  { id: "n1", actorId: "u3", type: "hello",        entityId: "p3",  text: "sent you a Hello from a Venture 👋",                time: "2m",  readAt: null },
  { id: "n2", actorId: "u1", type: "like",         entityId: "p2",  text: "liked your post",                                    time: "14m", readAt: null },
  { id: "n3", actorId: "u4", type: "comment",      entityId: "p4",  text: "commented: \"open mic Friday — pulling a small crew\"", time: "1h",  readAt: null },
  { id: "n4", actorId: "u7", type: "follow",                          text: "started following you",                              time: "3h",  readAt: Date.now() },
  { id: "n5", actorId: "u6", type: "venture_match",                  text: "matched you on Coffee in Austin",                    time: "5h",  readAt: Date.now() },
  { id: "n6", actorId: "u5", type: "like",         entityId: "p1",  text: "liked your post",                                    time: "1d",  readAt: Date.now() },
];

let state: Notif[] = seed;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const notifStore = {
  get: () => state,
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  markAllRead: () => { state = state.map((n) => (n.readAt ? n : { ...n, readAt: Date.now() })); emit(); },
  markRead: (id: string) => { state = state.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? Date.now() } : n)); emit(); },
  add: (n: Omit<Notif, "id" | "time" | "readAt">) => {
    state = [{ ...n, id: `n-${Date.now()}`, time: "now", readAt: null }, ...state];
    emit();
  },
};

export function useNotifications() {
  const items = useSyncExternalStore(notifStore.subscribe, notifStore.get, notifStore.get);
  const unread = items.filter((n) => !n.readAt).length;
  return { items, unread };
}

export function actorAvatar(id: string) {
  return PEOPLE.find((p) => p.id === id);
}
export function postById(id?: string) {
  if (!id) return undefined;
  return POSTS.find((p) => p.id === id);
}
