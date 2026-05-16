import { useState } from "react";
import { PostCard } from "./PostCard";
import { AppHeader, SectionTitle } from "./Shared";
import { EmptyState } from "./EmptyState";
import { useSocial } from "@/lib/social-store";
import { useBlocked } from "@/lib/blocked-store";
import { useFeedPosts } from "@/lib/posts-store";
import { Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
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
  const [tab, setTab] = useState<"following" | "foryou">("following");
  const social = useSocial();
  const blocked = useBlocked();

  // Tribe feed state
  const joinedTribes = TRIBES.filter((t) => profile.tribeIds.includes(t.id));
  const [activeTribe, setActiveTribe] = useState<TribeId>(profile.tribeIds[0]);
  const [composerOpen, setComposerOpen] = useState(false);
  const tribe = tribeById(activeTribe);

  // Tribe posts
  const tribeFeedQuery = useFeedPosts(activeTribe);
  const tribePosts = (tribeFeedQuery.data ?? []).filter((p) => !blocked.has(p.author_id));

  // Timeline posts
  const feedQuery = useFeedPosts();
  const allPosts = feedQuery.data ?? [];
  const visiblePosts = allPosts.filter((p) => !blocked.has(p.author_id));
  const followingPosts = visiblePosts.filter((p) => social.following.has(p.author_id));
  const forYou = visiblePosts;
  const list = tab === "following" ? followingPosts : forYou;

  return (
    <div className="bg-habitat min-h-screen pb-28">
      <AppHeader title="Timeline" subtitle="Signals" accent="var(--color-primary)" onOpenMessages={onOpenMessages} unread={unread} />
      <main className="mx-auto max-w-md px-5">

        {/* ── Tribe Feed Section ── */}
        <div className="mt-4">
          {/* Tribe selector strip if multiple tribes */}
          {joinedTribes.length > 1 && (
            <div className="-mx-5 mb-3 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex gap-2">
                {joinedTribes.map((t) => {
                  const isActive = t.id === activeTribe;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTribe(t.id)}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                        isActive ? "text-primary-foreground" : "bg-card text-muted-foreground"
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

          <div className="flex items-center justify-between">
            <SectionTitle
              title={`${tribe.emoji} ${tribe.name}`}
              hint="Posts from your scene · chronological"
            />
            <button
              onClick={() => setComposerOpen(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              style={{ backgroundColor: tribe.colorVar }}
            >
              <Plus className="h-3.5 w-3.5" /> Signal
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-3">
            {tribeFeedQuery.isLoading ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
            ) : tribePosts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                No posts in {tribe.name} yet. Be the first to signal!
              </p>
            ) : (
              tribePosts.slice(0, 5).map((p) => <PostCard key={p.id} post={p} />)
            )}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="label-mono text-muted-foreground">Your Timeline</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* ── Timeline feed ── */}
        <div className="flex gap-2 rounded-full bg-card p-1">
          {(["following", "foryou"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 rounded-full py-2 text-xs font-semibold transition-colors",
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {t === "following" ? `Following · ${social.following.size}` : "For You"}
            </button>
          ))}
        </div>

        <p className="label-mono mt-4 text-muted-foreground">
          {tab === "following"
            ? "From people you follow across all Tribes."
            : "Discover signals from every Tribe."}
        </p>

        <div className="mt-3 flex flex-col gap-3">
          {feedQuery.isLoading ? (
            <p className="py-10 text-center text-xs text-muted-foreground">Loading…</p>
          ) : list.length === 0 && tab === "following" ? (
            <EmptyState
              icon={<Users className="mx-auto h-12 w-12 text-muted-foreground" />}
              headline="Your Following feed is quiet."
              sub="Follow people on Discover and their posts will show up here."
              action={<Link to="/" className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Find people</Link>}
            />
          ) : list.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">No posts yet.</p>
          ) : (
            list.map((p) => <PostCard key={p.id} post={p} showTribe />)
          )}
        </div>
      </main>

      <ComposerModal open={composerOpen} onClose={() => setComposerOpen(false)} tribeId={activeTribe} />
    </div>
  );
}
