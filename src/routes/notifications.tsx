import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, Heart, MessageSquare, UserPlus, Bell } from "lucide-react";
import { useNotifications, type DerivedNotif } from "@/lib/notifications-store";
import { intentStore } from "@/lib/intent-store";
import { EmptyState } from "@/components/mutuals/EmptyState";
import { PlusBadge } from "@/components/mutuals/PlusBadge";
import { timeAgo } from "@/lib/time";
import { showPlusBadge } from "@/lib/feature-flags";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — MUTUALS" },
      { name: "description", content: "Likes, comments, follows, Hellos, and Venture matches in one place." },
    ],
  }),
  component: NotificationsPage,
});

const ICONS: Record<DerivedNotif["type"], React.ReactNode> = {
  like:    <Heart className="h-3 w-3" fill="currentColor" />,
  comment: <MessageSquare className="h-3 w-3" />,
  follow:  <UserPlus className="h-3 w-3" />,
};

const TEXTS: Record<DerivedNotif["type"], string> = {
  like:    "liked your post",
  comment: "commented on your post",
  follow:  "started following you",
};

function NotificationsPage() {
  const { items, unread, isLoading, markAllRead } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => markAllRead(), 2000);
    return () => clearTimeout(t);
  }, [markAllRead]);

  const handleClick = (n: DerivedNotif) => {
    if ((n.type === "like" || n.type === "comment") && n.post_id) {
      intentStore.push({ kind: "openPost", postId: n.post_id });
    } else if (n.type === "follow") {
      intentStore.push({ kind: "openTab", tab: "discover" });
    }
    navigate({ to: "/" });
  };

  return (
    <div className="bg-habitat min-h-screen pb-16">
      <header className="glass sticky top-0 z-20 border-b border-border">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
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
        {isLoading ? (
          <p className="py-10 text-center text-xs text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <EmptyState icon={<Bell className="mx-auto h-12 w-12 text-muted-foreground" />} headline="Nothing yet. Get out there." />
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((n) => {
              const actorName = n.actor?.display_name?.trim() || "Someone";
              const actorAvatar = n.actor?.avatar_url || n.actor?.avatar_emoji || "👤";
              const isImg = actorAvatar.startsWith("data:") || actorAvatar.startsWith("http");
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-secondary/50"
                  >
                    <span className="relative shrink-0">
                      <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-card text-xl">
                        {isImg ? <img src={actorAvatar} alt="" className="h-full w-full object-cover" /> : actorAvatar}
                      </span>
                      {n.actor?.plan === "plus" && <PlusBadge />}
                      <span className="absolute -bottom-0.5 -left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
                        {ICONS[n.type]}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">
                        <span className="font-semibold">{actorName}</span>{" "}
                        <span className="text-muted-foreground">{TEXTS[n.type]}</span>
                      </p>
                      {n.comment_excerpt && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">"{n.comment_excerpt}"</p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(n.created_at)} ago</p>
                    </div>
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
