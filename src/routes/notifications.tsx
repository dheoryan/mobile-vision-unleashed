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
};

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
    } else if (n.kind === "message") {
      intentStore.push({ kind: "openTab", tab: "discover" });
      navigate({ to: "/" });
    }
  };

  return (
    <div className="bg-habitat min-h-screen pb-16">
      <header className="glass sticky top-0 z-20 border-b border-border">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <p className="font-display text-sm font-bold">Notifications</p>
          <button
            onClick={() => markAllRead()}
            disabled={unread === 0}
            className="text-[11px] font-semibold text-primary disabled:text-muted-foreground"
          >
            Mark all read
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-3 pt-2">
        <EnablePushBanner />
        {isLoading ? (
          <p className="py-10 text-center text-xs text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell className="mx-auto h-12 w-12 text-muted-foreground" />}
            headline="Nothing yet. Get out there."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((n) => {
              const actorName = n.actor?.display_name?.trim() || "Someone";
              const actorAvatar = n.actor?.avatar_url || n.actor?.avatar_emoji || "👤";
              const isImg = actorAvatar.startsWith("data:") || actorAvatar.startsWith("http");
              const isUnread = !n.read_at;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-secondary/50 ${isUnread ? "bg-primary/5" : ""}`}
                  >
                    <span className="relative shrink-0">
                      <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-card text-xl">
                        {isImg ? (
                          <img src={actorAvatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          actorAvatar
                        )}
                      </span>
                      {showPlusBadge(n.actor?.plan) && <PlusBadge />}
                      <span className="absolute -bottom-0.5 -left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
                        {ICONS[n.kind]}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">
                        <span className="font-semibold">{actorName}</span>{" "}
                        <span className="text-muted-foreground">{TEXTS[n.kind]}</span>
                      </p>
                      {n.preview && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          "{n.preview}"
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {timeAgo(n.created_at)} ago
                      </p>
                    </div>
                    {isUnread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
