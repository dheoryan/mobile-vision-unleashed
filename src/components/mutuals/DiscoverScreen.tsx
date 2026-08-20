import { useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, LocateFixed, Loader2, MapPin, Search, ShieldCheck, SlidersHorizontal, Sparkles, UserPlus, X } from "lucide-react";
import { TRIBES, tribeById, type Person, type Tribe, type TribeId } from "@/lib/mutuals-data";
import { listDiscoverProfiles, type DiscoverProfile } from "@/lib/profile.functions";
import { useFeedPosts, useTribeMemberCounts, type FeedPost } from "@/lib/posts-store";
import { AppHeader, SectionTitle, TribeBadge } from "./Shared";
import { PlusBadge } from "./PlusBadge";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { useSocial, useToggleFollow } from "@/lib/social-store";
import { useBlocked } from "@/lib/blocked-store";
import { timeAgoLabel } from "@/lib/time";
import { cn } from "@/lib/utils";
import { showPlusBadge } from "@/lib/feature-flags";
import { useMyLocationSettings, useNearbyProfiles, useSaveMyLocation, useUpdateMyLocationSettings } from "@/lib/location-store";
import { requestBrowserLocation, type LocationRadiusKm } from "@/lib/location";
import type { NearbyProfile } from "@/lib/location.functions";
import { toast } from "sonner";
import { DiscoveryRadiusSlider } from "./DiscoveryRadiusSlider";
import { Switch } from "@/components/ui/switch";
import { TribeMark } from "./TribeMark";

type DiscoverPerson = Person & { allTribeIds: TribeId[]; distanceBand?: string; matchScore?: number };

const VALID_TRIBES = new Set<TribeId>(TRIBES.map((t) => t.id));
const PAGE_SIZE = 20;

function toTribeIds(ids: string[] | null | undefined): TribeId[] {
  return (ids ?? []).filter((id): id is TribeId => VALID_TRIBES.has(id as TribeId));
}

function rowToPerson(row: DiscoverProfile | NearbyProfile): DiscoverPerson {
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
    plus: showPlusBadge(row.plan),
    mutuals: 0,
    allTribeIds: allTribeIds.length ? allTribeIds : [tribeId],
    distanceBand: "distance_band" in row ? row.distance_band : undefined,
    matchScore: "match_score" in row ? row.match_score : undefined,
  };
}

export function DiscoverScreen({ onOpenMessages, unread }: { onOpenMessages: () => void; unread?: number }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [previewTribe, setPreviewTribe] = useState<Tribe | null>(null);
  const [nearbySettingsOpen, setNearbySettingsOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const tribeScrollRef = useRef<HTMLDivElement>(null);
  const social = useSocial();
  const blocked = useBlocked();
  const discoverFn = useServerFn(listDiscoverProfiles);
  const locationQuery = useMyLocationSettings();
  const saveLocation = useSaveMyLocation();
  const updateLocation = useUpdateMyLocationSettings();
  const nearbyQuery = useNearbyProfiles(Boolean(locationQuery.data?.discoverable));

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
  const tribeCounts = useTribeMemberCounts(TRIBES.map((t) => t.id));
  const toggleFollow = useToggleFollow();

  const people = useMemo(
    () =>
      (profilesQuery.data?.pages ?? [])
        .flatMap((p) => p.rows)
        .map(rowToPerson)
        .filter((p) => !blocked.has(p.id)),
    [profilesQuery.data, blocked],
  );
  const nearbyPeople = useMemo(
    () => (nearbyQuery.data ?? []).map(rowToPerson).filter((person) => !blocked.has(person.id)),
    [nearbyQuery.data, blocked],
  );
  const nearbyIds = useMemo(() => new Set(nearbyPeople.map((person) => person.id)), [nearbyPeople]);

  const enableNearby = async () => {
    setLocating(true);
    try {
      const location = await requestBrowserLocation();
      await saveLocation.mutateAsync({ ...location, radius_km: 15, discoverable: true });
      toast.success("Nearby discovery enabled.");
    } catch (error) {
      toast.error("Nearby remains off", { description: (error as Error).message });
    } finally {
      setLocating(false);
    }
  };

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
    const generalPeople = people.filter((person) => !nearbyIds.has(person.id));
    if (!q || q === debounced.toLowerCase()) return generalPeople;
    return generalPeople.filter((p) => {
      const tribes = p.allTribeIds.map((id) => tribeById(id).name.toLowerCase()).join(" ");
      return (
        p.name.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.bio.toLowerCase().includes(q) ||
        tribes.includes(q)
      );
    });
  }, [query, debounced, people, nearbyIds]);

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
              // Real count from the DB. This previously counted matches within
              // the currently-loaded page of 20 profiles, so it read
              // "3 registered members" when the tribe actually had hundreds —
              // and "0" for every tribe before the first page arrived.
              const memberCount = tribeCounts.data?.[t.id];
              return (
                <button
                  key={t.id}
                  onClick={() => setPreviewTribe(t)}
                  className="group relative h-40 w-44 shrink-0 overflow-hidden rounded-2xl border border-border text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <img src={t.art} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/5" />
                  <TribeMark tribe={t} size="sm" className="absolute left-3 top-3" />
                  <p className="absolute bottom-8 left-4 right-4 font-display text-base font-bold text-white">{t.name}</p>
                  <p className="absolute bottom-3 left-4 right-4 text-[10px] text-white/65">
                    {memberCount === undefined ? " " : `${memberCount} registered members`}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <SectionTitle
          title="People near you"
          hint={locationQuery.data?.discoverable ? `${nearbyPeople.length} nearby · mutual radius` : locationQuery.data ? "Paused" : "Optional"}
          action={locationQuery.data ? (
            <button
              type="button"
              onClick={() => setNearbySettingsOpen(true)}
              aria-label="Adjust nearby preferences"
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                locationQuery.data.discoverable ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {locationQuery.data.discoverable ? `${locationQuery.data.radius_km} km` : "Paused"}
            </button>
          ) : undefined}
        />
        {locationQuery.isLoading ? (
          <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-8 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking nearby preferences…</p>
        ) : !locationQuery.data ? (
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><LocateFixed className="h-5 w-5" /></span>
              <div><p className="text-sm font-semibold">Discover your part of the city</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Opt in to approximate proximity. Members see distance bands, never your coordinates.</p></div>
            </div>
            <button type="button" onClick={enableNearby} disabled={locating || saveLocation.isPending} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground disabled:opacity-50">
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />} Enable nearby
            </button>
          </div>
        ) : !locationQuery.data.discoverable ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-center">
            <p className="text-xs text-muted-foreground">Nearby discovery is paused. Your approximate area is still saved privately.</p>
            <button type="button" onClick={() => setNearbySettingsOpen(true)} className="mt-3 min-h-11 rounded-full border border-primary/35 bg-primary/10 px-4 text-xs font-semibold text-primary">Review nearby preferences</button>
          </div>
        ) : nearbyQuery.isLoading ? (
          <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-8 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Finding mutual proximity…</p>
        ) : nearbyQuery.isError ? (
          <div className="rounded-2xl border border-border bg-card p-5 text-center"><p className="text-xs text-muted-foreground">Couldn't load nearby people.</p><button type="button" onClick={() => nearbyQuery.refetch()} className="mt-3 text-xs font-semibold text-primary underline">Retry</button></div>
        ) : nearbyPeople.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No mutually nearby members yet. General discovery is still available below.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {nearbyPeople.map((person) => (
              <PersonRow key={`nearby-${person.id}`} person={person} following={social.following.has(person.id)} pending={toggleFollow.isPending && toggleFollow.variables === person.id} onToggle={() => toggle(person.id)} />
            ))}
          </div>
        )}

        <SectionTitle title="People to discover" hint={profilesQuery.isLoading ? "Loading" : `${filtered.length} loaded`} />
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
              {debounced
                ? `No one matches "${debounced}". Try another search.`
                : nearbyIds.size > 0
                  ? "Everyone currently loaded is already shown in People near you."
                  : "No registered users yet."}
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
      <NearbyPreferencesSheet
        open={nearbySettingsOpen}
        discoverable={locationQuery.data?.discoverable ?? false}
        radiusKm={(locationQuery.data?.radius_km ?? 15) as LocationRadiusKm}
        pending={updateLocation.isPending}
        onClose={() => setNearbySettingsOpen(false)}
        onUpdate={(discoverable, radiusKm) => updateLocation.mutate(
          { discoverable, radius_km: radiusKm },
          { onError: (error) => toast.error("Could not update nearby preferences", { description: (error as Error).message }) },
        )}
      />
    </div>
  );
}

function NearbyPreferencesSheet({
  open,
  discoverable,
  radiusKm,
  pending,
  onClose,
  onUpdate,
}: {
  open: boolean;
  discoverable: boolean;
  radiusKm: LocationRadiusKm;
  pending: boolean;
  onClose: () => void;
  onUpdate: (discoverable: boolean, radiusKm: LocationRadiusKm) => void;
}) {
  return (
    <AnimatedModal
      open={open}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}
      title="Nearby preferences"
      contentClassName="overflow-hidden"
      preventClose={pending}
    >
      <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start gap-3 pr-10">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary"><ShieldCheck className="h-5 w-5" /></span>
          <div>
            <h3 className="font-display text-xl font-bold">Nearby preferences</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Tune the people shown here without exposing your coordinates.</p>
          </div>
        </div>
        <button type="button" onClick={onClose} disabled={pending} aria-label="Close nearby preferences" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"><X className="h-4 w-4" /></button>

        <div className="mt-6 flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-border bg-background/60 px-4">
          <div>
            <p className="text-sm font-semibold">Show me in nearby discovery</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{discoverable ? "Active for mutual-radius matches" : "Paused—your area remains private"}</p>
          </div>
          <Switch
            checked={discoverable}
            disabled={pending}
            aria-label={discoverable ? "Pause nearby discovery" : "Enable nearby discovery"}
            onCheckedChange={(nextDiscoverable) => onUpdate(nextDiscoverable, radiusKm)}
          />
        </div>

        <div className="mt-4">
          <DiscoveryRadiusSlider
            value={radiusKm}
            disabled={pending}
            onChange={(nextRadius) => onUpdate(discoverable, nextRadius)}
          />
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-primary/8 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p>The radius is mutual: both people must allow the distance. Members only see a broad distance band.</p>
        </div>
        <button type="button" onClick={onClose} disabled={pending} className="mt-5 min-h-12 w-full rounded-2xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {pending ? "Saving…" : "Done"}
        </button>
      </div>
    </AnimatedModal>
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
  // Keep rendering the last previewed tribe's content while the modal plays its
  // exit animation, even after the parent has already cleared `tribe` to null.
  const [lastTribe, setLastTribe] = useState<Tribe | null>(tribe);
  useEffect(() => { if (tribe) setLastTribe(tribe); }, [tribe]);
  const displayTribe = tribe ?? lastTribe;

  const members = displayTribe ? people.filter((p) => p.allTribeIds.includes(displayTribe.id)).slice(0, 4) : [];
  const recentPosts = displayTribe ? posts.filter((p) => p.tribe_id === displayTribe.id).slice(0, 3) : [];
  return (
    <AnimatedModal
      open={!!tribe}
      onOpenChange={(o) => { if (!o) onClose(); }}
      title={displayTribe ? `${displayTribe.name} preview` : "Tribe preview"}
      contentClassName="overflow-hidden"
    >
      <div
        style={displayTribe ? { background: `linear-gradient(180deg, color-mix(in oklab, ${displayTribe.colorVar} 28%, var(--card)) 0%, var(--card) 60%)` } : undefined}
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/40 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        {displayTribe && (
        <div className="p-6">
          <TribeMark tribe={displayTribe} size="lg" decorative={false} />
          <h3 className="mt-4 font-display text-2xl font-bold">{displayTribe.name}</h3>
          <p className="text-xs text-muted-foreground">{displayTribe.scene}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {members.length} visible registered members
            {displayTribe.hosted && displayTribe.hostOrg ? ` · Hosted by ${displayTribe.hostOrg}` : ""}
          </p>

          <p className="mt-5 label-mono text-muted-foreground">Recent signals</p>
          <ul className="mt-2 space-y-2">
            {recentPosts.length ? recentPosts.map((p) => (
              <li key={p.id} className="rounded-xl border border-border bg-background/40 p-3">
                <p className="text-[11px] text-muted-foreground">{p.author?.display_name || "Someone"} · {timeAgoLabel(p.created_at)}</p>
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
              <AvatarBubble key={m.id} person={m} color={displayTribe.colorVar} />
            )) : (
              <p className="text-xs text-muted-foreground">No registered members visible yet.</p>
            )}
          </div>

          <button onClick={onClose} className="mt-6 w-full rounded-2xl border border-border bg-background/40 py-3 text-sm font-semibold">
            Close preview
          </button>
        </div>
        )}
      </div>
    </AnimatedModal>
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
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>{person.city || person.handle || "Registered member"}</span>
          {person.distanceBand && <span className="inline-flex items-center gap-1 text-primary"><MapPin className="h-3 w-3" /> {person.distanceBand}</span>}
          {person.matchScore !== undefined && <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> {person.matchScore}% match</span>}
        </div>
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
