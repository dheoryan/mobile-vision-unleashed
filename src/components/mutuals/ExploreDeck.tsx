import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  CalendarPlus,
  Check,
  Hand,
  Loader2,
  MapPin,
  MessageCircle,
  RotateCcw,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { TribeMark } from "./TribeMark";
import { PlusBadge } from "./PlusBadge";
import { HelloModal } from "./HelloModal";
import { useContactStatus } from "@/lib/social-store";
import { matchReasons, type MatchSignals } from "@/lib/explore-reasons";
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
  plus?: boolean;
  distanceBand?: string | null;
  matchScore?: number;
  signals?: MatchSignals;
  openVentureId?: string | null;
  openVentureTitle?: string | null;
}

function helloLabel(person: DeckPerson): string {
  if (person.openVentureTitle) return "Ask about Venture";
  const interest = person.signals?.shared_interests[0];
  if (interest === "coffee") return "Hello about coffee";
  if (interest === "music") return "Hello about music";
  if (interest === "art") return "Hello about art";
  return "Say Hello";
}

/**
 * A five-person consideration deck, not a dating swipe stack. “Maybe later”
 * rotates the queue and never records rejection; Back only changes position.
 */
export function ExploreDeck({
  people,
  sessionKey,
  following,
  onToggleFollow,
  followPending,
}: {
  people: DeckPerson[];
  sessionKey: string;
  following: Set<string>;
  onToggleFollow: (id: string) => void;
  followPending: string | null;
}) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [helloFor, setHelloFor] = useState<DeckPerson | null>(null);
  const [completedRound, setCompletedRound] = useState(false);

  useEffect(() => {
    setIndex(0);
    setDirection("forward");
    setCompletedRound(false);
  }, [sessionKey]);

  const person = people[index] ?? null;
  const contact = useContactStatus(person?.id ?? null);
  const reasons = useMemo(() => (person?.signals ? matchReasons(person.signals, 3) : []), [person]);

  if (!person) return null;

  const tribe = tribeById(person.tribeId);
  const isFollowing = following.has(person.id);
  const canMessage = contact.data?.can_message === true;
  const helloStatus = contact.data?.hello_status ?? null;
  const profileParams = { handle: person.handle.replace(/^@/, "") || person.id };

  const advance = () => {
    setDirection("forward");
    if (index + 1 >= people.length) setCompletedRound(true);
    setIndex((current) => (current + 1) % people.length);
  };

  const back = () => {
    setDirection("back");
    setIndex((current) => (current - 1 + people.length) % people.length);
  };

  return (
    <div aria-live="polite">
      <article
        key={`${sessionKey}-${person.id}`}
        className={cn(
          "relative overflow-hidden rounded-[28px] border border-border bg-card motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200",
          direction === "forward"
            ? "motion-safe:slide-in-from-right-2"
            : "motion-safe:slide-in-from-left-2",
        )}
        style={{
          background: `linear-gradient(155deg, color-mix(in oklab, ${tribe.colorVar} 24%, var(--card)) 0%, var(--card) 42%)`,
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ backgroundColor: tribe.colorVar }}
        />

        <div className="p-5">
          <div className="flex items-start gap-4">
            <span className="relative shrink-0">
              <span
                className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[22px] text-4xl"
                style={{
                  backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 28%, transparent)`,
                }}
              >
                {person.avatar.startsWith("http") || person.avatar.startsWith("data:") ? (
                  <img src={person.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  person.avatar
                )}
              </span>
              {person.plus && <PlusBadge />}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display text-2xl font-bold leading-tight">
                    {person.name}
                  </h3>
                  {person.handle && (
                    <p className="truncate text-xs text-muted-foreground">{person.handle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onToggleFollow(person.id)}
                  disabled={followPending === person.id}
                  aria-label={
                    isFollowing ? `Remove ${person.name} from saved` : `Save ${person.name}`
                  }
                  aria-pressed={isFollowing}
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
                    isFollowing
                      ? "border-accent/60 bg-accent/15 text-accent"
                      : "border-border bg-background/45 text-muted-foreground",
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
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <TribeMark tribe={tribe} size="xs" /> {tribe.name}
                </span>
                {person.city && <span>{person.city}</span>}
                {person.distanceBand && (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <MapPin className="h-3 w-3" /> {person.distanceBand}
                  </span>
                )}
              </div>
            </div>
          </div>

          <section className="mt-5 border-l-2 border-primary/70 pl-4">
            <p className="label-mono text-primary">In their words</p>
            <blockquote className="mt-2 font-display text-[17px] font-semibold leading-snug text-foreground">
              “{person.bio || "I’m open to meeting good people and trying something new."}”
            </blockquote>
          </section>

          {reasons.length > 0 && (
            <section className="mt-5 border-t border-border/70 pt-4">
              <p className="label-mono text-muted-foreground">Why you might click</p>
              <ul className="mt-3 space-y-2">
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

          {person.openVentureTitle && (
            <section className="mt-5 border-t border-border/70 pt-4">
              <p className="label-mono text-accent">Their open invitation</p>
              <button
                type="button"
                onClick={() => intentStore.push({ kind: "openTab", tab: "ventures" })}
                className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-accent/35 bg-accent/10 px-3 text-left transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <CalendarPlus className="h-4 w-4 shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">
                    {person.openVentureTitle}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Hosting now · spots open
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </section>
          )}

          <div className="mt-5 flex gap-2">
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

      <nav
        className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3"
        aria-label="Today’s connections"
      >
        <button
          type="button"
          onClick={back}
          disabled={people.length < 2}
          className="flex min-h-11 items-center justify-start gap-1.5 rounded-full px-2 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-35"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Back
        </button>
        <span className="label-mono text-muted-foreground">
          {index + 1} of {people.length}
        </span>
        <button
          type="button"
          onClick={advance}
          disabled={people.length < 2}
          className="flex min-h-11 items-center justify-end gap-1.5 rounded-full px-2 text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-35"
        >
          Maybe later <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </nav>

      {completedRound && (
        <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          That’s today’s set. Pick another mood for a different view, or revisit anyone—nothing was
          rejected.
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
