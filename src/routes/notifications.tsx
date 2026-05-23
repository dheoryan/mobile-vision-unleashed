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
import { timeAgo } from "@/lib/time";
import { showPlusBadge } from "@/lib/feature-flags";
import { TRIBES, type TribeId } from "@/lib/mutuals-data";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — MUTUALS" },
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
  venture_accept: <UserCheck className="h-3 w-3" />,
  venture_message: <MessageSquare className="h-3 w-3" />,
  tribe_join: <Users className="h-3 w-3" />,
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
  venture_accept: "bg-teal-500 text-white",
  venture_message: "bg-cyan-500 text-white",
  tribe_join: "bg-fuchsia-500 text-white",
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
  venture_accept: "accepted you into a Venture",
  venture_message: "sent a Venture message",
  tribe_join: "joined your Tribe",
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
    if (
      (n.kind === "like" ||
        n.kind === "comment" ||
        n.kind === "reply" ||
        n.kind === "mention" ||
        n.kind === "new_post") &&
      n.post_id
    ) {
      intentStore.push({ kind: "openPost", postId: n.post_id });
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
      intentStore.push({ kind: "openTab", tab: "discover" });
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
