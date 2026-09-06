import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { AtIcon } from "@phosphor-icons/react/dist/csr/At";
import { BellIcon } from "@phosphor-icons/react/dist/csr/Bell";
import { ChecksIcon } from "@phosphor-icons/react/dist/csr/Checks";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { HandIcon } from "@phosphor-icons/react/dist/csr/Hand";
import { HeartIcon } from "@phosphor-icons/react/dist/csr/Heart";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { QuotesIcon } from "@phosphor-icons/react/dist/csr/Quotes";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { RepeatIcon } from "@phosphor-icons/react/dist/csr/Repeat";
import { ArrowBendUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowBendUpLeft";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { UserCheckIcon } from "@phosphor-icons/react/dist/csr/UserCheck";
import { UserPlusIcon } from "@phosphor-icons/react/dist/csr/UserPlus";
import { UserMinusIcon } from "@phosphor-icons/react/dist/csr/UserMinus";
import { UserIcon } from "@phosphor-icons/react/dist/csr/User";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import { toast } from "sonner";
import {
  useNotifications,
  type NotificationKind,
  type NotificationRow,
} from "@/lib/notifications-store";
import { EmptyState } from "@/components/mutuals/EmptyState";
import { EnablePushBanner } from "@/components/mutuals/EnablePushBanner";
import { LazyImage } from "@/components/mutuals/LazyImage";
import { PlusBadge } from "@/components/mutuals/PlusBadge";
import { timeAgoLabel } from "@/lib/time";
import { showPlusBadge } from "@/lib/feature-flags";
import { NotifRowSkeleton } from "@/components/mutuals/Skeleton";
import {
  notificationCategory,
  notificationDestination,
  notificationSections,
  type NotificationCategory,
  type NotificationViewItem,
} from "@/lib/notification-presenter";
import { cn } from "@/lib/utils";
import { notificationHomeSearch } from "@/lib/notification-navigation";
import { intentStore } from "@/lib/intent-store";
import { useAuth } from "@/lib/auth-context";
import { AppBootstrapSkeleton } from "@/components/mutuals/Skeleton";

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
  like: <HeartIcon className="h-3.5 w-3.5" weight="fill" />,
  comment: <ChatCircleIcon className="h-3.5 w-3.5" weight="fill" />,
  reply: <ArrowBendUpLeftIcon className="h-3.5 w-3.5" weight="fill" />,
  mention: <AtIcon className="h-3.5 w-3.5" weight="fill" />,
  follow: <UserPlusIcon className="h-3.5 w-3.5" weight="fill" />,
  message: <EnvelopeSimpleIcon className="h-3.5 w-3.5" weight="fill" />,
  new_post: <SparkleIcon className="h-3.5 w-3.5" weight="fill" />,
  venture_apply: <UsersIcon className="h-3.5 w-3.5" weight="fill" />,
  venture_invite: <UsersIcon className="h-3.5 w-3.5" weight="fill" />,
  venture_accept: <UserCheckIcon className="h-3.5 w-3.5" weight="fill" />,
  venture_decline: <UserMinusIcon className="h-3.5 w-3.5" weight="fill" />,
  venture_invite_accept: <UserCheckIcon className="h-3.5 w-3.5" weight="fill" />,
  venture_invite_decline: <UserMinusIcon className="h-3.5 w-3.5" weight="fill" />,
  venture_withdraw: <UserMinusIcon className="h-3.5 w-3.5" weight="fill" />,
  venture_leave: <UserMinusIcon className="h-3.5 w-3.5" weight="fill" />,
  venture_message: <ChatCircleIcon className="h-3.5 w-3.5" weight="fill" />,
  tribe_join: <UsersIcon className="h-3.5 w-3.5" weight="fill" />,
  hello: <HandIcon className="h-3.5 w-3.5" weight="fill" />,
  hello_accepted: <HandIcon className="h-3.5 w-3.5" weight="fill" />,
  repost: <RepeatIcon className="h-3.5 w-3.5" weight="fill" />,
  quote: <QuotesIcon className="h-3.5 w-3.5" weight="fill" />,
  comment_like: <HeartIcon className="h-3.5 w-3.5" weight="fill" />,
  comment_repost: <RepeatIcon className="h-3.5 w-3.5" weight="fill" />,
  // Same Sparkle used everywhere else Tribevia shows up (TribeRoomLayer).
  tribe_pulse: <SparkleIcon className="h-3.5 w-3.5" weight="fill" />,
};

const CATEGORY_STYLES: Record<NotificationCategory, string> = {
  social: "bg-rose-500 text-white",
  conversation: "bg-primary text-primary-foreground",
  venture: "bg-accent text-accent-foreground",
  tribe: "bg-primary text-primary-foreground",
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
  venture_decline: "couldn't fit your Venture request",
  venture_invite_accept: "accepted your Venture invitation",
  venture_invite_decline: "passed on your Venture invitation",
  venture_withdraw: "withdrew their Venture request",
  venture_leave: "left your Venture",
  venture_message: "sent a Venture message",
  tribe_join: "joined your Tribe",
  hello: "said Hello",
  hello_accepted: "accepted your Hello",
  repost: "reposted your post",
  quote: "quoted your post",
  comment_like: "liked your comment",
  comment_repost: "reposted your comment",
  // Paired with the "New Tribevia" headline below (no actor name), not
  // "{actor} posted today's Tribevia" - same reasoning as buildPushCopy in
  // push-payload.ts, which has no single actor to name for this kind either.
  tribe_pulse: "is up",
};

function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    items,
    unread,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    markAllRead,
    markNotificationsRead,
    markingAll,
  } = useNotifications();
  const navigate = useNavigate();
  const { open } = Route.useSearch();
  const openedFromPush = useRef<string | null>(null);
  const sections = useMemo(() => notificationSections(items), [items]);

  const openDestination = useCallback(
    (notification: NotificationViewItem) => {
      const destination = notificationDestination(notification);
      if (destination.kind === "post") {
        void navigate({
          to: "/p/$postId",
          params: { postId: destination.postId },
          search: {
            from: "notifications",
            comment: destination.commentId,
          },
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
    (notification: NotificationViewItem) => {
      if (!notification.read_at) {
        void markNotificationsRead(notification.notification_ids).catch((markError: unknown) =>
          toast.error("Could not update this notification", {
            description: markError instanceof Error ? markError.message : "Try again shortly.",
          }),
        );
      }
      openDestination(notification);
    },
    [markNotificationsRead, openDestination],
  );

  useEffect(() => {
    if (!open || isLoading || openedFromPush.current === open) return;
    const notification = items.find(
      (item) => item.id === open || item.notification_ids.includes(open),
    );
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

  if (authLoading) {
    return <AppBootstrapSkeleton />;
  }

  // useNotifications' query is enabled: !!user, so a logged-out visitor
  // used to just see the same "no notifications yet" empty state real
  // notifications would produce - no hint that signing in would show
  // anything, and (unlike /p/$postId's equivalent gate) no return path
  // saved, so signing in separately landed them on the default tab
  // instead of back here.
  if (!user) {
    return (
      <div className="bg-habitat flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center">
          <p className="label-mono text-muted-foreground">Notifications</p>
          <h1 className="mt-2 font-display text-2xl font-bold">Sign in to see what's new.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            MEUTUALS is an 18+ community. Sign in first so activity can be shown.
          </p>
          <Link
            to="/login"
            onClick={() =>
              window.sessionStorage.setItem("meutuals:post-login-path", "/notifications")
            }
            className="mt-5 inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-habitat pb-16">
      <header className="glass sticky top-0 z-20 border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="mx-auto grid min-h-14 max-w-md grid-cols-[1fr_auto_1fr] items-center px-3">
          <Link
            to="/"
            aria-label="Back to MEUTUALS"
            className="flex h-11 w-11 shrink-0 items-center justify-center justify-self-start rounded-full text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <CaretLeftIcon className="h-5 w-5" />
          </Link>
          <div className="text-center">
            <h1 className="font-display text-sm font-bold">Notifications</h1>
            <span className="sr-only" aria-live="polite">
              {unread > 0 ? `${unread} new` : "Caught up"}
            </span>
          </div>
          <div className="flex justify-end">
            {unread > 0 ? (
              <button
                type="button"
                onClick={markEverythingRead}
                disabled={markingAll}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                <ChecksIcon className={cn("h-3.5 w-3.5", markingAll && "animate-pulse")} />
                Read all
              </button>
            ) : (
              <span className="px-2 text-xs text-muted-foreground">All read</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pt-3">
        <EnablePushBanner />

        {isLoading ? (
          <div className="space-y-1.5" aria-label="Loading notifications">
            {[0, 1, 2, 3].map((index) => (
              <NotifRowSkeleton key={index} />
            ))}
          </div>
        ) : isError ? (
          <section role="alert" className="mt-8 border-y border-border py-8 text-center">
            <WarningIcon className="mx-auto h-7 w-7 text-accent-readable" />
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
              <ArrowClockwiseIcon className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
              Try again
            </button>
          </section>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<BellIcon className="mx-auto h-12 w-12 text-muted-foreground" />}
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
            <p className="border-t border-border pt-5 text-center font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
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
  items: NotificationViewItem[];
  onSelect: (notification: NotificationViewItem) => void;
}) {
  const headingId = `notifications-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section className="pt-6" aria-labelledby={headingId}>
      <h2
        id={headingId}
        className={cn(
          "px-1 pb-1 font-display text-base font-bold",
          title === "New" ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {title}
      </h2>
      <ul className="space-y-1.5">
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
  notification: NotificationViewItem;
  onSelect: (notification: NotificationViewItem) => void;
}) {
  const actorName = notification.actor?.display_name?.trim() || "Someone";
  const actorAvatar = notification.actor?.avatar_url || notification.actor?.avatar_emoji;
  const isImage = Boolean(
    actorAvatar && (actorAvatar.startsWith("data:") || actorAvatar.startsWith("http")),
  );
  const isUnread = !notification.read_at;
  const category = notificationCategory(notification.kind);
  const isGroupedVentureMessage =
    notification.kind === "venture_message" && notification.message_count > 1;
  const additionalActors = Math.max(0, notification.actor_count - 1);

  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => onSelect(notification)}
        className={cn(
          "group relative flex min-h-[88px] w-full items-start gap-3 rounded-2xl px-3 py-4 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
          isUnread ? "bg-primary/[0.045]" : "hover:bg-card/35",
        )}
      >
        <span className="relative shrink-0">
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-card text-xl ring-1 ring-border">
            {isImage ? (
              <img src={actorAvatar} alt="" className="h-full w-full object-cover" />
            ) : actorAvatar ? (
              actorAvatar
            ) : (
              <UserIcon className="h-5 w-5 text-muted-foreground" />
            )}
          </span>
          {showPlusBadge(notification.actor?.plan) && <PlusBadge />}
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full",
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
            {notification.kind === "tribe_pulse" ? (
              // No actor span at all - a leading "Someone" reads like a
              // stranger did something, when actually nobody in particular
              // did. Same reasoning buildPushCopy already uses for this kind.
              <span className="font-semibold text-foreground">New Tribevia</span>
            ) : (
              <span className="font-semibold text-foreground">{actorName}</span>
            )}{" "}
            {notification.kind === "tribe_pulse" ? (
              <span className="text-muted-foreground">
                {TEXTS.tribe_pulse}
                {notification.conversation_name && (
                  <>
                    {" "}
                    in{" "}
                    <span className="font-medium text-foreground/90">
                      {notification.conversation_name}
                    </span>
                  </>
                )}
              </span>
            ) : isGroupedVentureMessage ? (
              <span className="text-muted-foreground">
                {additionalActors > 0 &&
                  `and ${additionalActors} other${additionalActors === 1 ? "" : "s"} `}
                sent {notification.message_count} messages
                {notification.conversation_name && (
                  <>
                    {" "}
                    in{" "}
                    <span className="font-medium text-foreground/90">
                      {notification.conversation_name}
                    </span>
                  </>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {TEXTS[notification.kind]}
                {(notification.kind === "venture_message" || notification.kind === "mention") &&
                  notification.conversation_name && (
                    <>
                      {" "}
                      in{" "}
                      <span className="font-medium text-foreground/90">
                        {notification.conversation_name}
                      </span>
                    </>
                  )}
              </span>
            )}
          </span>
          {notification.preview && (
            <span className="mt-1.5 line-clamp-2 block text-xs leading-relaxed text-foreground/75">
              “{notification.preview}”
            </span>
          )}
          <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {timeAgoLabel(notification.created_at)}
            {isUnread && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-meutuals-gradient"
                aria-hidden
              />
            )}
          </span>
        </span>

        <span className="flex min-h-11 shrink-0 items-center">
          {notification.post_image_url ? (
            <LazyImage
              src={notification.post_image_url}
              alt=""
              wrapperClassName="h-11 w-11 rounded-md"
              className="h-11 w-11 rounded-md object-cover"
            />
          ) : (
            <CaretRightIcon className="h-4 w-4 text-muted-foreground transition-transform group-active:translate-x-0.5" />
          )}
        </span>
      </button>
    </li>
  );
}
