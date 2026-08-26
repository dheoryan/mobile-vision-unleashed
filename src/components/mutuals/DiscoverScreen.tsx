import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Coffee,
  Loader2,
  MapPin,
  Moon,
  Palette,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Shuffle,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { TRIBES, tribeById, type Person, type Tribe, type TribeId } from "@/lib/mutuals-data";
import { listDiscoverProfiles, type DiscoverProfile } from "@/lib/profile.functions";
import { useFeedPosts, useTribeMemberCounts, type FeedPost } from "@/lib/posts-store";
import { AppHeader, TribeBadge } from "./Shared";
import { PlusBadge } from "./PlusBadge";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { useSocial, useToggleFollow } from "@/lib/social-store";
import { useBlocked } from "@/lib/blocked-store";
import { timeAgoLabel } from "@/lib/time";
import { cn } from "@/lib/utils";
import { showPlusBadge } from "@/lib/feature-flags";
import {
  useMyLocationSettings,
  useSaveMyLocation,
  useUpdateMyLocationSettings,
} from "@/lib/location-store";
import { requestBrowserLocation, type LocationRadiusKm } from "@/lib/location";
import type { NearbyProfile } from "@/lib/location.functions";
import { toast } from "sonner";
import { DiscoveryRadiusSlider } from "./DiscoveryRadiusSlider";
import { Switch } from "@/components/ui/switch";
import { TribeMark } from "./TribeMark";
import { FeatureIllustration } from "./FeatureIllustration";
import discoverArt from "@/assets/app-illustrations/discover.webp";
import { ExploreDeck, type ExploreDeckPhase } from "./ExploreDeck";
import { Wand2 } from "lucide-react";
import { useExploreMatches } from "@/lib/explore-store";
import type { ExploreMatch } from "@/lib/explore.functions";
import { matchReasons, type MatchSignals } from "@/lib/explore-reasons";
import { curateForMood, type ExploreMood } from "@/lib/explore-moods";
import { useMyProfile } from "@/lib/profile-store";
import { intentStore } from "@/lib/intent-store";
import { PeopleSkeleton } from "./Skeleton";

type DiscoverPerson = Person & {
  allTribeIds: TribeId[];
  interests: string[];
  socialIntents: string[];
  availability: string[];
  sharedAvailability?: string[];
  distanceBand?: string | null;
  matchScore?: number;
  signals?: MatchSignals;
  openVentureId?: string | null;
  openVentureTitle?: string | null;
};

const VALID_TRIBES = new Set<TribeId>(TRIBES.map((t) => t.id));
const PAGE_SIZE = 20;
const MOOD_OPTIONS = [
  { id: "surprise", label: "Surprise me", Icon: Shuffle },
  { id: "coffee", label: "Coffee nearby", Icon: Coffee },
  { id: "friends", label: "Make friends", Icon: UsersRound },
  { id: "create", label: "Create something", Icon: Palette },
  { id: "tonight", label: "Tonight", Icon: Moon },
] as const;

function localDayKey(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTribeIds(ids: string[] | null | undefined): TribeId[] {
  return (ids ?? []).filter((id): id is TribeId => VALID_TRIBES.has(id as TribeId));
}

function rowToPerson(row: DiscoverProfile | NearbyProfile | ExploreMatch): DiscoverPerson {
  const allTribeIds = toTribeIds(row.tribe_ids);
  const tribeId = allTribeIds[0] ?? "wolf";
  // Only the scored RPC returns the matched signals; a text search result has
  // no ranking to explain and deliberately renders without chips.
  const scored = "shared_interests" in row ? (row as ExploreMatch) : null;
  return {
    id: row.id,
    name: row.display_name?.trim() || "Someone",
    handle: row.handle ? `@${row.handle}` : "",
    avatar: row.avatar_url || row.avatar_emoji || "🙂",
    tribeId,
    city: row.city || "",
    bio: row.bio || "",
    interests: row.interests ?? [],
    socialIntents: row.social_intents ?? [],
    availability: row.availability ?? [],
    sharedAvailability: scored?.shared_availability ?? [],
    plus: showPlusBadge(row.plan),
    mutuals: 0,
    allTribeIds: allTribeIds.length ? allTribeIds : [tribeId],
    distanceBand: "distance_band" in row ? row.distance_band : undefined,
    matchScore: "match_score" in row ? row.match_score : undefined,
    signals: scored
      ? {
          shared_interests: scored.shared_interests,
          shared_intents: scored.shared_intents,
          shared_availability: scored.shared_availability,
          same_tribe: scored.same_tribe,
          distance_band: scored.distance_band,
          open_venture_title: scored.open_venture_title,
        }
      : undefined,
    openVentureId: scored?.open_venture_id ?? undefined,
    openVentureTitle: scored?.open_venture_title ?? undefined,
  };
}

export function DiscoverScreen() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [previewTribe, setPreviewTribe] = useState<Tribe | null>(null);
  const [tribeBrowserOpen, setTribeBrowserOpen] = useState(false);
  const [moodPickerOpen, setMoodPickerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [nearbySettingsOpen, setNearbySettingsOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mood, setMood] = useState<ExploreMood>("surprise");
  const [deckPhase, setDeckPhase] = useState<ExploreDeckPhase>("primary");
  const [deckDay] = useState(localDayKey);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const social = useSocial();
  const blocked = useBlocked();
  const myProfile = useMyProfile();
  const discoverFn = useServerFn(listDiscoverProfiles);
  const locationQuery = useMyLocationSettings();
  const saveLocation = useSaveMyLocation();
  const updateLocation = useUpdateMyLocationSettings();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Two different questions, so two different queries.
  //
  // With no search term the screen is answering "who should I meet?", which is
  // a ranking problem — list_explore_matches scores on stated interests,
  // intents, availability and open Ventures. With a term it is answering "where
  // is this specific person?", which is a lookup, and relevance ranking would
  // only get in the way. Search stays on listDiscoverProfiles.
  const searching = debounced.length > 0;
  const exploreQuery = useExploreMatches(!searching);
  const profilesQuery = useInfiniteQuery({
    queryKey: ["discover", "profiles", debounced],
    queryFn: ({ pageParam }) =>
      discoverFn({
        data: { search: debounced || undefined, offset: pageParam as number, limit: PAGE_SIZE },
      }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    staleTime: 20_000,
    enabled: searching,
  });
  const activeQuery = searching ? profilesQuery : exploreQuery;
  const feedQuery = useFeedPosts();
  const tribeCounts = useTribeMemberCounts(TRIBES.map((t) => t.id));
  const toggleFollow = useToggleFollow();

  const people = useMemo(
    () =>
      (activeQuery.data?.pages ?? [])
        .flatMap((p) => p.rows as Array<DiscoverProfile | ExploreMatch>)
        .map(rowToPerson)
        .filter((p) => !blocked.has(p.id)),
    [activeQuery.data, blocked],
  );

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

  // Server-side search already filters; keep a light client-side pass for tribe-name matches.
  //
  // There is deliberately no second list to exclude here any more. Proximity is
  // a signal inside list_explore_matches, not a separate query, so a nearby
  // person is simply a person who ranked well and carries a distance band.
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

  const todaysPeople = useMemo(
    () => curateForMood(filtered, mood, 5, deckDay),
    [deckDay, filtered, mood],
  );

  const toggle = (id: string) => toggleFollow.mutate(id);
  const isSearching = query.trim() !== debounced;
  // Nothing to match on means every candidate scores zero, so the ranking
  // degenerates to "recently active" — worth admitting rather than hiding.
  const needsProfileSignals =
    !!myProfile &&
    myProfile.interests.length === 0 &&
    myProfile.socialIntents.length === 0 &&
    myProfile.availability.length === 0;
  const selectedMoodLabel =
    MOOD_OPTIONS.find((option) => option.id === mood)?.label ?? "Surprise me";
  const SelectedMoodIcon = MOOD_OPTIONS.find((option) => option.id === mood)?.Icon ?? Shuffle;
  const searchMode = searchOpen || query.length > 0;
  const deckSectionTitle =
    deckPhase === "doors"
      ? "Choose what’s next"
      : deckPhase === "continuation"
        ? "A different five"
        : deckPhase === "done"
          ? "Today’s introductions"
          : "Today’s five";
  const deckSectionHint =
    deckPhase === "doors"
      ? `${todaysPeople.length} considered · nobody rejected`
      : deckPhase === "continuation"
        ? "A new direction · no repeats"
        : deckPhase === "done"
          ? "Continue with a room or plan"
          : `${todaysPeople.length} picked for ${selectedMoodLabel.toLowerCase()}`;

  const focusSearch = () => {
    setSearchOpen(true);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
    setDebounced("");
  };

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-habitat">
      <AppHeader title="Discover" subtitle="Beyond your Tribe" accent="var(--color-primary)" />
      <main className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-5 pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
        <div className="mb-2 mt-3 flex shrink-0 items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-bold">
              {searchMode ? "Search" : deckSectionTitle}
            </h2>
            <p className="truncate text-[11px] text-muted-foreground">
              {searchMode
                ? debounced
                  ? `${filtered.length} found`
                  : "Find a person, city, or Tribe"
                : activeQuery.isLoading
                  ? "Loading"
                  : deckSectionHint}
            </p>
          </div>
          {!searchMode && needsProfileSignals && (
            <button
              type="button"
              onClick={() => intentStore.push({ kind: "openTab", tab: "profile" })}
              aria-label="Add profile interests for better matches"
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-2 text-[10px] font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Wand2 className="h-3.5 w-3.5" /> Improve matches
            </button>
          )}
        </div>

        {searchMode ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={closeSearch}
              aria-label="Close search"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-border bg-card px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people, Tribes, cities"
                className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              />
              {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2" aria-label="Discover controls">
            <button
              type="button"
              onClick={() => setMoodPickerOpen(true)}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 text-left text-xs font-semibold transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <SelectedMoodIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{selectedMoodLabel}</span>
              <SlidersHorizontal className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (locationQuery.data) setNearbySettingsOpen(true);
                else void enableNearby();
              }}
              disabled={locating || saveLocation.isPending}
              aria-label={
                locationQuery.data ? "Adjust nearby preferences" : "Enable nearby discovery"
              }
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                locationQuery.data?.discoverable
                  ? "border-primary/35 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {locating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
              {locationQuery.data?.discoverable ? `${locationQuery.data.radius_km} km` : "Area"}
            </button>
            <button
              type="button"
              onClick={() => setTribeBrowserOpen(true)}
              aria-label="Explore Tribes"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <UsersRound className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={focusSearch}
              aria-label="Search people, Tribes, and cities"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        )}

        <div
          className={cn(
            "min-h-0 flex-1",
            searchMode
              ? "scroll-panel overflow-y-auto overscroll-contain pb-4"
              : "flex flex-col overflow-hidden pt-2",
          )}
        >
          {searchMode && !query.trim() ? (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Search className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-display text-xl font-bold">Search directly</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Look up a member, city, or Tribe without changing today’s five.
              </p>
            </div>
          ) : activeQuery.isLoading || (searchMode && isSearching) ? (
            <PeopleSkeleton />
          ) : activeQuery.isError ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
              <AlertTriangle className="h-9 w-9 text-destructive" />
              <p className="text-sm font-semibold">Couldn't load registered users.</p>
              <button
                onClick={() => activeQuery.refetch()}
                className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center">
              {/* One list now, so an empty result means genuinely nobody —
                  there is no second list that might be holding everyone. */}
              {!debounced && <FeatureIllustration src={discoverArt} />}
              <p className={cn("text-sm text-muted-foreground", !debounced && "mt-4")}>
                {debounced
                  ? `No one matches "${debounced}". Try another search.`
                  : "No registered users yet."}
              </p>
            </div>
          ) : searchMode ? (
            <div className="flex flex-col gap-3">
              {filtered.map((person) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  following={social.following.has(person.id)}
                  pending={toggleFollow.isPending && toggleFollow.variables === person.id}
                  onToggle={() => toggle(person.id)}
                />
              ))}
              {activeQuery.hasNextPage && (
                <button
                  onClick={() => activeQuery.fetchNextPage()}
                  disabled={activeQuery.isFetchingNextPage}
                  className="mx-auto mt-2 flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-xs font-semibold disabled:opacity-60"
                >
                  {activeQuery.isFetchingNextPage ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Load more
                </button>
              )}
            </div>
          ) : (
            <ExploreDeck
              people={filtered}
              mood={mood}
              dayKey={deckDay}
              sessionKey={`${deckDay}:${mood}`}
              following={social.following}
              onToggleFollow={toggle}
              followPending={toggleFollow.isPending ? (toggleFollow.variables as string) : null}
              onOpenNearby={() => {
                if (locationQuery.data) setNearbySettingsOpen(true);
                else void enableNearby();
              }}
              onExploreTribes={() => setTribeBrowserOpen(true)}
              onPhaseChange={setDeckPhase}
            />
          )}
        </div>
      </main>

      <MoodPickerSheet
        open={moodPickerOpen}
        value={mood}
        onClose={() => setMoodPickerOpen(false)}
        onChange={(nextMood) => {
          setMood(nextMood);
          setMoodPickerOpen(false);
        }}
      />
      <TribeBrowserSheet
        open={tribeBrowserOpen}
        counts={tribeCounts.data}
        onClose={() => setTribeBrowserOpen(false)}
        onSelect={(tribe) => {
          setTribeBrowserOpen(false);
          setPreviewTribe(tribe);
        }}
      />

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
        onUpdate={(discoverable, radiusKm) =>
          updateLocation.mutate(
            { discoverable, radius_km: radiusKm },
            {
              onError: (error) =>
                toast.error("Could not update nearby preferences", {
                  description: (error as Error).message,
                }),
            },
          )
        }
      />
    </div>
  );
}

function MoodPickerSheet({
  open,
  value,
  onClose,
  onChange,
}: {
  open: boolean;
  value: ExploreMood;
  onClose: () => void;
  onChange: (mood: ExploreMood) => void;
}) {
  return (
    <AnimatedModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="Choose today’s mood"
      contentClassName="overflow-hidden"
    >
      <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="pr-10">
          <p className="label-mono text-primary">Discovery lens</p>
          <h3 className="mt-2 font-display text-2xl font-bold">What are you up for?</h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            This changes the order of today’s people. It never rejects or hides anyone.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close mood picker"
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mt-6 grid gap-2">
          {MOOD_OPTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={value === id}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-2xl border px-4 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                value === id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background/45 text-foreground hover:border-primary/40",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {value === id && <Check className="ml-auto h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>
    </AnimatedModal>
  );
}

function TribeBrowserSheet({
  open,
  counts,
  onClose,
  onSelect,
}: {
  open: boolean;
  counts: Partial<Record<TribeId, number>> | undefined;
  onClose: () => void;
  onSelect: (tribe: Tribe) => void;
}) {
  return (
    <AnimatedModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="Explore Tribes"
      contentClassName="h-[100dvh] max-h-[100dvh] overflow-hidden rounded-none border-0 !bg-background sm:h-auto sm:max-h-[90dvh] sm:rounded-3xl sm:border"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to today’s five"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="label-mono text-muted-foreground">Inside Discover</p>
            <h3 className="font-display text-lg font-bold">Explore Tribes</h3>
          </div>
        </div>
        <div className="scroll-panel min-h-0 flex-1 overflow-y-auto px-5 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            Preview the rooms behind the people. Your place in today’s five stays exactly where you
            left it.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {TRIBES.map((tribe, index) => (
              <button
                key={tribe.id}
                type="button"
                onClick={() => onSelect(tribe)}
                className={cn(
                  "group relative h-48 overflow-hidden rounded-3xl border border-border bg-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  index === 0 && "col-span-2 h-56",
                )}
              >
                <img
                  src={tribe.art}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/5" />
                <TribeMark tribe={tribe} size="sm" className="absolute left-4 top-4" />
                <span className="absolute inset-x-4 bottom-4">
                  <span className="block truncate font-display text-xl font-bold text-white">
                    {tribe.name}
                  </span>
                  <span className="mt-1 block text-[10px] text-white/70">
                    {counts?.[tribe.id] === undefined
                      ? "Room preview"
                      : `${counts[tribe.id]} members`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </AnimatedModal>
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
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="Nearby preferences"
      contentClassName="overflow-hidden"
      preventClose={pending}
    >
      <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start gap-3 pr-10">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-xl font-bold">Nearby preferences</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Tune the people shown here without exposing your coordinates.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          aria-label="Close nearby preferences"
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mt-6 flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-border bg-background/60 px-4">
          <div>
            <p className="text-sm font-semibold">Show me in nearby discovery</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {discoverable
                ? "Active for mutual-radius matches"
                : "Paused—your area remains private"}
            </p>
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
          <p>
            The radius is mutual: both people must allow the distance. Members only see a broad
            distance band.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="mt-5 min-h-12 w-full rounded-2xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
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
  useEffect(() => {
    if (tribe) setLastTribe(tribe);
  }, [tribe]);
  const displayTribe = tribe ?? lastTribe;

  const members = displayTribe
    ? people.filter((p) => p.allTribeIds.includes(displayTribe.id)).slice(0, 4)
    : [];
  const recentPosts = displayTribe
    ? posts.filter((p) => p.tribe_id === displayTribe.id).slice(0, 3)
    : [];
  return (
    <AnimatedModal
      open={!!tribe}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={displayTribe ? `${displayTribe.name} preview` : "Tribe preview"}
      contentClassName="overflow-hidden"
    >
      <div
        style={
          displayTribe
            ? {
                background: `linear-gradient(180deg, color-mix(in oklab, ${displayTribe.colorVar} 28%, var(--card)) 0%, var(--card) 60%)`,
              }
            : undefined
        }
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/40 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        {displayTribe && (
          <div className="p-6">
            <TribeMark tribe={displayTribe} size="lg" decorative={false} />
            <h3 className="mt-4 font-display text-2xl font-bold">{displayTribe.name}</h3>
            <p className="text-xs text-muted-foreground">{displayTribe.scene}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {members.length} visible registered members
            </p>

            <p className="mt-5 label-mono text-muted-foreground">Recent signals</p>
            <ul className="mt-2 space-y-2">
              {recentPosts.length ? (
                recentPosts.map((p) => (
                  <li key={p.id} className="rounded-xl border border-border bg-background/40 p-3">
                    <p className="text-[11px] text-muted-foreground">
                      {p.author?.display_name || "Someone"} · {timeAgoLabel(p.created_at)}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs">{p.content}</p>
                  </li>
                ))
              ) : (
                <li className="rounded-xl border border-dashed border-border bg-background/30 p-3 text-xs text-muted-foreground">
                  No recent posts in this Tribe yet.
                </li>
              )}
            </ul>

            <p className="mt-5 label-mono text-muted-foreground">A few members</p>
            <div className="mt-2 flex gap-2">
              {members.length ? (
                members.map((m) => (
                  <AvatarBubble key={m.id} person={m} color={displayTribe.colorVar} />
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No registered members visible yet.</p>
              )}
            </div>

            <button
              onClick={onClose}
              className="mt-6 w-full rounded-2xl border border-border bg-background/40 py-3 text-sm font-semibold"
            >
              Close preview
            </button>
          </div>
        )}
      </div>
    </AnimatedModal>
  );
}

function AvatarBubble({
  person,
  color,
}: {
  person: Pick<Person, "avatar" | "name">;
  color: string;
}) {
  const isImg = person.avatar.startsWith("data:") || person.avatar.startsWith("http");
  return (
    <span
      className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-lg"
      style={{ backgroundColor: `color-mix(in oklab, ${color} 28%, transparent)` }}
    >
      {isImg ? (
        <img src={person.avatar} alt={person.name} className="h-full w-full object-cover" />
      ) : (
        person.avatar
      )}
    </span>
  );
}

function PersonRow({
  person,
  following,
  pending,
  onToggle,
}: {
  person: DiscoverPerson;
  following: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  const tribe = tribeById(person.tribeId);
  // The list is the scanning surface, so one reason rather than the deck's
  // three — enough to justify a tap, not so much that rows stop being scannable.
  const reason = person.signals ? matchReasons(person.signals, 1)[0] : undefined;
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
            return <TribeBadge key={id} tribe={t} />;
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>{person.city || person.handle || "Registered member"}</span>
          {person.distanceBand && (
            <span className="inline-flex items-center gap-1 text-primary">
              <MapPin className="h-3 w-3" /> {person.distanceBand}
            </span>
          )}
        </div>
        {reason && (
          <p className="mt-1 inline-block rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            {reason.label}
          </p>
        )}
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {person.bio || "Open to meeting people across Tribes."}
        </p>
      </div>
      <button
        onClick={onToggle}
        disabled={pending}
        className={cn(
          "flex min-h-11 min-w-20 shrink-0 items-center justify-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60",
          following
            ? "border-accent bg-accent/15 text-accent"
            : "border-primary bg-primary/15 text-primary",
        )}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : following ? (
          <>
            <Check className="h-3.5 w-3.5" /> Saved
          </>
        ) : (
          <>
            <UserPlus className="h-3.5 w-3.5" /> Save
          </>
        )}
      </button>
    </div>
  );
}
