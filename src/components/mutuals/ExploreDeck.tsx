import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Hand,
  Loader2,
  MapPin,
  MessageCircle,
  Shuffle,
  UsersRound,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { TribeMark } from "./TribeMark";
import { PlusBadge } from "./PlusBadge";
import { HelloModal } from "./HelloModal";
import { useContactStatus } from "@/lib/social-store";
import { matchReasons, type MatchSignals } from "@/lib/explore-reasons";
import { curateForMood, curateUnseenForMood, type ExploreMood } from "@/lib/explore-moods";
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
  matchScore?: number;
  signals?: MatchSignals;
  openVentureId?: string | null;
  openVentureTitle?: string | null;
}

export type ExploreDeckPhase = "primary" | "doors" | "continuation" | "done";

interface GestureState {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  horizontal: boolean;
}

const CONTINUATION_MOODS: Array<{ id: ExploreMood; label: string }> = [
  { id: "coffee", label: "Coffee nearby" },
  { id: "friends", label: "Make friends" },
  { id: "create", label: "Create something" },
  { id: "tonight", label: "Free soon" },
  { id: "surprise", label: "Surprise me" },
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

function moodLabel(mood: ExploreMood): string {
  return CONTINUATION_MOODS.find((option) => option.id === mood)?.label ?? "A new direction";
}

/**
 * A bounded consideration deck, never a reject stack. Horizontal gestures and
 * the outer arrow controls only change position. Nobody is removed, downranked
 * or hidden by browsing past them.
 */
export function ExploreDeck({
  people,
  mood,
  dayKey,
  sessionKey,
  following,
  onToggleFollow,
  followPending,
  onOpenNearby,
  onExploreTribes,
  onPhaseChange,
}: {
  people: DeckPerson[];
  mood: ExploreMood;
  dayKey: string;
  sessionKey: string;
  following: Set<string>;
  onToggleFollow: (id: string) => void;
  followPending: string | null;
  onOpenNearby: () => void;
  onExploreTribes: () => void;
  onPhaseChange?: (phase: ExploreDeckPhase) => void;
}) {
  const primaryPeople = useMemo(
    () => curateForMood(people, mood, 5, dayKey),
    [dayKey, mood, people],
  );
  const excludedPrimaryIds = useMemo(
    () => new Set(primaryPeople.map((person) => person.id)),
    [primaryPeople],
  );

  const [phase, setPhase] = useState<ExploreDeckPhase>("primary");
  const [index, setIndex] = useState(0);
  const [continuationMood, setContinuationMood] = useState<ExploreMood | null>(null);
  const [doorMessage, setDoorMessage] = useState<string | null>(null);
  const [helloFor, setHelloFor] = useState<DeckPerson | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const gestureRef = useRef<GestureState | null>(null);

  const continuationPeople = useMemo(() => {
    if (!continuationMood) return [];
    return curateUnseenForMood(
      people,
      continuationMood,
      excludedPrimaryIds,
      5,
      `${dayKey}:continuation:${continuationMood}`,
    );
  }, [continuationMood, dayKey, excludedPrimaryIds, people]);

  const currentPeople = phase === "continuation" ? continuationPeople : primaryPeople;
  const person = phase === "primary" || phase === "continuation" ? currentPeople[index] : null;
  const contact = useContactStatus(person?.id ?? null);
  const reasons = useMemo(() => (person?.signals ? matchReasons(person.signals, 2) : []), [person]);

  const changePhase = (next: ExploreDeckPhase) => {
    setPhase(next);
    onPhaseChange?.(next);
  };

  useEffect(() => {
    setIndex(0);
    setContinuationMood(null);
    setDoorMessage(null);
    changePhase("primary");
    // The callback is intentionally excluded: sessionKey is the reset contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  useEffect(() => {
    setPhotoFailed(false);
  }, [person?.id]);

  useEffect(() => {
    try {
      setShowSwipeHint(!window.localStorage.getItem("meutuals:discover-swipe-seen"));
    } catch {
      setShowSwipeHint(true);
    }
  }, []);

  const dismissSwipeHint = () => {
    setShowSwipeHint(false);
    try {
      window.localStorage.setItem("meutuals:discover-swipe-seen", "true");
    } catch {
      // Browsing still works when storage is unavailable.
    }
  };

  const advance = () => {
    dismissSwipeHint();
    if (index + 1 < currentPeople.length) {
      setIndex((current) => current + 1);
      return;
    }
    setIndex(0);
    changePhase(phase === "primary" ? "doors" : "done");
  };

  const back = () => {
    dismissSwipeHint();
    if (index > 0) setIndex((current) => current - 1);
  };

  const startContinuation = (nextMood: ExploreMood) => {
    const nextPeople = curateUnseenForMood(
      people,
      nextMood,
      excludedPrimaryIds,
      5,
      `${dayKey}:continuation:${nextMood}`,
    );
    if (!nextPeople.length) {
      setDoorMessage("There aren’t enough different introductions for that direction yet.");
      return;
    }
    setDoorMessage(null);
    setContinuationMood(nextMood);
    setIndex(0);
    changePhase("continuation");
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
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
    setDragging(true);
    const resistance = deltaX > 0 && index === 0 ? 0.28 : 0.82;
    setDragX(Math.max(-96, Math.min(96, deltaX * resistance)));
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    setDragging(false);
    setDragX(0);
    if (!gesture || !gesture.horizontal || gesture.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - gesture.startX;
    const elapsed = Math.max(performance.now() - gesture.startTime, 1);
    const velocity = Math.abs(deltaX) / elapsed;
    const committed = Math.abs(deltaX) >= 62 || (Math.abs(deltaX) >= 34 && velocity >= 0.45);
    if (!committed) return;
    if (deltaX < 0) advance();
    else if (index > 0) back();
  };

  const cancelPointer = () => {
    gestureRef.current = null;
    setDragging(false);
    setDragX(0);
  };

  if (!primaryPeople.length) return null;

  if (phase === "doors") {
    const choices = CONTINUATION_MOODS.filter((option) => option.id !== mood);
    const primarySetLabel = primaryPeople.length === 5 ? "Today’s five" : "Today’s set";
    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-border bg-card p-5 text-left motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
        <div className="shrink-0">
          <p className="label-mono text-primary">{primarySetLabel} complete</p>
          <h3 className="mt-2 font-display text-[28px] font-bold leading-[1.05]">
            Where do you want to go next?
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Everyone stays in play. Choose a new lens, a plan, or a room.
          </p>
        </div>

        <div className="mt-4 rounded-3xl border border-primary/35 bg-primary/8 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Shuffle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h4 className="font-display text-lg font-bold">Meet another five</h4>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Change the mix without repeating today’s people.
              </p>
            </div>
          </div>
          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {choices.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => startContinuation(option.id)}
                className="min-h-10 shrink-0 rounded-full border border-primary/30 bg-background/60 px-3 text-[11px] font-semibold transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onOpenNearby}
            className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MapPin className="h-3.5 w-3.5" /> Adjust discovery area
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => intentStore.push({ kind: "openTab", tab: "ventures" })}
            className="flex min-h-[6.25rem] flex-col justify-between rounded-3xl border border-border bg-background/45 p-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <CalendarPlus className="h-5 w-5 text-primary" />
            <span>
              <span className="block text-sm font-semibold">Find a Venture</span>
              <span className="mt-1 block text-[10px] leading-snug text-muted-foreground">
                Start with a real plan
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={onExploreTribes}
            className="flex min-h-[6.25rem] flex-col justify-between rounded-3xl border border-border bg-background/45 p-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <UsersRound className="h-5 w-5 text-primary" />
            <span>
              <span className="block text-sm font-semibold">Enter a Tribe</span>
              <span className="mt-1 block text-[10px] leading-snug text-muted-foreground">
                Meet through a room
              </span>
            </span>
          </button>
        </div>

        <div className="mt-auto flex min-h-11 items-end justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setIndex(Math.max(primaryPeople.length - 1, 0));
              changePhase("primary");
            }}
            className="inline-flex min-h-10 items-center gap-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Revisit today’s people
          </button>
          {doorMessage && (
            <p
              role="status"
              className="max-w-36 text-right text-[10px] leading-snug text-muted-foreground"
            >
              {doorMessage}
            </p>
          )}
        </div>
      </section>
    );
  }

  if (phase === "done") {
    const consideredCount = primaryPeople.length + continuationPeople.length;
    return (
      <section className="flex h-full min-h-0 flex-col rounded-[28px] border border-border bg-card p-6 text-left motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
        <p className="label-mono text-primary">{consideredCount} considered, nobody rejected</p>
        <h3 className="mt-2 font-display text-3xl font-bold leading-tight">That’s enough cards.</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Continue with a real room or plan, or revisit anyone you met today.
        </p>
        <div className="mt-auto grid gap-2 pt-6">
          <button
            type="button"
            onClick={() => intentStore.push({ kind: "openTab", tab: "ventures" })}
            className="flex min-h-12 items-center justify-between rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Browse Ventures <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onExploreTribes}
            className="flex min-h-12 items-center justify-between rounded-2xl border border-border bg-background/45 px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Explore Tribes <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIndex(0);
              changePhase("primary");
            }}
            className="min-h-11 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Revisit today’s five
          </button>
        </div>
      </section>
    );
  }

  if (!person) return null;

  const tribe = tribeById(person.tribeId);
  const isFollowing = following.has(person.id);
  const canMessage = contact.data?.can_message === true;
  const helloStatus = contact.data?.hello_status ?? null;
  const profileParams = { handle: person.handle.replace(/^@/, "") || person.id };
  const hasPhoto = isImageAvatar(person.avatar) && !photoFailed;

  return (
    <div className="relative flex h-full min-h-0 flex-col" aria-live="polite">
      {phase === "continuation" && continuationMood && (
        <div className="mb-3 border-l-2 border-primary pl-3">
          <p className="label-mono text-primary">A different five</p>
          <p className="mt-1 text-xs text-muted-foreground">{moodLabel(continuationMood)}</p>
        </div>
      )}
      <p className="sr-only">Showing {person.name}</p>
      <div className="relative min-h-0 flex-1 px-3">
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={cancelPointer}
          className={cn(
            "h-full touch-pan-y",
            !dragging && "transition-transform duration-200 ease-out motion-reduce:transition-none",
          )}
          style={{ transform: `translate3d(${dragX}px, 0, 0)` }}
        >
          <article
            key={`${sessionKey}-${phase}-${person.id}`}
            className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-border bg-card motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            <div
              className="relative h-[45%] min-h-[13rem] shrink-0 overflow-hidden bg-card"
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
                <img
                  src={person.avatar}
                  alt={`${person.name}'s profile`}
                  onError={() => setPhotoFailed(true)}
                  draggable={false}
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
                  className="absolute left-4 top-4 z-10 flex min-h-10 max-w-[calc(100%-5.5rem)] items-center gap-2 rounded-full border border-accent/40 bg-black/60 px-3 text-left text-white backdrop-blur-md transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <CalendarPlus className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] font-semibold">
                      {person.openVentureTitle}
                    </span>
                    <span className="block text-[9px] text-white/65">Hosting · spots open</span>
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
                  "absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full border bg-black/55 backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
                  isFollowing ? "border-accent/60 text-accent" : "border-white/20 text-white/80",
                )}
              >
                {followPending === person.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isFollowing ? (
                  <BookmarkCheck className="h-4 w-4" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </button>

              <div className="absolute inset-x-0 bottom-0 z-[1] p-5">
                <div className="flex min-w-0 items-center gap-2 text-[11px] text-white/80">
                  <span className="relative">
                    <TribeMark tribe={tribe} size="xs" />
                    {person.plus && <PlusBadge />}
                  </span>
                  <span className="shrink-0">{tribe.name}</span>
                  {person.city && <span className="truncate">· {person.city}</span>}
                </div>
                <h3 className="mt-2 truncate font-display text-3xl font-bold leading-none text-white">
                  {person.name}
                </h3>
                {person.handle && <p className="mt-1 text-xs text-white/65">{person.handle}</p>}
                {person.distanceBand && (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    <MapPin className="h-3.5 w-3.5" /> {person.distanceBand}
                  </p>
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col p-4">
              <section className="border-l-2 border-primary/75 pl-4">
                <p className="label-mono text-primary">In their words</p>
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
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                          <Check className="h-2.5 w-2.5" />
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
                  className="flex min-h-12 flex-1 items-center justify-center rounded-2xl border border-border bg-background/45 px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  View profile
                </Link>

                {contact.isLoading ? (
                  <button
                    type="button"
                    disabled
                    className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-primary text-xs font-semibold text-primary-foreground opacity-60"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </button>
                ) : canMessage ? (
                  <button
                    type="button"
                    onClick={() => intentStore.push({ kind: "openThreadWith", userId: person.id })}
                    className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary px-3 text-xs font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Message {person.name.split(" ")[0]}
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
                    className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary px-3 text-xs font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Hand className="h-3.5 w-3.5" /> {helloLabel(person)}
                  </button>
                )}
              </div>
            </div>
          </article>
        </div>

        {index > 0 && (
          <button
            type="button"
            onClick={back}
            aria-label={`Previous introduction before ${person.name}`}
            className="absolute left-3 top-[22.5%] z-10 flex h-14 w-11 -translate-y-1/2 items-center justify-center text-white/80 drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          >
            <ChevronLeft className="h-8 w-8" strokeWidth={2.25} />
          </button>
        )}
        <button
          type="button"
          onClick={advance}
          aria-label={
            index + 1 >= currentPeople.length
              ? phase === "primary"
                ? "Choose what comes after today’s five"
                : "Finish today’s introductions"
              : `Next introduction after ${person.name}`
          }
          className="absolute right-3 top-[22.5%] z-10 flex h-14 w-11 -translate-y-1/2 items-center justify-center text-primary drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)] transition-colors hover:text-primary/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <ChevronRight className="h-8 w-8" strokeWidth={2.25} />
        </button>
      </div>

      {showSwipeHint && (
        <p className="pointer-events-none absolute bottom-[4.25rem] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/65 px-3 py-1.5 text-[10px] text-white/80 backdrop-blur-sm">
          Swipe to browse · nobody is rejected
        </p>
      )}

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
