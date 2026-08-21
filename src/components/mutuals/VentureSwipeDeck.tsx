import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Loader2, Users, X, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { TribeMark } from "./TribeMark";
import { VentureImage } from "./VentureImage";
import { useApplyToVenture, type VentureParty } from "@/lib/ventures-store";
import { cn } from "@/lib/utils";

/**
 * Swipe over open Ventures — in or out.
 *
 * This is the swipe deck, deliberately pointed at plans rather than people.
 *
 * Judging an activity sidesteps the problem with swiping on faces: no romantic
 * reading, no pressure on how someone photographs, and no incentive to treat a
 * profile as a shopfront. It also puts the app's actual differentiator at the
 * front door instead of behind a tab.
 *
 * And the supply works. People are a fixed pool that a reject-forever deck
 * would exhaust in a sitting; Ventures are created continuously, expire on
 * their own, and refill. A deck is the right shape for a stream and the wrong
 * shape for a directory.
 *
 * Passing is not permanent — a passed Venture returns at the end of the queue,
 * because at launch density a single session could otherwise empty the board.
 */
export function VentureSwipeDeck({
  ventures,
  onOpenChat,
  onChanged,
}: {
  ventures: VentureParty[];
  onOpenChat: (venture: VentureParty) => void;
  onChanged: () => void;
}) {
  const [passed, setPassed] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const apply = useApplyToVenture();

  // Anything already requested or joined isn't a decision any more.
  const queue = useMemo(() => {
    const undecided = ventures.filter((v) => !v.my_application);
    const fresh = undecided.filter((v) => !passed.includes(v.id));
    const later = undecided.filter((v) => passed.includes(v.id));
    return [...fresh, ...later];
  }, [ventures, passed]);

  useEffect(() => {
    if (index >= queue.length) setIndex(0);
  }, [queue.length, index]);

  const venture = queue[index] ?? null;
  if (!venture) return null;

  const tribe = tribeById((venture.host?.tribe_ids?.[0] as TribeId) ?? "wolf");
  const hasPhoto = Boolean(venture.image_url);
  const spotsLeft = Math.max(0, (venture.max_slots ?? 4) - (venture.filled_slots ?? 1));
  const hostName = venture.host?.display_name?.trim() || "Someone";

  const pass = () => {
    setPassed((p) => (p.includes(venture.id) ? p : [...p, venture.id]));
    setIndex((i) => (i + 1 > queue.length - 1 ? 0 : i + 1));
  };

  const undo = () => {
    setPassed((p) => p.slice(0, -1));
    setIndex((i) => Math.max(0, i - 1));
  };

  const join = () => {
    apply.mutate(
      { venture_id: venture.id },
      {
        onSuccess: () => {
          toast.success(`Requested to join ${venture.title}`, {
            description: `${hostName} will review it.`,
          });
          onChanged();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <div>
      {/* A poster, not a list row.
       *
       * Fixed 3:4 whether or not there is a photo. In a deck, cards that
       * change height make every advance jarring — the buttons move, the eye
       * has to relocate, and comparing one plan to the next stops being
       * possible. A constant frame is what lets someone flick through ten of
       * these and actually judge them.
       *
       * Photo fills the frame and the copy sits on it, bottom-anchored, which
       * is also why this reads as an invitation rather than a database row:
       * the picture of the place is the argument for going, so it gets the
       * area. Without a photo the Tribe gradient fills the same frame, so the
       * shape never changes.
       *
       * max-h caps it at 58vh so the card, its two action buttons and the undo
       * row still fit one screen on a short phone. A deck you have to scroll
       * to act on is not a deck.
       */}
      {/* Poster geometry is for photos. A 3:4 frame with nothing in it is
          ~400px of empty gradient with the words pinned to the floor, which is
          what most of these cards look like today — hardly any Venture has a
          thumbnail yet. So the aspect ratio only applies when there is an
          image to fill it; otherwise the card sizes to its own content and the
          title sits where the eye already is. */}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-3xl border border-border",
          hasPhoto ? "aspect-[3/4] max-h-[58vh]" : "min-h-[200px]",
        )}
        style={{
          background: `linear-gradient(160deg, color-mix(in oklab, ${tribe.colorVar} 30%, var(--card)) 0%, var(--card) 62%)`,
        }}
      >
        {hasPhoto && (
          <>
            <VentureImage
              path={venture.image_url}
              rounded="rounded-none"
              className="absolute inset-0 h-full w-full"
            />
            {/* Opaque exactly where the text lands, clear where the photo
                should be seen. Same principle as the list cards. */}
            <span
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent"
            />
          </>
        )}

        <div className={cn(hasPhoto ? "absolute inset-x-0 bottom-0 p-5" : "p-5")}>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <TribeMark tribe={tribe} size="xs" />
            <span className="truncate">{hostName}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex shrink-0 items-center gap-1">
              <Clock className="h-3 w-3" /> {venture.time_window}
            </span>
          </div>

          <h3 className="mt-2 font-display text-3xl font-bold leading-[1.1]">{venture.title}</h3>

          {venture.note && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-foreground/85">
              {venture.note}
            </p>
          )}

          {venture.intents?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {venture.intents.slice(0, 3).map((i) => (
                <span
                  key={i}
                  className="rounded-full border border-white/15 bg-background/50 px-2 py-0.5 text-[11px] text-foreground/80 backdrop-blur-sm"
                >
                  {i}
                </span>
              ))}
            </div>
          )}

          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {spotsLeft > 0
              ? `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left of ${venture.max_slots}`
              : "Full"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={pass}
          disabled={apply.isPending}
          aria-label="Not this one"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border bg-background/40 text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <X className="h-5 w-5" />
        </button>

        <button
          onClick={join}
          disabled={apply.isPending || spotsLeft === 0}
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {apply.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Requesting…
            </>
          ) : spotsLeft === 0 ? (
            "Full"
          ) : (
            <>
              <Check className="h-4 w-4" /> I'm in
            </>
          )}
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={undo}
          disabled={!passed.length}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-muted-foreground",
            passed.length ? "hover:text-foreground" : "opacity-40",
          )}
        >
          <Undo2 className="h-3 w-3" /> Undo
        </button>
        <span className="text-[11px] text-muted-foreground">
          {queue.length} open · passed ones come back
        </span>
      </div>
      {/* The bottom nav is fixed; without this the hint row sits behind it. */}
      <div aria-hidden className="h-4" />
    </div>
  );
}
