import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyNotifications, type DerivedNotif } from "@/lib/social.functions";
import { useAuth } from "@/lib/auth-context";

export type { DerivedNotif } from "@/lib/social.functions";

const READ_KEY = "mutuals.notifs.lastRead";

function readLastRead(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(READ_KEY);
  return raw ? Number(raw) || 0 : 0;
}
function writeLastRead(ts: number) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(READ_KEY, String(ts)); } catch { /* ignore */ }
}

const NOTIFS_KEY = ["notifications"] as const;

export function useNotificationsQuery() {
  const fn = useServerFn(listMyNotifications);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...NOTIFS_KEY, user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Returns items + unread count derived from a localStorage "last read" cursor. */
export function useNotifications() {
  const q = useNotificationsQuery();
  const [lastRead, setLastRead] = useState<number>(() => readLastRead());

  useEffect(() => {
    const onStorage = () => setLastRead(readLastRead());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const items: DerivedNotif[] = q.data ?? [];
  const unread = items.filter((n) => new Date(n.created_at).getTime() > lastRead).length;

  return {
    items,
    unread,
    isLoading: q.isLoading,
    markAllRead: () => {
      const ts = Date.now();
      writeLastRead(ts);
      setLastRead(ts);
    },
  };
}
