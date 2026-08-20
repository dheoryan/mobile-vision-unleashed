import { useEffect, useState } from "react";
import { PostCard } from "./PostCard";
import { AppHeader } from "./Shared";
import { useBlocked } from "@/lib/blocked-store";
import { useFeedPosts } from "@/lib/posts-store";
import { cn } from "@/lib/utils";
import type { Profile } from "./Onboarding";
import { tribeById, TRIBES, type TribeId } from "@/lib/mutuals-data";
import { ComposerModal } from "./ComposerModal";
import { Plus } from "lucide-react";
import { TribeMark } from "./TribeMark";

export function TimelineScreen({
  profile,
  onOpenMessages,
  unread,
  scrollToPostId,
  onScrolledToPost,
}: {
  profile: Profile;
  onOpenMessages: () => void;
  unread?: number;
  scrollToPostId?: string | null;
  onScrolledToPost?: () => void;
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
  const isErrorCurrent = tab === "tribe" ? tribeFeedQuery.isError : feedQuery.isError;
  const refetchCurrent = tab === "tribe" ? tribeFeedQuery.refetch : feedQuery.refetch;
  const currentPosts = tab === "tribe" ? tribePosts : forYouPosts;

  // Auto-switch tab + scroll + highlight when an intent targets a specific post
  useEffect(() => {
    if (!scrollToPostId) return;
    // Prefer the tab that contains this post; default to For You since it spans all tribes
    const inTribe = tribePosts.some((p) => p.id === scrollToPostId);
    if (!inTribe) setTab("foryou");
    const target = scrollToPostId;
    const attempt = (left: number) => {
      const el = document.querySelector<HTMLElement>(`[data-post-id="${target}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background");
        window.setTimeout(() => {
          el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background");
        }, 2200);
        onScrolledToPost?.();
        return;
      }
      if (left > 0) window.setTimeout(() => attempt(left - 1), 120);
      else onScrolledToPost?.();
    };
    window.setTimeout(() => attempt(20), 60);
  }, [scrollToPostId, tribePosts, onScrolledToPost]);

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
            <TribeMark tribe={tribe} size="xs" /> {tribe.name}
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
                    <TribeMark tribe={t} size="xs" />
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

        {/* ── Feed ── */}
        <div className="mt-3 flex flex-col gap-3">
          {isLoadingCurrent ? (
            <p className="py-10 text-center text-xs text-muted-foreground">Loading…</p>
          ) : isErrorCurrent ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <p className="text-xs text-muted-foreground">Couldn't load these signals.</p>
              <button
                onClick={() => void refetchCurrent()}
                className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                Retry
              </button>
            </div>
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

      <ComposerModal
        key={tab}
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        tribeId={activeTribe}
        initialAudience={tab === "foryou" ? "all" : "tribe"}
      />

      {/* ── Floating "post a signal" FAB ── */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 mx-auto flex max-w-md justify-end px-5">
        <button
          onClick={() => setComposerOpen(true)}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full px-4 py-3 text-xs font-semibold text-primary-foreground shadow-xl shadow-black/30 transition-transform active:scale-95"
          style={{ backgroundColor: tab === "foryou" ? "var(--primary)" : tribe.colorVar }}
          aria-label={tab === "foryou" ? "Post a signal to all Tribes" : `Post a signal to ${tribe.name}`}
        >
          <Plus className="h-4 w-4" /> {tab === "foryou" ? "Signal to All Tribes" : `Signal to ${tribe.name}`}
        </button>
      </div>
    </div>
  );
}
