import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, ArrowUpDown } from "lucide-react";
import type { FeedPost } from "@/lib/posts-store";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { PostCard } from "./PostCard";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

type SortKey = "newest" | "oldest" | "likes";

export function ProfilePostHistory({ posts }: { posts: FeedPost[] }) {
  const [view, setView] = useState<View>("grid");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [tribeFilter, setTribeFilter] = useState<string | null>(null);
  const [openPostId, setOpenPostId] = useState<string | null>(null);

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
    if (sort === "newest") sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (sort === "oldest") sorted.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    if (sort === "likes") sorted.sort((a, b) => (b.likes_count ?? 0) - (a.likes_count ?? 0));
    return sorted;
  }, [posts, query, sort, tribeFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, FeedPost[]>();
    for (const p of filtered) {
      const d = new Date(p.created_at);
      const key = d.toLocaleString(undefined, { month: "long", year: "numeric" });
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  const openPost = filtered.find((p) => p.id === openPostId) ?? null;

  const cycleSort = () => {
    setSort((s) => (s === "newest" ? "oldest" : s === "oldest" ? "likes" : "newest"));
  };
  const sortLabel = sort === "newest" ? "Newest" : sort === "oldest" ? "Oldest" : "Most liked";

  return (
    <div>
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your posts"
              className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-8 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <button
            onClick={cycleSort}
            className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowUpDown className="h-3 w-3" /> {sortLabel}
          </button>
          <div className="flex items-center gap-0.5 rounded-full bg-card p-0.5 text-muted-foreground">
            <ViewBtn active={view === "grid"} onClick={() => setView("grid")} label="Grid view">
              <GridIcon className="h-3.5 w-3.5" />
            </ViewBtn>
            <ViewBtn active={view === "timeline"} onClick={() => setView("timeline")} label="Timeline view">
              <List className="h-3.5 w-3.5" />
            </ViewBtn>
          </div>
        </div>

        {tribes.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <Chip active={tribeFilter === null} onClick={() => setTribeFilter(null)}>All</Chip>
            {tribes.map((tid) => {
              const t = tribeById(tid as TribeId);
              return (
                <Chip key={tid} active={tribeFilter === tid} onClick={() => setTribeFilter(tid)} color={t.colorVar}>
                  <span className="mr-1">{t.emoji}</span>{t.name}
                </Chip>
              );
            })}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          {posts.length === 0 ? "You haven't posted yet." : "No posts match those filters."}
        </p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-3 gap-1">
          {filtered.map((p) => {
            const t = tribeById(p.tribe_id as TribeId);
            return (
              <button
                key={p.id}
                onClick={() => setOpenPostId(p.id)}
                className="group relative aspect-square overflow-hidden rounded-md p-2 text-left text-[10px] leading-tight text-foreground/90 transition active:scale-95"
                style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${t.colorVar} 35%, var(--card)), var(--card))` }}
              >
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <>
                    <span className="text-base">✦</span>
                    <p className="mt-1 line-clamp-3">{p.content}</p>
                  </>
                )}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 text-[9px] text-white opacity-0 transition group-hover:opacity-100">
                  <span>♥ {p.likes_count}</span>
                  <span>💬 {p.replies_count}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([month, items]) => (
            <div key={month}>
              <p className="label-mono mb-2 text-muted-foreground">{month}</p>
              <ul className="space-y-2">
                {items.map((p) => {
                  const t = tribeById(p.tribe_id as TribeId);
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => setOpenPostId(p.id)}
                        className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-3 text-left transition hover:bg-secondary/40"
                      >
                        <span
                          className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm"
                          style={{ backgroundColor: `color-mix(in oklab, ${t.colorVar} 28%, transparent)` }}
                        >
                          {t.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm">{p.content || "(no text)"}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {timeAgo(p.created_at)} · ♥ {p.likes_count} · 💬 {p.replies_count}
                          </p>
                        </div>
                        {p.image_url && (
                          <img src={p.image_url} alt="" className="h-12 w-12 flex-none rounded-lg object-cover" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {openPost && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setOpenPostId(null)} />
          <div className="relative mx-auto max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-background p-4 sm:rounded-3xl animate-rise">
            <button
              onClick={() => setOpenPostId(null)}
              aria-label="Close post"
              className="absolute right-3 top-3 z-10 rounded-full bg-card p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <PostCard post={openPost} showTribe />
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function ViewBtn({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={cn("rounded-full px-2 py-1 transition-colors", active ? "bg-secondary text-foreground" : "hover:text-foreground")}
    >
      {children}
    </button>
  );
}

function Chip({ active, onClick, color, children }: { active: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
        active ? "border-transparent text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
      style={active ? { backgroundColor: color ? `color-mix(in oklab, ${color} 32%, transparent)` : "var(--secondary)" } : undefined}
    >
      {children}
    </button>
  );
}
