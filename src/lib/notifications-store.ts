import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
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
  const markAllFn = useServerFn(markAllNotificationsRead);
  const markOneFn = useServerFn(markNotificationRead);
  const qc = useQueryClient();
  const items: NotificationRow[] = q.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  const markAll = useMutation({
    mutationFn: () => markAllFn(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: NOTIFS_KEY });
      const snapshots = qc.getQueriesData<NotificationRow[]>({ queryKey: NOTIFS_KEY });
      const readAt = new Date().toISOString();
      qc.setQueriesData<NotificationRow[]>({ queryKey: NOTIFS_KEY }, (notifications) =>
        notifications?.map((notification) =>
          notification.read_at ? notification : { ...notification, read_at: readAt },
        ),
      );
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [key, value] of context?.snapshots ?? []) qc.setQueryData(key, value);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: NOTIFS_KEY }),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => markOneFn({ data: { id } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: NOTIFS_KEY });
      const snapshots = qc.getQueriesData<NotificationRow[]>({ queryKey: NOTIFS_KEY });
      const readAt = new Date().toISOString();
      qc.setQueriesData<NotificationRow[]>({ queryKey: NOTIFS_KEY }, (notifications) =>
        notifications?.map((notification) =>
          notification.id === id && !notification.read_at
            ? { ...notification, read_at: readAt }
            : notification,
        ),
      );
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      for (const [key, value] of context?.snapshots ?? []) qc.setQueryData(key, value);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: NOTIFS_KEY }),
  });

  return {
    items,
    unread,
    isLoading: q.isLoading,
    isError: q.isError,
    error: q.error,
    refetch: q.refetch,
    isRefetching: q.isRefetching,
    markAllRead: markAll.mutateAsync,
    markNotificationRead: markOne.mutateAsync,
    markingAll: markAll.isPending,
  };
}
