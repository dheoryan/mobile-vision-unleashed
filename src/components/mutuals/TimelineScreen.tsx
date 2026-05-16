import { useState } from "react";
import { PostCard } from "./PostCard";
import { AppHeader } from "./Shared";
import { useBlocked } from "@/lib/blocked-store";
import { useFeedPosts } from "@/lib/posts-store";
import { cn } from "@/lib/utils";
import type { Profile } from "./Onboarding";
import { tribeById, TRIBES, type TribeId } from "@/lib/mutuals-data";
import { ComposerModal } from "./ComposerModal";
import { Plus } from "lucide-react";

export function TimelineScreen({
  profile,
  onOpenMessages,
  unread,
}: {
  profile: Profile;
  onOpenMessages: () => void;
  unread?: number;
}) {
  const [tab, setTab] = useState<"tribe" | "foryou">("tribe");
  const blocked = useBlocked();

  // Tribe feed state
  const joinedTribes = TRIBES.filter((t) => profile.tribeIds.includes(t.id));
  const [activeTribe, setActiveTribe] = useState<TribeId>(profile.tribeIds[0]);
  const [composerOpen, setComposerOpen] = useState(false);
  const tribe = tribeById(activeTribe);

  // Tribe posts
  const tribeFeedQuery = useFeedPosts(activeTribe);
  const tribePosts = (tribeFeedQuery.data ?? []).filter((p) => !blocked.has(p.author_id));

  // For You posts (all tribes)
  const feedQuery = useFeedPosts();
  const forYouPosts = (feedQuery.data ?? []).filter((p) => !blocked.has(p.author_id));

  const isLoadingCurrent = tab === "tribe" ? tribeFeedQuery.isLoading : feedQuery.isLoading;
  const currentPosts = tab === "tribe" ? tribePosts : forYouPosts;

  return (
    <div className="bg-habitat min-h-screen pb-28">
      <AppHeader title="Timeline" subtitle="Signals" accent="var(--color-primary)" onOpenMessages={onOpenMessages} unread={unread} />
      <main className="mx-auto max-w-md px-5">

        {/* ── Tab switcher ── */}
        <div className="mt-4 flex gap-2 rounded-full bg-card p-1">
          <button
            onClick={() => setTab("tribe")}
            className={cn(
              "flex-1 rounded-full py-2 text-xs font-semibold transition-colors",
              tab === "tribe" ? "text-primary-foreground" : "text-muted-foreground"
            )}
            style={tab === "tribe" ? { backgroundColor: tribe.colorVar } : undefined}
          >
            {tribe.emoji} {tribe.name}
          </button>
          <button
            onClick={() => setTab("foryou")}
            className={cn(
              "flex-1 rounded-full py-2 text-xs font-semibold transition-colors",
              tab === "foryou" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            For You
          </button>
        </div>

        {/* ── Tribe selector strip (only on tribe tab, if multiple tribes) ── */}
        {tab === "tribe" && joinedTribes.length > 1 && (
          <div className="-mx-5 mt-3 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-2">
              {joinedTribes.map((t) => {
                const isActive = t.id === activeTribe;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTribe(t.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      isActive ? "text-primary-foreground" : "bg-secondary text-muted-foreground"
                    )}
                    style={isActive ? { backgroundColor: t.colorVar } : undefined}
                  >
                    <span>{t.emoji}</span>
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Hint text ── */}
        <p className="label-mono mt-3 text-muted-foreground">
          {tab === "tribe"
            ? `Posts from ${tribe.name} · chronological`
            : "Discover signals from every Tribe."}
        </p>

        {/* ── Post signal button (tribe tab only) ── */}
        {tab === "tribe" && (
          <button
            onClick={() => setComposerOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Post a signal to {tribe.name}
          </button>
        )}

        {/* ── Feed ── */}
        <div className="mt-3 flex flex-col gap-3">
          {isLoadingCurrent ? (
            <p className="py-10 text-center text-xs text-muted-foreground">Loading…</p>
          ) : currentPosts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              {tab === "tribe"
                ? `No posts in ${tribe.name} yet. Be the first to signal!`
                : "No posts yet."}
            </p>
          ) : (
            currentPosts.map((p) => (
              <PostCard key={p.id} post={p} showTribe={tab === "foryou"} />
            ))
          )}
        </div>
      </main>

      <ComposerModal open={composerOpen} onClose={() => setComposerOpen(false)} tribeId={activeTribe} />
    </div>
  );
}
