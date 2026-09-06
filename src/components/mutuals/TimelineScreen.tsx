import { useEffect, useState } from "react";
import { PostCard } from "./PostCard";
import { FeatureIllustration } from "./FeatureIllustration";
import timelineArt from "@/assets/app-illustrations/timeline.webp";
import { AppHeader } from "./Shared";
import { useAuth } from "@/lib/auth-context";
import { useBlocked } from "@/lib/blocked-store";
import { useFeedPosts } from "@/lib/posts-store";
import { cn } from "@/lib/utils";
import type { Profile } from "./Onboarding";
import { tribeById, TRIBES, type TribeId } from "@/lib/mutuals-data";
import { ComposerModal } from "./ComposerModal";
import { CompassIcon } from "@phosphor-icons/react/dist/csr/Compass";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { TribeMark } from "./TribeMark";
import { FeedSkeleton } from "./Skeleton";

const TIMELINE_TAB_KEY = "mutuals.timeline-tab";

function timelineTabKey(userId: string): string {
  return `${TIMELINE_TAB_KEY}:${userId}`;
}

/**
 * `/p/$postId` is a separate top-level route, not a layer within this one -
 * visiting a post from a comment and hitting back unmounts and remounts
 * TimelineScreen, which used to reset this to its "tribe" default even if
 * the user had switched to The Wild right before leaving. Persisted the
 * same way the app's top-level tab already is (mutuals.tab:{userId}) so it
 * survives that round trip.
 */
function loadTimelineTab(userId: string | undefined): "tribe" | "global" {
  if (!userId || typeof window === "undefined") return "tribe";
  try {
    return window.localStorage.getItem(timelineTabKey(userId)) === "global" ? "global" : "tribe";
  } catch {
    return "tribe";
  }
}

export function TimelineScreen({
  profile,
  scrollToPostId,
  onScrolledToPost,
}: {
  profile: Profile;
  scrollToPostId?: string | null;
  onScrolledToPost?: () => void;
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"tribe" | "global">(() => loadTimelineTab(user?.id));
  const blocked = useBlocked();

  useEffect(() => {
    if (!user?.id) return;
    try {
      window.localStorage.setItem(timelineTabKey(user.id), tab);
    } catch {
      /* Storage can be unavailable in privacy modes. */
    }
  }, [tab, user?.id]);

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
  const globalPosts = (feedQuery.data ?? []).filter((p) => !blocked.has(p.author_id));

  const isLoadingCurrent = tab === "tribe" ? tribeFeedQuery.isLoading : feedQuery.isLoading;
  const isErrorCurrent = tab === "tribe" ? tribeFeedQuery.isError : feedQuery.isError;
  const refetchCurrent = tab === "tribe" ? tribeFeedQuery.refetch : feedQuery.refetch;
  const currentPosts = tab === "tribe" ? tribePosts : globalPosts;

  // Auto-switch tab + scroll + highlight when an intent targets a specific post
  useEffect(() => {
    if (!scrollToPostId) return;
    // Prefer the tab that contains this post; default to For You since it spans all tribes
    const inTribe = tribePosts.some((p) => p.id === scrollToPostId);
    if (!inTribe) setTab("global");
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
      <AppHeader title="Timeline" accent="var(--color-primary)" />
      <main className="mx-auto max-w-md px-5">
        {/* ── Tab switcher ── */}
        <div className="mt-4 flex gap-2 rounded-full bg-card p-1">
          {/* inline-flex + items-center on the button itself. The crest was a
              plain inline child of a block button, so it sat on the text
              baseline and rode high against the label. */}
          <button
            onClick={() => setTab("tribe")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              tab === "tribe" ? "text-primary-foreground" : "text-muted-foreground",
            )}
            style={tab === "tribe" ? { backgroundColor: tribe.colorVar } : undefined}
          >
            <TribeMark tribe={tribe} size="xs" />
            <span className="truncate">{tribe.name}</span>
          </button>
          <button
            onClick={() => setTab("global")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              tab === "global" ? "bg-meutuals-gradient text-white" : "text-muted-foreground",
            )}
          >
            <CompassIcon className="h-3.5 w-3.5" weight="fill" />
            <span className="truncate">The Wild</span>
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
                      "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isActive ? "text-primary-foreground" : "bg-secondary text-muted-foreground",
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
            ? `${tribe.name} only · chronological`
            : "Posts shared with everyone · chronological"}
        </p>

        {/* ── Feed ── */}
        <div className="mt-3 flex flex-col gap-3">
          {isLoadingCurrent ? (
            <FeedSkeleton />
          ) : isErrorCurrent ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <p className="text-xs text-muted-foreground">Couldn't load these signals.</p>
              <button
                onClick={() => void refetchCurrent()}
                className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Retry
              </button>
            </div>
          ) : currentPosts.length === 0 ? (
            /* True empty feed only — never during loading or error, so the
               artwork can't be mistaken for a loaded state. Pairs with the
               existing FAB rather than adding a competing CTA. */
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <FeatureIllustration src={timelineArt} />
              <p className="mt-4 text-xs text-muted-foreground">
                {tab === "tribe"
                  ? `No posts in ${tribe.name} yet. Be the first to signal!`
                  : "Nothing shared globally yet."}
              </p>
            </div>
          ) : (
            currentPosts.map((p) => <PostCard key={p.id} post={p} showTribe={tab === "global"} />)
          )}
        </div>
      </main>

      {/* One audience-aware creation action, aligned to the same centered
          column as the feed and lifted above the safe-area-aware bottom nav. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md justify-end px-5">
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          aria-label={tab === "global" ? "Post to The Wild" : `Post to ${tribe.name}`}
          className={cn(
            "pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-primary-foreground shadow-xl shadow-black/40 transition-[transform,filter] hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            tab === "global" && "bg-meutuals-gradient text-white",
          )}
          style={tab === "tribe" ? { backgroundColor: tribe.colorVar } : undefined}
        >
          <PlusIcon className="h-6 w-6" weight="bold" aria-hidden="true" />
        </button>
      </div>

      <ComposerModal
        key={tab}
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        tribeId={activeTribe}
        initialAudience={tab === "global" ? "all" : "tribe"}
      />
    </div>
  );
}
