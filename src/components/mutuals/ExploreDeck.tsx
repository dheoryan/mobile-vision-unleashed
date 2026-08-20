import { useEffect, useState } from "react";
import { ArrowRight, Hand, MapPin, Sparkles, Undo2, UserCheck, UserPlus, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { TribeMark } from "./TribeMark";
import { PlusBadge } from "./PlusBadge";
import { HelloModal } from "./HelloModal";
import { useContactStatus } from "@/lib/social-store";
import { cn } from "@/lib/utils";

export type DeckPerson = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  tribeId: TribeId;
  allTribeIds: TribeId[];
  city: string;
  bio: string;
  plus?: boolean;
  distanceBand?: string;
  matchScore?: number;
};

/**
 * One person at a time, with room to actually read them.
 *
 * Deliberately NOT a dating-style swipe deck, for two reasons.
 *
 * Culturally, swipe-left/right on a face reads as romantic evaluation no matter
 * what label sits above it. This app is for finding people to do things with;
 * importing that grammar would change who installs it, change what people put
 * in their profiles, and work against the harassment protections the Hello flow
 * exists to provide.
 *
 * Practically, a reject-forever deck needs a pool of thousands. Launch density
 * is deliberately concentrated — one city, one or two Tribes — so a deck that
 * burns a card per tap would be exhausted in a single sitting and then be empty
 * permanently. "Next" here means *later*, not *never*: skipped people cycle back
 * to the end, and Back undoes a skip.
 */
export function ExploreDeck({
  people,
  following,
  onToggleFollow,
  followPending,
}: {
  people: DeckPerson[];
  following: Set<string>;
  onToggleFollow: (id: string) => void;
  followPending: string | null;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [helloFor, setHelloFor] = useState<DeckPerson | null>(null);

  // Keep the queue in step with the loaded page without losing the user's place.
  useEffect(() => {
    setOrder((prev) => {
      const ids = people.map((p) => p.id);
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [people]);

  const byId = new Map(people.map((p) => [p.id, p]));
  const queue = order.map((id) => byId.get(id)).filter(Boolean) as DeckPerson[];
  const person = queue[index] ?? null;
  const contact = useContactStatus(person?.id ?? null);

  if (!person) return null;

  const tribe = tribeById(person.tribeId);
  const isFollowing = following.has(person.id);
  const canMessage = contact.data?.can_message !== false;
  const helloStatus = contact.data?.hello_status ?? null;

  const next = () => setIndex((i) => (i + 1) % Math.max(queue.length, 1));
  const back = () => setIndex((i) => (i - 1 + queue.length) % Math.max(queue.length, 1));

  return (
    <div>
      <div
        className="overflow-hidden rounded-3xl border border-border"
        style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${tribe.colorVar} 22%, var(--card)) 0%, var(--card) 62%)` }}
      >
        <div className="p-5">
          <div className="flex items-start gap-4">
            <span className="relative shrink-0">
              <span
                className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl text-4xl"
                style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 28%, transparent)` }}
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
              <h3 className="truncate font-display text-2xl font-bold leading-tight">{person.name}</h3>
              {person.handle && <p className="truncate text-xs text-muted-foreground">{person.handle}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <TribeMark tribe={tribe} size="xs" /> {tribe.name}
                </span>
                {person.city && <span>{person.city}</span>}
                {person.distanceBand && (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <MapPin className="h-3 w-3" /> {person.distanceBand}
                  </span>
                )}
                {person.matchScore !== undefined && (
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> {person.matchScore}% match
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-foreground/90">
            {person.bio || "Open to meeting people across Tribes."}
          </p>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => onToggleFollow(person.id)}
              disabled={followPending === person.id}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-2xl border py-2.5 text-xs font-semibold transition-colors disabled:opacity-60",
                isFollowing ? "border-accent bg-accent/15 text-accent" : "border-border bg-background/40",
              )}
            >
              {followPending === person.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isFollowing ? (
                <><UserCheck className="h-3.5 w-3.5" /> Saved</>
              ) : (
                <><UserPlus className="h-3.5 w-3.5" /> Save</>
              )}
            </button>

            {canMessage ? (
              <Link
                to="/u/$handle"
                params={{ handle: person.handle.replace(/^@/, "") || person.id }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground"
              >
                View profile
              </Link>
            ) : helloStatus ? (
              <button
                disabled
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-border bg-background/40 py-2.5 text-xs font-semibold text-muted-foreground disabled:opacity-70"
              >
                {helloStatus === "pending" ? "Hello sent" : "Not accepting"}
              </button>
            ) : (
              <button
                onClick={() => setHelloFor(person)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-primary bg-primary/10 py-2.5 text-xs font-semibold text-primary"
              >
                <Hand className="h-3.5 w-3.5" /> Say hello
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={back}
          disabled={queue.length < 2}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <Undo2 className="h-3.5 w-3.5" /> Back
        </button>
        <span className="text-[11px] text-muted-foreground">
          {queue.length ? `${index + 1} of ${queue.length}` : ""}
        </span>
        <button
          onClick={next}
          disabled={queue.length < 2}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          Next <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {helloFor && (
        <HelloModal
          open={!!helloFor}
          onClose={() => setHelloFor(null)}
          recipientId={helloFor.id}
          recipientName={helloFor.name}
          hellosLeft={contact.data?.hellos_left_this_month}
        />
      )}
    </div>
  );
}
