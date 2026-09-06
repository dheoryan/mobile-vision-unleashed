import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent as ReactTransitionEvent,
} from "react";
import type { Icon } from "@phosphor-icons/react";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { CalendarPlusIcon } from "@phosphor-icons/react/dist/csr/CalendarPlus";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { CoffeeIcon } from "@phosphor-icons/react/dist/csr/Coffee";
import { HandIcon } from "@phosphor-icons/react/dist/csr/Hand";
import { MoonIcon } from "@phosphor-icons/react/dist/csr/Moon";
import { PaletteIcon } from "@phosphor-icons/react/dist/csr/Palette";
import { ShuffleIcon } from "@phosphor-icons/react/dist/csr/Shuffle";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { MapPinIcon } from "@phosphor-icons/react/dist/csr/MapPin";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import { Link } from "@tanstack/react-router";
import { readableAccentColor, tribeById, type TribeId } from "@/lib/mutuals-data";
import { TribeMark } from "./TribeMark";
import { PlusBadge } from "./PlusBadge";
import { FeatureIllustration } from "./FeatureIllustration";
import { HelloModal } from "./HelloModal";
import { LazyImage } from "./LazyImage";
import discoverArt from "@/assets/app-illustrations/discover.webp";
import { useContactStatus } from "@/lib/social-store";
import { matchReasons, type MatchSignals } from "@/lib/explore-reasons";
import {
  curateForMood,
  curateUnseenForMood,
  lensKey,
  type ExploreLens,
  type ExploreMood,
} from "@/lib/explore-moods";
import { INTEREST_OPTION_GROUPS } from "@/lib/profile-options";
import { PROFILE_OPTION_ICONS } from "@/lib/profile-option-icons";
import { useRecordExploreImpressions } from "@/lib/explore-store";
import { intentStore } from "@/lib/intent-store";
import { cn } from "@/lib/utils";

export interface DeckPerson {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  tribeId: TribeId;
  allTribeIds: TribeId[];
  city: string;
  bio: string;
  interests: string[];
  socialIntents: string[];
  availability: string[];
  sharedAvailability?: string[];
  plus?: boolean;
  distanceBand?: string | null;
  outsideRadius?: boolean;
  matchScore?: number;
  signals?: MatchSignals;
  openVentureId?: string | null;
  openVentureTitle?: string | null;
}

export type ExploreDeckPhase = "primary" | "doors" | "continuation" | "done";
type SwipeMotion = "idle" | "dragging" | "exiting" | "resetting";

interface GestureState {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  horizontal: boolean;
}

// Same icons as the Discovery Lens sheet's quick moods (DiscoverScreen.tsx's
// MOOD_OPTIONS) - one mood, one icon, wherever it's picked from.
const CONTINUATION_MOODS: Array<{ id: ExploreMood; label: string; Icon: Icon }> = [
  { id: "coffee", label: "Coffee nearby", Icon: CoffeeIcon },
  { id: "friends", label: "Make friends", Icon: UsersIcon },
  { id: "create", label: "Create something", Icon: PaletteIcon },
  { id: "tonight", label: "Free soon", Icon: MoonIcon },
  { id: "surprise", label: "Surprise me", Icon: ShuffleIcon },
];

function helloLabel(person: DeckPerson): string {
  if (person.openVentureTitle) return "Ask about Venture";
  const interest = person.signals?.shared_interests[0];
  if (interest === "coffee") return "Hello about coffee";
  if (interest === "music") return "Hello about music";
  if (interest === "art") return "Hello about art";
  return "Say Hello";
}

function isImageAvatar(avatar: string): boolean {
  return /^(https?:|data:image|blob:)/i.test(avatar);
}

/**
 * A bounded consideration deck, never a reject stack. Horizontal gestures only
 * change position. Nobody is removed, downranked or hidden by browsing past
 * them.
 */
export function ExploreDeck({
  people,
  lens,
  dayKey,
  sessionKey,
  following,
  onToggleFollow,
  followPending,
  onOpenNearby,
  onExploreTribes,
  onPhaseChange,
  onContinuationLensChange,
}: {
  people: DeckPerson[];
  lens: ExploreLens;
  dayKey: string;
  sessionKey: string;
  following: Set<string>;
  onToggleFollow: (id: string) => void;
  followPending: string | null;
  onOpenNearby: () => void;
  onExploreTribes: () => void;
  onPhaseChange?: (phase: ExploreDeckPhase) => void;
  /** So the header's own lens filter can switch to show whichever lens is
   *  actually driving the deck right now, instead of a second pill inside
   *  the deck repeating what a continuation round is ranked by. */
  onContinuationLensChange?: (lens: ExploreLens | null) => void;
}) {
  const primaryPeople = useMemo(
    () => curateForMood(people, lens, 5, dayKey),
    [dayKey, lens, people],
  );
  const excludedPrimaryIds = useMemo(
    () => new Set(primaryPeople.map((person) => person.id)),
    [primaryPeople],
  );

  const [phase, setPhase] = useState<ExploreDeckPhase>("primary");
  const [index, setIndex] = useState(0);
  const [continuationLens, setContinuationLens] = useState<ExploreLens | null>(null);
  const [doorMessage, setDoorMessage] = useState<string | null>(null);
  const [helloFor, setHelloFor] = useState<DeckPerson | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [swipeMotion, setSwipeMotion] = useState<SwipeMotion>("idle");
  // "Pick a new lens" mirrors the Discovery Lens sheet: quick moods plus a
  // specific-vibe browser, collapsed to a preview until asked to show all 85.
  const [doorVibesExpanded, setDoorVibesExpanded] = useState(false);
  const gestureRef = useRef<GestureState | null>(null);

  const continuationPeople = useMemo(() => {
    if (!continuationLens) return [];
    return curateUnseenForMood(
      people,
      continuationLens,
      excludedPrimaryIds,
      5,
      `${dayKey}:continuation:${lensKey(continuationLens)}`,
    );
  }, [continuationLens, dayKey, excludedPrimaryIds, people]);

  // So tomorrow's ranking can push today's five down instead of showing the
  // same top scorers forever (list_explore_matches applies the penalty).
  // Fire-and-forget, gated on the actual id set rather than dayKey alone so
  // this doesn't re-fire every time `people` re-renders with the same five.
  const recordImpressions = useRecordExploreImpressions();
  const primaryIdsKey = primaryPeople.map((p) => p.id).join(",");
  useEffect(() => {
    if (primaryPeople.length) recordImpressions.mutate(primaryPeople.map((p) => p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryIdsKey]);
  const continuationIdsKey = continuationPeople.map((p) => p.id).join(",");
  useEffect(() => {
    if (continuationPeople.length) recordImpressions.mutate(continuationPeople.map((p) => p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continuationIdsKey]);

  const currentPeople = phase === "continuation" ? continuationPeople : primaryPeople;
  const person = phase === "primary" || phase === "continuation" ? currentPeople[index] : null;
  const queuedPeople = currentPeople.slice(index + 1, index + 3);
  const contact = useContactStatus(person?.id ?? null);
  const reasons = useMemo(() => (person?.signals ? matchReasons(person.signals, 2) : []), [person]);

  const changePhase = (next: ExploreDeckPhase) => {
    setPhase(next);
    onPhaseChange?.(next);
  };

  useEffect(() => {
    gestureRef.current = null;
    setDragX(0);
    setSwipeMotion("idle");
    setIndex(0);
    setContinuationLens(null);
    onContinuationLensChange?.(null);
    setDoorMessage(null);
    changePhase("primary");
    // The callbacks are intentionally excluded: sessionKey is the reset contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  useEffect(() => {
    setPhotoFailed(false);
  }, [person?.id]);

  // `index` is only ever reset on a session-key change (the effect above) -
  // it was never clamped when the *pool itself* shrinks, which it can do
  // live (someone gets blocked, leaves their Tribe, or otherwise drops out
  // of eligibility between refetches) independently of anything the viewer
  // does. Viewing the last card when that happens left `index` pointing
  // past the new end of the array, `person` resolving to undefined, and
  // the whole deck rendering nothing at all - no card, no controls, no
  // error - until the viewer changed mood or day.
  useEffect(() => {
    if (currentPeople.length === 0) return;
    setIndex((current) => Math.min(current, currentPeople.length - 1));
  }, [currentPeople.length]);

  const advance = () => {
    if (index + 1 < currentPeople.length) {
      setIndex((current) => current + 1);
      return;
    }
    setIndex(0);
    changePhase(phase === "primary" ? "doors" : "done");
  };

  const back = () => {
    if (index > 0) setIndex((current) => current - 1);
  };

  const startContinuation = (nextLens: ExploreLens) => {
    const nextPeople = curateUnseenForMood(
      people,
      nextLens,
      excludedPrimaryIds,
      5,
      `${dayKey}:continuation:${lensKey(nextLens)}`,
    );
    if (!nextPeople.length) {
      setDoorMessage("There aren’t enough different introductions for that direction yet.");
      return;
    }
    setDoorMessage(null);
    setContinuationLens(nextLens);
    onContinuationLensChange?.(nextLens);
    setIndex(0);
    changePhase("continuation");
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (swipeMotion === "exiting" || swipeMotion === "resetting") return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select")) return;
    if (
      typeof window !== "undefined" &&
      (event.clientX < 24 || event.clientX > window.innerWidth - 24)
    ) {
      return;
    }
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: performance.now(),
      horizontal: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;

    if (!gesture.horizontal) {
      if (Math.abs(deltaY) > 12 && Math.abs(deltaY) > Math.abs(deltaX)) {
        gestureRef.current = null;
        return;
      }
      if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
        gesture.horizontal = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }

    if (!gesture.horizontal) return;
    event.preventDefault();
    setSwipeMotion("dragging");
    const cardWidth = event.currentTarget.getBoundingClientRect().width;
    const translatedX = deltaX > 0 && index === 0 ? deltaX * 0.22 : deltaX;
    const travelLimit = Math.max(cardWidth * 1.15, 240);
    setDragX(Math.max(-travelLimit, Math.min(travelLimit, translatedX)));
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture || !gesture.horizontal || gesture.pointerId !== event.pointerId) {
      setSwipeMotion("idle");
      setDragX(0);
      return;
    }

    const deltaX = event.clientX - gesture.startX;
    const elapsed = Math.max(performance.now() - gesture.startTime, 1);
    const velocity = Math.abs(deltaX) / elapsed;
    const committed = Math.abs(deltaX) >= 62 || (Math.abs(deltaX) >= 34 && velocity >= 0.45);
    const direction = deltaX < 0 ? -1 : 1;
    const canMove = direction < 0 || index > 0;

    if (!committed || !canMove) {
      setSwipeMotion("idle");
      setDragX(0);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSwipeMotion("idle");
      setDragX(0);
      if (direction < 0) advance();
      else back();
      return;
    }

    const cardWidth = event.currentTarget.getBoundingClientRect().width;
    setSwipeMotion("exiting");
    setDragX(direction * Math.max(cardWidth + 64, window.innerWidth * 0.72));
  };

  const cancelPointer = () => {
    gestureRef.current = null;
    setSwipeMotion("idle");
    setDragX(0);
  };

  const finishSwipeExit = (event: ReactTransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== "transform" || swipeMotion !== "exiting") return;
    const direction = dragX < 0 ? -1 : 1;

    // Put the promoted card at rest with transitions disabled, then restore
    // the regular snap-back transition on the next painted frame.
    setSwipeMotion("resetting");
    setDragX(0);
    if (direction < 0) advance();
    else back();
    window.requestAnimationFrame(() => setSwipeMotion("idle"));
  };

  if (!primaryPeople.length) return null;

  if (phase === "doors") {
    // A picked vibe isn't one of the five continuation moods, so none of
    // them need excluding on its account - only a starting mood excludes its
    // own continuation option, same as before.
    const choices = CONTINUATION_MOODS.filter(
      (option) => option.id !== (typeof lens === "string" ? lens : null),
    );
    const primarySetLabel =
      primaryPeople.length === 5 ? "Today’s five" : `Today’s ${primaryPeople.length}`;
    return (
      // The stack keeps its own silhouette here too - two faint peeking
      // edges behind the card, same treatment the live cards use below, so
      // finishing the deck never reads as leaving it for a menu screen.
      <div className="relative h-full min-h-0">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-3 -bottom-2 top-2 rounded-[28px] border"
          style={{
            backgroundColor: "color-mix(in oklab, var(--brand-solid) 5%, var(--card))",
            borderColor: "color-mix(in oklab, var(--brand-solid) 12%, var(--border))",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-1.5 -bottom-1 top-1 rounded-[28px] border"
          style={{
            backgroundColor: "color-mix(in oklab, var(--brand-solid) 9%, var(--card))",
            borderColor: "color-mix(in oklab, var(--brand-solid) 22%, var(--border))",
          }}
        />
        <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-border bg-card p-5 text-left motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          {/* One statement of "you're done", not three - the checkmark
              badge and the old subtext both said this again in their own
              words. */}
          <div className="shrink-0 border-l-2 border-primary pl-3">
            <p className="label-mono text-primary">{primarySetLabel} complete</p>
            <p className="text-xs text-muted-foreground">
              Everyone stays in play — nobody was rejected.
            </p>
          </div>
          <h3 className="mt-3 shrink-0 font-display text-[26px] font-bold leading-[1.05]">
            Where to next?
          </h3>

          {/* Ventures leads, not a lens - it's the one decisive action on
              this screen, and the best-built thing in the product, so it
              gets first position rather than being found after scrolling
              past a picker. */}
          <button
            type="button"
            onClick={() => intentStore.push({ kind: "openTab", tab: "ventures" })}
            className="group mt-3 flex w-full shrink-0 items-center gap-3 rounded-2xl bg-meutuals-gradient px-4 py-3.5 text-left text-white transition-[transform,filter] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <CalendarPlusIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-sm font-bold">Find a Venture</span>
              <span className="block text-xs text-white/85">
                Start with a real plan instead of a lens.
              </span>
            </span>
            <CaretRightIcon className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </button>

          <div className="mt-3 flex shrink-0 items-center gap-3 text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" aria-hidden />
            or pick a new lens
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* A mood is one of several equal picks, so it's a labeled row of
                real buttons - never a card wearing an icon and a subtitle
                that implies the whole thing is one tap target when the
                actual action lives in three small chips inside it. */}
            <p className="label-mono text-muted-foreground">Quick moods</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {choices.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => startContinuation(option.id)}
                  className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-background/45 px-3.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option.Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onOpenNearby}
              className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <MapPinIcon className="h-3.5 w-3.5" /> Adjust discovery area
            </button>

            {/* Same specific-vibe browser as the Discovery Lens sheet - a
                continuation is choosing a new lens exactly like the first
                one was, so it gets the same two-tier choice: quick moods,
                or any of the ~85 real interests, not just the five words. */}
            <div className="mt-4 flex items-center gap-3 text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" aria-hidden />
              or pick a specific vibe
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
            <div className="mt-3 space-y-3">
              {INTEREST_OPTION_GROUPS.map((group) => {
                const accentColor =
                  "tribeId" in group ? tribeById(group.tribeId).colorVar : undefined;
                const items = doorVibesExpanded ? group.items : group.items.slice(0, 2);
                return (
                  <div key={group.label}>
                    <p
                      className={cn(
                        "label-mono flex items-center gap-1.5",
                        !accentColor && "text-muted-foreground",
                      )}
                      style={accentColor ? { color: readableAccentColor(accentColor) } : undefined}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: accentColor ?? "var(--muted-foreground)" }}
                        aria-hidden
                      />
                      {group.label}
                    </p>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      {items.map((option) => {
                        const VibeIcon = PROFILE_OPTION_ICONS[option.id] ?? CheckIcon;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => startContinuation({ vibeId: option.id })}
                            className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5 text-left text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <VibeIcon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setDoorVibesExpanded((current) => !current)}
              className="mt-3 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {doorVibesExpanded ? "Show fewer" : "Show all 85"}
              <CaretDownIcon
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  doorVibesExpanded && "rotate-180",
                )}
              />
            </button>
          </div>

          <div className="mt-2 shrink-0 border-t border-border/70 pt-2">
            {doorMessage && (
              <p role="status" className="px-2 pb-1 text-xs leading-snug text-muted-foreground">
                {doorMessage}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setIndex(Math.max(primaryPeople.length - 1, 0));
                changePhase("primary");
              }}
              className="group flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 text-left transition-colors hover:bg-background/45 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <CaretLeftIcon className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:-translate-x-0.5" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-foreground">
                  Back to today’s five
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Review anyone again
                </span>
              </span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (phase === "done") {
    const consideredCount = primaryPeople.length + continuationPeople.length;
    return (
      // Same peeking-stack silhouette and status/CTA treatment as the
      // "doors" phase - this is the deck's other end state, not a
      // differently-designed screen.
      <div className="relative h-full min-h-0">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-3 -bottom-2 top-2 rounded-[28px] border"
          style={{
            backgroundColor: "color-mix(in oklab, var(--brand-solid) 5%, var(--card))",
            borderColor: "color-mix(in oklab, var(--brand-solid) 12%, var(--border))",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-1.5 -bottom-1 top-1 rounded-[28px] border"
          style={{
            backgroundColor: "color-mix(in oklab, var(--brand-solid) 9%, var(--card))",
            borderColor: "color-mix(in oklab, var(--brand-solid) 22%, var(--border))",
          }}
        />
        <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-border bg-card p-6 text-left motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          <div className="shrink-0 border-l-2 border-primary pl-3">
            <p className="label-mono text-primary">{consideredCount} considered</p>
            <p className="text-xs text-muted-foreground">Nobody was rejected.</p>
          </div>
          <h3 className="mt-3 shrink-0 font-display text-3xl font-bold leading-tight">
            That’s enough cards.
          </h3>
          <p className="mt-3 shrink-0 text-sm leading-relaxed text-muted-foreground">
            Continue with a real room or plan, or revisit anyone you met today.
          </p>
          <div className="flex min-h-0 flex-1 items-center justify-center py-3">
            <FeatureIllustration src={discoverArt} size="lg" className="w-[190px] opacity-85" />
          </div>
          <div className="grid shrink-0 gap-2">
            <button
              type="button"
              onClick={() => intentStore.push({ kind: "openTab", tab: "ventures" })}
              className="group flex min-h-12 items-center gap-3 rounded-2xl bg-meutuals-gradient px-4 text-left text-white transition-[transform,filter] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <CalendarPlusIcon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-sm font-bold">Browse Ventures</span>
              <CaretRightIcon className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              type="button"
              onClick={onExploreTribes}
              className="group flex min-h-12 items-center justify-between rounded-2xl border border-border bg-background/45 px-4 text-sm font-semibold transition-colors hover:bg-secondary/60 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Explore Tribes
              <CaretRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIndex(0);
                changePhase("primary");
              }}
              className="min-h-11 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Revisit today’s five
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!person) {
    // The clamp above handles a shrinking-but-nonempty pool; this is only
    // reached if every remaining candidate dropped out at once (e.g. a
    // block cleared the whole deck). A real, labeled state instead of a
    // silent blank screen - matching the "done" phase's own visual
    // language rather than introducing a new empty-state look.
    return (
      <section className="flex h-full min-h-0 flex-col items-center justify-center rounded-[28px] border border-border bg-card p-6 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
        <FeatureIllustration src={discoverArt} size="lg" className="w-[190px] opacity-85" />
        <h3 className="mt-3 font-display text-2xl font-bold leading-tight">
          Nobody left in this deck.
        </h3>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          The people in it changed while you were looking. Try a different mood or check back
          tomorrow.
        </p>
      </section>
    );
  }

  const tribe = tribeById(person.tribeId);
  const isFollowing = following.has(person.id);
  const canMessage = contact.data?.can_message === true;
  const helloStatus = contact.data?.hello_status ?? null;
  const profileParams = { handle: person.handle.replace(/^@/, "") || person.id };
  const hasPhoto = isImageAvatar(person.avatar) && !photoFailed;
  const nextRevealProgress = Math.min(Math.max(-dragX / 220, 0), 1);
  const cardTilt = Math.max(-4, Math.min(4, dragX / 36));
  const cardOpacity = swipeMotion === "exiting" ? Math.max(0.18, 1 - Math.abs(dragX) / 420) : 1;

  return (
    <div className="relative flex h-full min-h-0 flex-col" aria-live="polite">
      {/* No in-deck pill announcing the continuation lens - DiscoverScreen's
          own filter pill switches to show it instead (via
          onContinuationLensChange), so there's one place this fact lives,
          not a second display repeating what the header already says. */}
      <p className="sr-only">Showing {person.name}</p>
      <div className="relative min-h-0 flex-1">
        {queuedPeople.map((queuedPerson, queueIndex) => {
          const queuedTribe = tribeById(queuedPerson.tribeId);
          const isNext = queueIndex === 0;
          return (
            <span
              key={queuedPerson.id}
              aria-hidden
              className="pointer-events-none absolute rounded-[28px] border motion-safe:transition-[transform,background-color,border-color] motion-safe:duration-200"
              style={{
                left: isNext ? "0.375rem" : "0.75rem",
                right: isNext ? "0.375rem" : "0.75rem",
                top: isNext ? "0.375rem" : "0",
                bottom: isNext ? "0.1875rem" : "0.375rem",
                zIndex: isNext ? 1 : 0,
                backgroundColor: `color-mix(in oklab, ${queuedTribe.colorVar} ${isNext ? 18 : 11}%, var(--card))`,
                borderColor: `color-mix(in oklab, ${queuedTribe.colorVar} ${isNext ? 42 : 26}%, var(--border))`,
                boxShadow: isNext
                  ? "0 -5px 18px color-mix(in oklab, var(--background) 58%, transparent)"
                  : "none",
                transform: isNext
                  ? `translateY(${nextRevealProgress * 6}px) scale(${0.985 + nextRevealProgress * 0.015})`
                  : `translateY(${nextRevealProgress * 3}px) scale(${0.975 + nextRevealProgress * 0.01})`,
              }}
            />
          );
        })}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={cancelPointer}
          onTransitionEnd={finishSwipeExit}
          className={cn(
            "absolute inset-x-0 bottom-0 top-3 z-[2] touch-pan-y",
            swipeMotion === "idle" &&
              "transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
            swipeMotion === "exiting" &&
              "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          )}
          style={{
            opacity: cardOpacity,
            transform: `translate3d(${dragX}px, 0, 0) rotate(${cardTilt}deg)`,
          }}
        >
          <article
            key={`${sessionKey}-${phase}-${person.id}`}
            className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-border bg-card motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            <div
              className="relative h-[52%] min-h-[14rem] shrink-0 overflow-hidden bg-card"
              style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 24%, var(--card))` }}
            >
              <img
                src={tribe.art}
                alt=""
                className={cn(
                  "absolute inset-0 h-full w-full object-cover",
                  hasPhoto ? "scale-110 opacity-35 blur-xl" : "opacity-70",
                )}
              />
              {hasPhoto ? (
                <LazyImage
                  src={person.avatar}
                  alt={`${person.name}'s profile`}
                  onError={() => setPhotoFailed(true)}
                  draggable={false}
                  eager
                  wrapperClassName="absolute inset-0 h-full w-full"
                  className="absolute inset-0 h-full w-full select-none object-cover object-center"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center pb-12">
                  <span
                    className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-[34px] border border-white/15 text-6xl shadow-2xl"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 38%, var(--card))`,
                    }}
                  >
                    {person.avatar}
                  </span>
                </div>
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-black/15" />

              {person.openVentureTitle && (
                <button
                  type="button"
                  onClick={() => intentStore.push({ kind: "openTab", tab: "ventures" })}
                  className="absolute left-4 top-4 z-10 flex min-h-10 max-w-[calc(100%-5.5rem)] items-center gap-2 rounded-full border border-accent/40 bg-black/60 px-3 text-left text-white backdrop-blur-md transition-colors hover:border-accent active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <CalendarPlusIcon className="h-3.5 w-3.5 shrink-0 text-accent-readable" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">
                      {person.openVentureTitle}
                    </span>
                    <span className="block text-xs text-white/80">Hosting · spots open</span>
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onToggleFollow(person.id)}
                disabled={followPending === person.id}
                aria-label={
                  isFollowing ? `Remove ${person.name} from saved` : `Save ${person.name}`
                }
                aria-pressed={isFollowing}
                className={cn(
                  "absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full border bg-black/55 backdrop-blur-sm transition-colors active:scale-90 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
                  isFollowing
                    ? "border-accent/60 text-accent-readable"
                    : "border-white/20 text-white/80",
                )}
              >
                {followPending === person.id ? (
                  <SpinnerGapIcon className="h-4 w-4 animate-spin" />
                ) : isFollowing ? (
                  <BookmarkSimpleIcon className="h-4 w-4" weight="fill" />
                ) : (
                  <BookmarkSimpleIcon className="h-4 w-4" />
                )}
              </button>

              <div className="absolute inset-x-0 bottom-0 z-[1] p-5">
                <div className="flex min-w-0 items-center gap-2 text-xs text-white/80">
                  <span className="relative">
                    <TribeMark tribe={tribe} size="xs" />
                    {person.plus && <PlusBadge />}
                  </span>
                  <span className="shrink-0">{tribe.name}</span>
                </div>
                <h3 className="mt-2 truncate font-display text-3xl font-bold leading-none text-white">
                  {person.name}
                </h3>
                {person.handle && <p className="mt-1 text-xs text-white/80">{person.handle}</p>}
                {(person.city || person.distanceBand || person.outsideRadius) && (
                  <p className="mt-2 flex min-w-0 items-center gap-1.5 text-xs">
                    <MapPinIcon
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: readableAccentColor(tribe.colorVar) }}
                    />
                    {person.city && <span className="truncate text-white/75">{person.city}</span>}
                    {person.city && (person.distanceBand || person.outsideRadius) && (
                      <span className="shrink-0 text-white/70">·</span>
                    )}
                    {person.distanceBand && (
                      <span
                        className="shrink-0 font-semibold"
                        style={{ color: readableAccentColor(tribe.colorVar) }}
                      >
                        {person.distanceBand}
                      </span>
                    )}
                    {/* Confirmed outside the mutual radius, not just unmeasured -
                        the honest label the missing chip should have been all
                        along. Only shown when we positively know they're too
                        far, never for the (much more common) "hasn't opted
                        into Nearby" case, which stays silent as before. */}
                    {!person.distanceBand && person.outsideRadius && (
                      <span className="shrink-0 font-semibold text-white/80">
                        Outside your radius
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col p-4">
              <section className="border-l-2 pl-4" style={{ borderColor: tribe.colorVar }}>
                <p className="label-mono" style={{ color: readableAccentColor(tribe.colorVar) }}>
                  In their words
                </p>
                <blockquote className="mt-1.5 line-clamp-2 font-display text-[16px] font-semibold leading-snug text-foreground">
                  “{person.bio || "I’m open to meeting good people and trying something new."}”
                </blockquote>
              </section>

              {reasons.length > 0 && (
                <section className="mt-3 border-t border-border/70 pt-3">
                  <p className="label-mono text-muted-foreground">Why you might click</p>
                  <ul className="mt-2 space-y-1.5">
                    {reasons.map((reason) => (
                      <li
                        key={reason.key}
                        className="flex items-start gap-2 text-xs text-foreground/85"
                      >
                        <span
                          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 20%, transparent)`,
                            color: readableAccentColor(tribe.colorVar),
                          }}
                        >
                          <CheckIcon className="h-2.5 w-2.5" />
                        </span>
                        {reason.label}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="mt-auto flex gap-2 pt-3">
                <Link
                  to="/u/$handle"
                  params={profileParams}
                  className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-border bg-background/45 px-3 text-xs font-semibold transition-colors hover:bg-secondary/60 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  View profile
                </Link>

                {contact.isLoading ? (
                  <button
                    type="button"
                    disabled
                    className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-primary text-xs font-semibold text-primary-foreground opacity-60"
                  >
                    <SpinnerGapIcon className="h-4 w-4 animate-spin" />
                  </button>
                ) : canMessage ? (
                  <button
                    type="button"
                    onClick={() => intentStore.push({ kind: "openThreadWith", userId: person.id })}
                    className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-meutuals-gradient px-3 text-xs font-semibold text-white transition-[transform,filter] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <ChatCircleIcon className="h-3.5 w-3.5" /> Message {person.name.split(" ")[0]}
                  </button>
                ) : helloStatus ? (
                  <button
                    type="button"
                    disabled
                    className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-border bg-background/40 px-3 text-xs font-semibold text-muted-foreground opacity-70"
                  >
                    {helloStatus === "pending" ? "Hello sent" : "Not accepting"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setHelloFor(person)}
                    className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-meutuals-gradient px-3 text-xs font-semibold text-white transition-[transform,filter] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <HandIcon className="h-3.5 w-3.5" /> {helloLabel(person)}
                  </button>
                )}
              </div>
            </div>
          </article>
        </div>
      </div>

      {helloFor && (
        <HelloModal
          open={!!helloFor}
          onClose={() => setHelloFor(null)}
          recipientId={helloFor.id}
          recipientName={helloFor.name}
          hellosLeft={contact.data?.hellos_left_this_month}
          signals={helloFor.signals}
        />
      )}
    </div>
  );
}
