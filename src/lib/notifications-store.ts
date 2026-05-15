import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyNotifications,
  markAllNotificationsRead,
  type NotificationRow,
} from "@/lib/notifications.functions";
import { useAuth } from "@/lib/auth-context";

export type DerivedNotif = NotificationRow;
export type { NotificationRow, NotificationKind } from "@/lib/notifications.functions";

const NOTIFS_KEY = ["notifications"] as const;

export function useNotificationsQuery() {
  const fn = useServerFn(listMyNotifications);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...NOTIFS_KEY, user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useNotifications() {
  const q = useNotificationsQuery();
  const markFn = useServerFn(markAllNotificationsRead);
  const qc = useQueryClient();
  const items: NotificationRow[] = q.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    try {
      await markFn();
      qc.invalidateQueries({ queryKey: NOTIFS_KEY });
    } catch {
      /* ignore */
    }
  };

  return {
    items,
    unread,
    isLoading: q.isLoading,
    markAllRead,
  };
}
