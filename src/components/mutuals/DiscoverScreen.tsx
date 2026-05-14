import { useMemo, useRef, useState, type WheelEvent } from "react";
import { Search, UserPlus, Check, X } from "lucide-react";
import { TRIBES, PEOPLE, POSTS, tribeById, personById, type Person, type Tribe } from "@/lib/mutuals-data";
import { AppHeader, SectionTitle, TribeBadge } from "./Shared";
import { PlusBadge } from "./PlusBadge";
import { useSocial, socialStore } from "@/lib/social-store";
import { useBlocked } from "@/lib/blocked-store";
import { cn } from "@/lib/utils";

export function DiscoverScreen({ onOpenMessages, unread }: { onOpenMessages: () => void; unread?: number }) {
  const [query, setQuery] = useState("");
  const [previewTribe, setPreviewTribe] = useState<Tribe | null>(null);
  const tribeScrollRef = useRef<HTMLDivElement>(null);
  const social = useSocial();
  const blocked = useBlocked();

  const onTribeWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = tribeScrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  };

  const visiblePeople = useMemo(() => PEOPLE.filter((p) => !blocked.has(p.id)), [blocked]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visiblePeople;
    return visiblePeople.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        tribeById(p.tribeId).name.toLowerCase().includes(q)
    );
  }, [query, visiblePeople]);

  const toggle = (id: string) => socialStore.toggleFollow(id);

  return (
    <div className="bg-habitat min-h-screen pb-28">
      <AppHeader title="Discover" subtitle="Beyond your Tribe" accent="var(--color-primary)" onOpenMessages={onOpenMessages} unread={unread} />
      <main className="mx-auto max-w-md px-5">
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, Tribes, cities"
            className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        <SectionTitle title="Explore Tribes" hint="Tap to preview a scene" />
        <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-3 pb-1">
            {TRIBES.map((t) => (
              <button
                key={t.id}
                onClick={() => setPreviewTribe(t)}
                className="relative h-32 w-44 shrink-0 overflow-hidden rounded-2xl border border-border p-4 text-left transition-transform hover:-translate-y-0.5"
                style={{
                  background: `linear-gradient(155deg, color-mix(in oklab, ${t.colorVar} 50%, var(--card)) 0%, var(--card) 100%)`,
                }}
              >
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-50 blur-2xl" style={{ backgroundColor: t.colorVar }} />
                <span className="relative text-3xl">{t.emoji}</span>
                <p className="relative mt-3 font-display text-base font-bold">{t.name}</p>
                <p className="relative text-[11px] text-muted-foreground">{t.scene}</p>
              </button>
            ))}
          </div>
        </div>

        <SectionTitle title="People near you" hint={`${filtered.length} found`} />
        <div className="flex flex-col gap-3">
          {filtered.map((p) => (
            <PersonRow key={p.id} person={p} following={social.following.has(p.id)} onToggle={() => toggle(p.id)} />
          ))}
          {filtered.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No one matches "{query}". Try another search.
            </p>
          )}
        </div>
      </main>

      <TribePreviewSheet tribe={previewTribe} onClose={() => setPreviewTribe(null)} />
    </div>
  );
}

function TribePreviewSheet({ tribe, onClose }: { tribe: Tribe | null; onClose: () => void }) {
  if (!tribe) return null;
  const members = PEOPLE.filter((p) => p.tribeId === tribe.id).slice(0, 4);
  const recentPosts = POSTS.filter((p) => p.tribeId === tribe.id).slice(0, 3);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative mx-auto w-full max-w-md overflow-hidden rounded-t-3xl border border-border bg-card animate-rise sm:rounded-3xl"
        style={{ background: `linear-gradient(180deg, color-mix(in oklab, ${tribe.colorVar} 28%, var(--card)) 0%, var(--card) 60%)` }}
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/40 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="p-6">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl" style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 35%, transparent)` }}>
            {tribe.emoji}
          </span>
          <h3 className="mt-4 font-display text-2xl font-bold">{tribe.name}</h3>
          <p className="text-xs text-muted-foreground">{tribe.scene}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {tribe.members.toLocaleString()} members · {tribe.online} online
            {tribe.hosted && tribe.hostOrg ? ` · Hosted by ${tribe.hostOrg}` : ""}
          </p>

          <p className="mt-5 label-mono text-muted-foreground">Recent signals</p>
          <ul className="mt-2 space-y-2">
            {recentPosts.map((p) => {
              const a = personById(p.authorId);
              return (
                <li key={p.id} className="rounded-xl border border-border bg-background/40 p-3">
                  <p className="text-[11px] text-muted-foreground">{a.name} · {p.time} ago</p>
                  <p className="mt-0.5 line-clamp-2 text-xs">{p.content}</p>
                </li>
              );
            })}
          </ul>

          <p className="mt-5 label-mono text-muted-foreground">A few members</p>
          <div className="mt-2 flex gap-2">
            {members.map((m) => (
              <span key={m.id} className="flex h-10 w-10 items-center justify-center rounded-full text-lg" style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 28%, transparent)` }}>
                {m.avatar}
              </span>
            ))}
          </div>

          <button onClick={onClose} className="mt-6 w-full rounded-2xl border border-border bg-background/40 py-3 text-sm font-semibold">
            Close preview
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonRow({ person, following, onToggle }: { person: Person; following: boolean; onToggle: () => void }) {
  const tribe = tribeById(person.tribeId);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="relative shrink-0">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-xl"
          style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 28%, transparent)` }}
        >
          {person.avatar}
        </span>
        {person.plus && <PlusBadge />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{person.name}</p>
          <TribeBadge name={tribe.name} color={tribe.colorVar} hosted={tribe.hosted} />
        </div>
        <p className="text-[11px] text-muted-foreground">{person.city}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{person.bio}</p>
      </div>
      <button
        onClick={onToggle}
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
          following ? "border-accent bg-accent/15 text-accent" : "border-primary bg-primary/15 text-primary"
        )}
      >
        {following ? <><Check className="h-3.5 w-3.5" /> Following</> : <><UserPlus className="h-3.5 w-3.5" /> Follow</>}
      </button>
    </div>
  );
}
