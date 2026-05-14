import { useState } from "react";
import { PEOPLE } from "@/lib/mutuals-data";
import { PostCard } from "./PostCard";
import { AppHeader } from "./Shared";
import { EmptyState } from "./EmptyState";
import { useSocial } from "@/lib/social-store";
import { useBlocked } from "@/lib/blocked-store";
import { useFeedPosts } from "@/lib/posts-store";
import { Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { Profile } from "./Onboarding";

export function TimelineScreen({ onOpenMessages, unread }: { profile: Profile; onOpenMessages: () => void; unread?: number }) {
  const [tab, setTab] = useState<"following" | "foryou">("following");
  const social = useSocial();
  const blocked = useBlocked();
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
        <div className="mt-4 flex gap-2 rounded-full bg-card p-1">
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
    </div>
  );
}

void PEOPLE;
