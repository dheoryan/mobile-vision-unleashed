import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  AtSign,
  Bell,
  CheckCheck,
  ChevronRight,
  Hand,
  Heart,
  Mail,
  MessageSquare,
  RefreshCw,
  Reply,
  Sparkles,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  useNotifications,
  type NotificationKind,
  type NotificationRow,
} from "@/lib/notifications-store";
import { EmptyState } from "@/components/mutuals/EmptyState";
import { EnablePushBanner } from "@/components/mutuals/EnablePushBanner";
import { PlusBadge } from "@/components/mutuals/PlusBadge";
import { timeAgoLabel } from "@/lib/time";
import { showPlusBadge } from "@/lib/feature-flags";
import { NotifRowSkeleton } from "@/components/mutuals/Skeleton";
import {
  notificationActionLabel,
  notificationCategory,
  notificationDestination,
  notificationSections,
  type NotificationCategory,
} from "@/lib/notification-presenter";
import { cn } from "@/lib/utils";
import { notificationHomeSearch } from "@/lib/notification-navigation";
import { intentStore } from "@/lib/intent-store";

interface NotificationsSearch {
  open?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/notifications")({
  validateSearch: (search: Record<string, unknown>): NotificationsSearch => ({
    open:
      typeof search.open === "string" && UUID_PATTERN.test(search.open) ? search.open : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Notifications — MEUTUALS — Your tribe is waiting" },
      { name: "description", content: "Your MEUTUALS activity and invitations." },
    ],
  }),
  component: NotificationsPage,
});

const ICONS: Record<NotificationKind, React.ReactNode> = {
  like: <Heart className="h-3.5 w-3.5" fill="currentColor" />,
  comment: <MessageSquare className="h-3.5 w-3.5" />,
  reply: <Reply className="h-3.5 w-3.5" />,
  mention: <AtSign className="h-3.5 w-3.5" />,
  follow: <UserPlus className="h-3.5 w-3.5" />,
  message: <Mail className="h-3.5 w-3.5" />,
  new_post: <Sparkles className="h-3.5 w-3.5" />,
  venture_apply: <Users className="h-3.5 w-3.5" />,
  venture_invite: <Users className="h-3.5 w-3.5" />,
  venture_accept: <UserCheck className="h-3.5 w-3.5" />,
  venture_message: <MessageSquare className="h-3.5 w-3.5" />,
  tribe_join: <Users className="h-3.5 w-3.5" />,
  hello: <Hand className="h-3.5 w-3.5" />,
  hello_accepted: <Hand className="h-3.5 w-3.5" />,
};

const CATEGORY_STYLES: Record<NotificationCategory, string> = {
  social: "bg-rose-500/15 text-rose-400",
  conversation: "bg-primary/15 text-primary",
  venture: "bg-accent/15 text-accent",
  tribe: "bg-primary/15 text-primary",
};

const TEXTS: Record<NotificationKind, string> = {
  like: "liked your post",
  comment: "commented on your post",
  reply: "replied to your comment",
  mention: "mentioned you",
  follow: "saved your profile",
  message: "sent you a message",
  new_post: "shared a new signal",
  venture_apply: "asked to join your Venture",
  venture_invite: "invited you to a Venture",
  venture_accept: "accepted you into a Venture",
  venture_message: "sent a Venture message",
  tribe_join: "joined your Tribe",
  hello: "said Hello",
  hello_accepted: "accepted your Hello",
};

function NotificationsPage() {
  const {
    items,
    unread,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    markAllRead,
    markNotificationRead,
    markingAll,
  } = useNotifications();
  const navigate = useNavigate();
  const { open } = Route.useSearch();
  const openedFromPush = useRef<string | null>(null);
  const sections = useMemo(() => notificationSections(items), [items]);

  const openDestination = useCallback(
    (notification: NotificationRow) => {
      const destination = notificationDestination(notification);
      if (destination.kind === "post") {
        void navigate({
          to: "/p/$postId",
          params: { postId: destination.postId },
        });
        return;
      }
      if (destination.kind === "profile") {
        void navigate({
          to: "/u/$handle",
          params: { handle: notification.actor?.handle ?? destination.actorId },
        });
        return;
      }

      const search = notificationHomeSearch(destination);
      if (search) {
        intentStore.clear();
        void navigate({ to: "/", search });
      }
    },
    [navigate],
  );

  const selectNotification = useCallback(
    (notification: NotificationRow) => {
      if (!notification.read_at) {
        void markNotificationRead(notification.id).catch((markError: unknown) =>
          toast.error("Could not update this notification", {
            description: markError instanceof Error ? markError.message : "Try again shortly.",
          }),
        );
      }
      openDestination(notification);
    },
    [markNotificationRead, openDestination],
  );

  useEffect(() => {
    if (!open || isLoading || openedFromPush.current === open) return;
    const notification = items.find((item) => item.id === open);
    if (!notification) return;
    openedFromPush.current = open;
    selectNotification(notification);
  }, [isLoading, items, open, selectNotification]);

  const markEverythingRead = () => {
    void markAllRead().catch((markError: unknown) =>
      toast.error("Could not mark notifications read", {
        description: markError instanceof Error ? markError.message : "Try again shortly.",
      }),
    );
  };

  return (
    <div className="min-h-screen bg-habitat pb-16">
      <header className="glass sticky top-0 z-20 border-b border-border">
        <div className="mx-auto grid min-h-14 max-w-md grid-cols-[1fr_auto_1fr] items-center px-3">
          <Link
            to="/"
            aria-label="Back to MEUTUALS"
            className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="text-center">
            <h1 className="font-display text-sm font-bold">Notifications</h1>
            <p
              className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground"
              aria-live="polite"
            >
              {unread > 0 ? `${unread} new` : "Caught up"}
            </p>
          </div>
          <div className="flex justify-end">
            {unread > 0 ? (
              <button
                type="button"
                onClick={markEverythingRead}
                disabled={markingAll}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                <CheckCheck className={cn("h-3.5 w-3.5", markingAll && "animate-pulse")} />
                Read all
              </button>
            ) : (
              <span className="px-2 text-[10px] text-muted-foreground">All read</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pt-3">
        <EnablePushBanner />

        {isLoading ? (
          <div className="space-y-1 py-4" aria-label="Loading notifications">
            {[0, 1, 2, 3].map((index) => (
              <NotifRowSkeleton key={index} />
            ))}
          </div>
        ) : isError ? (
          <section role="alert" className="mt-8 border-y border-border py-8 text-center">
            <AlertTriangle className="mx-auto h-7 w-7 text-accent" />
            <h2 className="mt-3 font-display text-lg font-bold">Activity could not load.</h2>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
              {error instanceof Error ? error.message : "Check your connection and try again."}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isRefetching}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
              Try again
            </button>
          </section>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell className="mx-auto h-12 w-12 text-muted-foreground" />}
            headline="You’re all caught up."
            sub="Hellos, replies, Venture updates, and new conversations will appear here."
          />
        ) : (
          <div className="pb-8">
            {sections.map((section) => (
              <NotificationSection
                key={section.key}
                title={section.label}
                items={section.items}
                onSelect={selectNotification}
              />
            ))}
            <p className="border-t border-border pt-5 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              Latest activity · {items.length} shown
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function NotificationSection({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: NotificationRow[];
  onSelect: (notification: NotificationRow) => void;
}) {
  const headingId = `notifications-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section className="pt-5" aria-labelledby={headingId}>
      <div className="flex items-center gap-3 pb-2">
        <h2
          id={headingId}
          className={cn("label-mono", title === "New" ? "text-primary" : "text-muted-foreground")}
        >
          {title}
        </h2>
        <span className="h-px flex-1 bg-border" aria-hidden />
        <span className="font-mono text-[9px] text-muted-foreground">{items.length}</span>
      </div>
      <ul className="divide-y divide-border/70 border-y border-border/70">
        {items.map((notification) => (
          <NotificationRowItem
            key={notification.id}
            notification={notification}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </section>
  );
}

function NotificationRowItem({
  notification,
  onSelect,
}: {
  notification: NotificationRow;
  onSelect: (notification: NotificationRow) => void;
}) {
  const actorName = notification.actor?.display_name?.trim() || "Someone";
  const actorAvatar = notification.actor?.avatar_url || notification.actor?.avatar_emoji;
  const isImage = Boolean(
    actorAvatar && (actorAvatar.startsWith("data:") || actorAvatar.startsWith("http")),
  );
  const isUnread = !notification.read_at;
  const category = notificationCategory(notification.kind);

  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => onSelect(notification)}
        className={cn(
          "group relative flex min-h-[88px] w-full items-start gap-3 px-1 py-3.5 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
          isUnread ? "bg-primary/[0.045]" : "hover:bg-card/35",
        )}
      >
        {isUnread && (
          <span
            className="absolute inset-y-3 -left-5 w-0.5 rounded-r-full bg-primary"
            aria-hidden
          />
        )}

        <span className="relative shrink-0">
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-card text-xl ring-1 ring-border">
            {isImage ? (
              <img src={actorAvatar} alt="" className="h-full w-full object-cover" />
            ) : actorAvatar ? (
              actorAvatar
            ) : (
              <UserRound className="h-5 w-5 text-muted-foreground" />
            )}
          </span>
          {showPlusBadge(notification.actor?.plan) && <PlusBadge />}
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-background",
              CATEGORY_STYLES[category],
            )}
            aria-hidden
          >
            {ICONS[notification.kind]}
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-snug">
            {isUnread && <span className="sr-only">Unread. </span>}
            <span className="font-semibold text-foreground">{actorName}</span>{" "}
            <span className="text-muted-foreground">{TEXTS[notification.kind]}</span>
          </span>
          {notification.preview && (
            <span className="mt-1.5 line-clamp-2 block text-xs leading-relaxed text-foreground/75">
              “{notification.preview}”
            </span>
          )}
          <span className="mt-2 flex items-center gap-2 text-[10px]">
            <span className="text-muted-foreground">{timeAgoLabel(notification.created_at)}</span>
            <span className="text-border" aria-hidden>
              ·
            </span>
            <span className="font-semibold text-primary">
              {notificationActionLabel(notification.kind)}
            </span>
          </span>
        </span>

        <span className="flex min-h-11 shrink-0 items-center">
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-active:translate-x-0.5" />
        </span>
      </button>
    </li>
  );
}
