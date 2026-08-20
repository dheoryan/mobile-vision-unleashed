import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ArrowLeft,
  Heart,
  MessageSquare,
  UserPlus,
  Bell,
  AtSign,
  Reply,
  Mail,
  Sparkles,
  Users,
  UserCheck,
  Hand,
} from "lucide-react";
import {
  useNotifications,
  type NotificationRow,
  type NotificationKind,
} from "@/lib/notifications-store";
import { intentStore } from "@/lib/intent-store";
import { EmptyState } from "@/components/mutuals/EmptyState";
import { EnablePushBanner } from "@/components/mutuals/EnablePushBanner";
import { PlusBadge } from "@/components/mutuals/PlusBadge";
import { timeAgoLabel } from "@/lib/time";
import { showPlusBadge } from "@/lib/feature-flags";
import { TRIBES, type TribeId } from "@/lib/mutuals-data";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — MEUTUALS" },
      { name: "description", content: "Likes, comments, follows, mentions, and DMs in one place." },
    ],
  }),
  component: NotificationsPage,
});

const ICONS: Record<NotificationKind, React.ReactNode> = {
  like: <Heart className="h-3 w-3" fill="currentColor" />,
  comment: <MessageSquare className="h-3 w-3" />,
  reply: <Reply className="h-3 w-3" />,
  mention: <AtSign className="h-3 w-3" />,
  follow: <UserPlus className="h-3 w-3" />,
  message: <Mail className="h-3 w-3" />,
  new_post: <Sparkles className="h-3 w-3" />,
  venture_apply: <Users className="h-3 w-3" />,
  venture_invite: <Users className="h-3 w-3" />,
  venture_accept: <UserCheck className="h-3 w-3" />,
  venture_message: <MessageSquare className="h-3 w-3" />,
  tribe_join: <Users className="h-3 w-3" />,
  hello: <Hand className="h-3 w-3" />,
  hello_accepted: <Hand className="h-3 w-3" />,
};

// Per-kind accent colors (background tint for the small icon badge under the avatar).
const ICON_COLORS: Record<NotificationKind, string> = {
  like: "bg-rose-500 text-white",
  comment: "bg-sky-500 text-white",
  reply: "bg-indigo-500 text-white",
  mention: "bg-amber-500 text-white",
  follow: "bg-emerald-500 text-white",
  message: "bg-violet-500 text-white",
  new_post: "bg-primary text-primary-foreground",
  venture_apply: "bg-orange-500 text-white",
  venture_invite: "bg-amber-500 text-white",
  venture_accept: "bg-teal-500 text-white",
  venture_message: "bg-cyan-500 text-white",
  tribe_join: "bg-fuchsia-500 text-white",
  hello: "bg-primary text-primary-foreground",
  hello_accepted: "bg-emerald-500 text-white",
};

const TEXTS: Record<NotificationKind, string> = {
  like: "liked your post",
  comment: "commented on your post",
  reply: "replied to your comment",
  mention: "mentioned you",
  follow: "started following you",
  message: "sent you a message",
  new_post: "shared a new signal",
  venture_apply: "asked to join your Venture",
  venture_invite: "invited you to a Venture",
  venture_accept: "accepted you into a Venture",
  venture_message: "sent a Venture message",
  tribe_join: "joined your Tribe",
  hello: "said hello",
  hello_accepted: "accepted your Hello",
};

const isTribeId = (value: string | null): value is TribeId =>
  !!value && TRIBES.some((tribe) => tribe.id === value);

function NotificationsPage() {
  const { items, unread, isLoading, markAllRead } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => markAllRead(), 1500);
    return () => clearTimeout(t);
  }, [markAllRead]);

  const handleClick = (n: NotificationRow) => {
    if (n.kind === "new_post" && n.post_id) {
      intentStore.push({ kind: "scrollToPost", postId: n.post_id });
      navigate({ to: "/" });
    } else if (
      (n.kind === "like" ||
        n.kind === "comment" ||
        n.kind === "reply" ||
        n.kind === "mention") &&
      n.post_id
    ) {
      intentStore.push({
        kind: "openPost",
        postId: n.post_id,
        commentId: n.comment_id ?? undefined,
      });
      navigate({ to: "/" });
    } else if (n.kind === "follow") {
      if (n.actor?.id) {
        navigate({ to: "/u/$handle", params: { handle: n.actor.handle ?? n.actor.id } });
      } else {
        intentStore.push({ kind: "openTab", tab: "discover" });
        navigate({ to: "/" });
      }
    } else if (
      n.venture_id ||
      n.kind === "venture_apply" ||
      n.kind === "venture_invite" ||
      n.kind === "venture_accept" ||
      n.kind === "venture_message"
    ) {
      intentStore.push({ kind: "openTab", tab: "ventures" });
      navigate({ to: "/" });
    } else if (n.kind === "tribe_join") {
      if (isTribeId(n.tribe_id)) {
        intentStore.push({ kind: "openTribe", tribeId: n.tribe_id });
      } else {
        intentStore.push({ kind: "openTab", tab: "tribe" });
      }
      navigate({ to: "/" });
    } else if (n.kind === "message") {
      if (n.actor_id) {
        intentStore.push({ kind: "openThreadWith", userId: n.actor_id });
      } else {
        intentStore.push({ kind: "openTab", tab: "discover" });
      }
      navigate({ to: "/" });
    }
  };

  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const todayItems = items.filter((n) => now - new Date(n.created_at).getTime() < DAY);
  const earlierItems = items.filter((n) => now - new Date(n.created_at).getTime() >= DAY);

  return (
    <div className="bg-habitat min-h-screen pb-16">
      <header className="glass sticky top-0 z-20 border-b border-border">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <p className="font-display text-sm font-bold">Notifications</p>
            {unread > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>
          <button
            onClick={() => markAllRead()}
            disabled={unread === 0}
            className="rounded-full px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:text-muted-foreground disabled:hover:bg-transparent"
          >
            Mark all read
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-3 pt-2">
        <EnablePushBanner />
        {isLoading ? (
          <div className="space-y-2 py-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex animate-pulse items-center gap-3 rounded-xl bg-card/40 px-3 py-3"
              >
                <div className="h-10 w-10 rounded-full bg-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-secondary" />
                  <div className="h-2 w-1/3 rounded bg-secondary/70" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell className="mx-auto h-12 w-12 text-muted-foreground" />}
            headline="Nothing yet. Get out there."
          />
        ) : (
          <div className="space-y-5 pt-1">
            {todayItems.length > 0 && (
              <Section title="Today" items={todayItems} onClick={handleClick} />
            )}
            {earlierItems.length > 0 && (
              <Section title="Earlier" items={earlierItems} onClick={handleClick} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Section({
  title,
  items,
  onClick,
}: {
  title: string;
  items: NotificationRow[];
  onClick: (n: NotificationRow) => void;
}) {
  return (
    <section>
      <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((n) => (
          <NotificationRowItem key={n.id} n={n} onClick={onClick} />
        ))}
      </ul>
    </section>
  );
}

function NotificationRowItem({
  n,
  onClick,
}: {
  n: NotificationRow;
  onClick: (n: NotificationRow) => void;
}) {
  const actorName = n.actor?.display_name?.trim() || "Someone";
  const actorAvatar = n.actor?.avatar_url || n.actor?.avatar_emoji || "👤";
  const isImg = actorAvatar.startsWith("data:") || actorAvatar.startsWith("http");
  const isUnread = !n.read_at;
  return (
    <li>
      <button
        type="button"
        onClick={() => onClick(n)}
        className={`group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border px-3 py-3 text-left transition-all hover:-translate-y-[1px] hover:shadow-sm ${
          isUnread
            ? "border-primary/20 bg-primary/[0.06]"
            : "border-transparent bg-card/40 hover:bg-secondary/40"
        }`}
      >
        {isUnread && (
          <span
            className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary"
            aria-hidden
          />
        )}
        <span className="relative shrink-0">
          <span
            className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-card text-xl ${
              isUnread ? "ring-2 ring-primary/30" : ""
            }`}
          >
            {isImg ? (
              <img src={actorAvatar} alt="" className="h-full w-full object-cover" />
            ) : (
              actorAvatar
            )}
          </span>
          {showPlusBadge(n.actor?.plan) && <PlusBadge />}
          <span
            className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background ${ICON_COLORS[n.kind]}`}
          >
            {ICONS[n.kind]}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug">
            <span className="font-semibold">{actorName}</span>{" "}
            <span className="text-muted-foreground">{TEXTS[n.kind]}</span>
          </p>
          {n.preview && (
            <p className="mt-1 line-clamp-2 rounded-lg bg-background/60 px-2 py-1 text-xs italic text-muted-foreground">
              "{n.preview}"
            </p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground/80">
            {timeAgoLabel(n.created_at)}
          </p>
        </div>
        {isUnread && (
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-primary)_20%,transparent)]" />
        )}
      </button>
    </li>
  );
}
