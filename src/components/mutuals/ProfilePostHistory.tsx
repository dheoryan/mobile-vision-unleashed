import { useMemo, useState } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { ArrowsDownUpIcon } from "@phosphor-icons/react/dist/csr/ArrowsDownUp";
import type { FeedPost } from "@/lib/posts-store";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { TribeMark } from "./TribeMark";
import { PostCard } from "./PostCard";
import { cn } from "@/lib/utils";

type SortKey = "newest" | "oldest" | "likes";

export function ProfilePostHistory({
  posts,
  searchPlaceholder = "Search your posts",
  noMatchesCopy = "No posts match those filters.",
}: {
  posts: FeedPost[];
  searchPlaceholder?: string;
  noMatchesCopy?: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [tribeFilter, setTribeFilter] = useState<string | null>(null);

  const tribes = useMemo(() => {
    const set = new Set(posts.map((p) => p.tribe_id));
    return [...set];
  }, [posts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = posts;
    if (tribeFilter) rows = rows.filter((p) => p.tribe_id === tribeFilter);
    if (q) rows = rows.filter((p) => p.content.toLowerCase().includes(q));
    const sorted = [...rows];
    const activityAt = (post: FeedPost) => post.profile_activity_at ?? post.created_at;
    if (sort === "newest")
      sorted.sort((a, b) => +new Date(activityAt(b)) - +new Date(activityAt(a)));
    if (sort === "oldest")
      sorted.sort((a, b) => +new Date(activityAt(a)) - +new Date(activityAt(b)));
    if (sort === "likes") sorted.sort((a, b) => (b.likes_count ?? 0) - (a.likes_count ?? 0));
    return sorted;
  }, [posts, query, sort, tribeFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, FeedPost[]>();
    for (const p of filtered) {
      const d = new Date(p.profile_activity_at ?? p.created_at);
      const key = d.toLocaleString(undefined, { month: "long", year: "numeric" });
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  const cycleSort = () => {
    setSort((s) => (s === "newest" ? "oldest" : s === "oldest" ? "likes" : "newest"));
  };
  const sortLabel = sort === "newest" ? "Newest" : sort === "oldest" ? "Oldest" : "Most liked";

  return (
    <div>
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-8 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </div>
          <button
            onClick={cycleSort}
            className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowsDownUpIcon className="h-3 w-3" /> {sortLabel}
          </button>
        </div>

        {tribes.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <Chip active={tribeFilter === null} onClick={() => setTribeFilter(null)}>
              All
            </Chip>
            {tribes.map((tid) => {
              const t = tribeById(tid as TribeId);
              return (
                <Chip
                  key={tid}
                  active={tribeFilter === tid}
                  onClick={() => setTribeFilter(tid)}
                  color={t.colorVar}
                >
                  <TribeMark tribe={t} size="xs" />
                  {t.name}
                </Chip>
              );
            })}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          {posts.length === 0 ? "No signals yet." : noMatchesCopy}
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.map(([month, items]) => (
            <div key={month}>
              <p className="label-mono mb-2 text-muted-foreground">{month}</p>
              <div className="space-y-3">
                {items.map((p) => (
                  <PostCard key={p.id} post={p} showTribe />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-semibold transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? "border-transparent text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
      style={
        active
          ? {
              backgroundColor: color
                ? `color-mix(in oklab, ${color} 32%, transparent)`
                : "var(--secondary)",
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}
