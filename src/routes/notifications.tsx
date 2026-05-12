import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, Heart, MessageSquare, UserPlus, Sparkles, Bell } from "lucide-react";
import { useNotifications, notifStore, actorAvatar, postById, type NotifType } from "@/lib/notifications-store";
import { EmptyState } from "@/components/mutuals/EmptyState";
import { PlusBadge } from "@/components/mutuals/PlusBadge";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — MUTUALS" },
      { name: "description", content: "Likes, comments, follows, Hellos, and Venture matches in one place." },
    ],
  }),
  component: NotificationsPage,
});

const ICONS: Record<NotifType, React.ReactNode> = {
  like:          <Heart className="h-3 w-3" fill="currentColor" />,
  comment:       <MessageSquare className="h-3 w-3" />,
  follow:        <UserPlus className="h-3 w-3" />,
  hello:         <Sparkles className="h-3 w-3" />,
  venture_match: <Sparkles className="h-3 w-3" />,
};

function NotificationsPage() {
  const { items, unread } = useNotifications();

  // Mark visible as read after 2s
  useEffect(() => {
    const t = setTimeout(() => notifStore.markAllRead(), 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="bg-habitat min-h-screen pb-16">
      <header className="glass sticky top-0 z-20 border-b border-border">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <p className="font-display text-sm font-bold">Notifications</p>
          <button
            onClick={() => notifStore.markAllRead()}
            disabled={unread === 0}
            className="text-[11px] font-semibold text-primary disabled:text-muted-foreground"
          >
            Mark all read
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-3 pt-2">
        {items.length === 0 ? (
          <EmptyState icon={<Bell className="mx-auto h-12 w-12 text-muted-foreground" />} headline="Nothing yet. Get out there." />
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((n) => {
              const actor = actorAvatar(n.actorId);
              const post = postById(n.entityId);
              const unreadRow = !n.readAt;
              return (
                <li key={n.id}>
                  <Link
                    to="/"
                    onClick={() => notifStore.markRead(n.id)}
                    className={`flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-secondary/50 ${
                      unreadRow ? "border-l-2 border-primary bg-primary/5" : ""
                    }`}
                  >
                    <span className="relative shrink-0">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-xl">
                        {actor?.avatar ?? "👤"}
                      </span>
                      {actor?.plus && <PlusBadge />}
                      <span className="absolute -bottom-0.5 -left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
                        {ICONS[n.type]}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">
                        <span className="font-semibold">{actor?.name ?? "Someone"}</span>{" "}
                        <span className="text-muted-foreground">{n.text}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{n.time} ago</p>
                    </div>
                    {post?.image && (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-card text-xl">
                        {post.image}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
