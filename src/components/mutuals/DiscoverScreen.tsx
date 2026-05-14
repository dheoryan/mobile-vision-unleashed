import { useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, Loader2, Search, UserPlus, X } from "lucide-react";
import { TRIBES, tribeById, type Person, type Tribe, type TribeId } from "@/lib/mutuals-data";
import { listDiscoverProfiles, type DiscoverProfile } from "@/lib/profile.functions";
import { useFeedPosts, type FeedPost } from "@/lib/posts-store";
import { AppHeader, SectionTitle, TribeBadge } from "./Shared";
import { PlusBadge } from "./PlusBadge";
import { useSocial, useToggleFollow } from "@/lib/social-store";
import { useBlocked } from "@/lib/blocked-store";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

type DiscoverPerson = Person & { allTribeIds: TribeId[] };

const VALID_TRIBES = new Set<TribeId>(TRIBES.map((t) => t.id));
const PAGE_SIZE = 20;

function toTribeIds(ids: string[] | null | undefined): TribeId[] {
  return (ids ?? []).filter((id): id is TribeId => VALID_TRIBES.has(id as TribeId));
}

function rowToPerson(row: DiscoverProfile): DiscoverPerson {
  const allTribeIds = toTribeIds(row.tribe_ids);
  const tribeId = allTribeIds[0] ?? "wolf";
  return {
    id: row.id,
    name: row.display_name?.trim() || "Someone",
    handle: row.handle ? `@${row.handle}` : "",
    avatar: row.avatar_url || row.avatar_emoji || "🙂",
    tribeId,
    city: row.city || "",
    bio: row.bio || "",
    plus: row.plan === "plus",
    mutuals: 0,
    allTribeIds: allTribeIds.length ? allTribeIds : [tribeId],
  };
}

export function DiscoverScreen({ onOpenMessages, unread }: { onOpenMessages: () => void; unread?: number }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [previewTribe, setPreviewTribe] = useState<Tribe | null>(null);
  const tribeScrollRef = useRef<HTMLDivElement>(null);
  const social = useSocial();
  const blocked = useBlocked();
  const discoverFn = useServerFn(listDiscoverProfiles);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const profilesQuery = useInfiniteQuery({
    queryKey: ["discover", "profiles", debounced],
    queryFn: ({ pageParam }) =>
      discoverFn({
        data: { search: debounced || undefined, offset: pageParam as number, limit: PAGE_SIZE },
      }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    staleTime: 20_000,
  });
  const feedQuery = useFeedPosts();
  const toggleFollow = useToggleFollow();

  const people = useMemo(
    () =>
      (profilesQuery.data?.pages ?? [])
        .flatMap((p) => p.rows)
        .map(rowToPerson)
        .filter((p) => !blocked.has(p.id)),
    [profilesQuery.data, blocked],
  );

  const onTribeWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = tribeScrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  };

  // Server-side search already filters; keep a light client-side pass for tribe-name matches.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === debounced.toLowerCase()) return people;
    return people.filter((p) => {
      const tribes = p.allTribeIds.map((id) => tribeById(id).name.toLowerCase()).join(" ");
      return (
        p.name.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.bio.toLowerCase().includes(q) ||
        tribes.includes(q)
      );
    });
  }, [query, debounced, people]);

  const toggle = (id: string) => toggleFollow.mutate(id);
  const isSearching = query.trim() !== debounced;

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
          {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <SectionTitle title="Explore Tribes" hint="Tap to preview registered members" />
        <div
          ref={tribeScrollRef}
          onWheel={onTribeWheel}
          className="-mx-5 overflow-x-auto overflow-y-hidden overscroll-x-contain px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex w-max gap-3 pb-1">
            {TRIBES.map((t) => {
              const memberCount = people.filter((p) => p.allTribeIds.includes(t.id)).length;
              return (
                <button
                  key={t.id}
                  onClick={() => setPreviewTribe(t)}
                  className="relative h-32 w-44 shrink-0 overflow-hidden rounded-2xl border border-border p-4 text-left transition-transform hover:-translate-y-0.5"
                  style={{
                    background: `linear-gradient(155deg, color-mix(in oklab, ${t.colorVar} 50%, var(--card)) 0%, var(--card) 100%)`,
                  }}
                >
                  <span className="relative text-3xl">{t.emoji}</span>
                  <p className="relative mt-3 font-display text-base font-bold">{t.name}</p>
                  <p className="relative text-[11px] text-muted-foreground">{memberCount} registered members</p>
                </button>
              );
            })}
          </div>
        </div>

        <SectionTitle title="People near you" hint={profilesQuery.isLoading ? "Loading" : `${filtered.length} loaded`} />
        <div className="flex flex-col gap-3">
          {profilesQuery.isLoading ? (
            <p className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading people…
            </p>
          ) : profilesQuery.isError ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
              <AlertTriangle className="h-9 w-9 text-destructive" />
              <p className="text-sm font-semibold">Couldn't load registered users.</p>
              <button onClick={() => profilesQuery.refetch()} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {debounced ? `No one matches "${debounced}". Try another search.` : "No registered users yet."}
            </p>
          ) : (
            <>
              {filtered.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  following={social.following.has(p.id)}
                  pending={toggleFollow.isPending && toggleFollow.variables === p.id}
                  onToggle={() => toggle(p.id)}
                />
              ))}
              {profilesQuery.hasNextPage && (
                <button
                  onClick={() => profilesQuery.fetchNextPage()}
                  disabled={profilesQuery.isFetchingNextPage}
                  className="mx-auto mt-2 flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-xs font-semibold disabled:opacity-60"
                >
                  {profilesQuery.isFetchingNextPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Load more
                </button>
              )}
            </>
          )}
        </div>
      </main>

      <TribePreviewSheet
        tribe={previewTribe}
        people={people}
        posts={feedQuery.data ?? []}
        onClose={() => setPreviewTribe(null)}
      />
    </div>
  );
}

function TribePreviewSheet({
  tribe,
  people,
  posts,
  onClose,
}: {
  tribe: Tribe | null;
  people: DiscoverPerson[];
  posts: FeedPost[];
  onClose: () => void;
}) {
  if (!tribe) return null;
  const members = people.filter((p) => p.allTribeIds.includes(tribe.id)).slice(0, 4);
  const recentPosts = posts.filter((p) => p.tribe_id === tribe.id).slice(0, 3);
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
            {members.length} visible registered members
            {tribe.hosted && tribe.hostOrg ? ` · Hosted by ${tribe.hostOrg}` : ""}
          </p>

          <p className="mt-5 label-mono text-muted-foreground">Recent signals</p>
          <ul className="mt-2 space-y-2">
            {recentPosts.length ? recentPosts.map((p) => (
              <li key={p.id} className="rounded-xl border border-border bg-background/40 p-3">
                <p className="text-[11px] text-muted-foreground">{p.author?.display_name || "Someone"} · {timeAgo(p.created_at)} ago</p>
                <p className="mt-0.5 line-clamp-2 text-xs">{p.content}</p>
              </li>
            )) : (
              <li className="rounded-xl border border-dashed border-border bg-background/30 p-3 text-xs text-muted-foreground">
                No recent posts in this Tribe yet.
              </li>
            )}
          </ul>

          <p className="mt-5 label-mono text-muted-foreground">A few members</p>
          <div className="mt-2 flex gap-2">
            {members.length ? members.map((m) => (
              <AvatarBubble key={m.id} person={m} color={tribe.colorVar} />
            )) : (
              <p className="text-xs text-muted-foreground">No registered members visible yet.</p>
            )}
          </div>

          <button onClick={onClose} className="mt-6 w-full rounded-2xl border border-border bg-background/40 py-3 text-sm font-semibold">
            Close preview
          </button>
        </div>
      </div>
    </div>
  );
}

function AvatarBubble({ person, color }: { person: Pick<Person, "avatar" | "name">; color: string }) {
  const isImg = person.avatar.startsWith("data:") || person.avatar.startsWith("http");
  return (
    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-lg" style={{ backgroundColor: `color-mix(in oklab, ${color} 28%, transparent)` }}>
      {isImg ? <img src={person.avatar} alt={person.name} className="h-full w-full object-cover" /> : person.avatar}
    </span>
  );
}

function PersonRow({ person, following, pending, onToggle }: { person: DiscoverPerson; following: boolean; pending: boolean; onToggle: () => void }) {
  const tribe = tribeById(person.tribeId);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="relative shrink-0">
        <AvatarBubble person={person} color={tribe.colorVar} />
        {person.plus && <PlusBadge />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-semibold">{person.name}</p>
          {person.allTribeIds.slice(0, 2).map((id) => {
            const t = tribeById(id);
            return <TribeBadge key={id} name={t.name} color={t.colorVar} hosted={t.hosted} />;
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">{person.city || person.handle || "Registered member"}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{person.bio || "Open to meeting people across Tribes."}</p>
      </div>
      <button
        onClick={onToggle}
        disabled={pending}
        className={cn(
          "flex min-w-24 shrink-0 items-center justify-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
          following ? "border-accent bg-accent/15 text-accent" : "border-primary bg-primary/15 text-primary",
        )}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : following ? <><Check className="h-3.5 w-3.5" /> Following</> : <><UserPlus className="h-3.5 w-3.5" /> Follow</>}
      </button>
    </div>
  );
}
