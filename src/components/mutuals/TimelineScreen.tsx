import { useState } from "react";
import { POSTS } from "@/lib/mutuals-data";
import { PostCard } from "./PostCard";
import { AppHeader } from "./Shared";
import { cn } from "@/lib/utils";

export function TimelineScreen({ onOpenMessages, unread }: { onOpenMessages: () => void; unread?: number }) {
  const [tab, setTab] = useState<"following" | "foryou">("following");
  const following = POSTS.slice(0, 5);
  const forYou = [...POSTS].sort((a, b) => (a.id > b.id ? -1 : 1));
  const list = tab === "following" ? following : forYou;

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
              {t === "following" ? "Following" : "For You"}
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          {tab === "following" ? "From people you follow across all Tribes." : "Lightweight discovery beyond your Tribe."}
        </p>

        <div className="mt-3 flex flex-col gap-3">
          {list.map((p) => <PostCard key={p.id} post={p} showTribe />)}
        </div>
      </main>
    </div>
  );
}
