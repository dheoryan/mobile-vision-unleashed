import { useMemo, useState } from "react";
import { Search, UserPlus, Check } from "lucide-react";
import { TRIBES, PEOPLE, tribeById, type Person } from "@/lib/mutuals-data";
import { AppHeader, SectionTitle, TribeBadge } from "./Shared";
import { PlusBadge } from "./PlusBadge";
import { cn } from "@/lib/utils";

export function DiscoverScreen({ onOpenMessages, unread }: { onOpenMessages: () => void; unread?: number }) {
  const [query, setQuery] = useState("");
  const [following, setFollowing] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PEOPLE;
    return PEOPLE.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        tribeById(p.tribeId).name.toLowerCase().includes(q)
    );
  }, [query]);

  const toggle = (id: string) =>
    setFollowing((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

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
                className="relative h-32 w-44 shrink-0 overflow-hidden rounded-2xl border border-border p-4 text-left"
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
            <PersonRow key={p.id} person={p} following={following.has(p.id)} onToggle={() => toggle(p.id)} />
          ))}
          {filtered.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No one matches "{query}". Try another search.
            </p>
          )}
        </div>
      </main>
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
