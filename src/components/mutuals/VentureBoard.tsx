import { useMemo, useState } from "react";
import {
  BadgeCheck,
  CornerDownRight,
  Loader2,
  Lock,
  MessageCircle,
  Navigation,
  Users,
  UserCheck,
} from "lucide-react";
import type { VentureParty } from "@/lib/ventures.functions";
import { clock, dayKey, dayLabel, durationMinutes, ventureTz } from "@/lib/venture-time";
import { cn } from "@/lib/utils";

/**
 * The departures board.
 *
 * This replaces a stack of cards, and the reason is what a Venture is. Before
 * you are accepted you are not holding anything — you are reading a list of
 * things leaving at times, and you either make one or you don't. A card implies
 * an object you have. A board row implies a departure you might catch.
 *
 * Practically it also fixes a density problem: eight stacked bordered cards put
 * roughly three Ventures on a phone screen. Rows separated by hairlines put ten
 * there, and grouping by day means the eye lands on "Tonight" rather than
 * parsing eight identical rectangles for a date.
 *
 * Time leads because time sorts the list. Typography matching what the data
 * actually does is most of the reason this reads faster than the cards did.
 */

type Props = {
  ventures: VentureParty[];
  notes: Record<string, string>;
  onNoteChange: (ventureId: string, value: string) => void;
  onApply: (venture: VentureParty) => void;
  onOpenChat: (venture: VentureParty) => void;
  applyingId: string | null;
  onWithdraw: (applicationId: string) => void;
  withdrawingId: string | null;
};

type Group = { key: string; label: string; ventures: VentureParty[] };

/**
 * Ventures with no start time still belong on the board — they are real, they
 * just cannot say when. They collect at the bottom under their own heading
 * rather than being scattered through the days or silently dropped.
 */
const UNDATED = "__undated__";

function groupByDay(ventures: VentureParty[]): Group[] {
  const buckets = new Map<string, Group>();

  for (const venture of ventures) {
    const key = venture.starts_at ? dayKey(venture.starts_at, ventureTz(venture)) : UNDATED;
    const label = venture.starts_at ? dayLabel(venture.starts_at, ventureTz(venture)) : "Whenever";
    if (!buckets.has(key)) buckets.set(key, { key, label, ventures: [] });
    buckets.get(key)!.ventures.push(venture);
  }

  return Array.from(buckets.values()).sort((a, b) => {
    if (a.key === UNDATED) return 1;
    if (b.key === UNDATED) return -1;
    return a.key.localeCompare(b.key);
  });
}

export function VentureBoard({
  ventures,
  notes,
  onNoteChange,
  onApply,
  onOpenChat,
  applyingId,
  onWithdraw,
  withdrawingId,
}: Props) {
  // Only one row is ever open. A board where three rows are expanded is a
  // stack of cards again, which is the thing this replaced.
  const [openId, setOpenId] = useState<string | null>(null);
  const groups = useMemo(() => groupByDay(ventures), [ventures]);

  return (
    <div className="mt-1">
      {groups.map((group) => (
        <section key={group.key}>
          {/* When every Venture is undated there is only one group, and a lone
              "Whenever" heading reads like a filter that hid the rest. The
              heading earns its place by separating groups; with nothing to
              separate it is just noise. */}
          {!(groups.length === 1 && group.key === UNDATED) && (
            <header className="flex items-center gap-2 px-1 pb-2 pt-5">
              <span className="label-mono text-primary">{group.label}</span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </header>
          )}

          {group.ventures.map((venture) => (
            <BoardRow
              key={venture.id}
              venture={venture}
              open={openId === venture.id}
              onToggle={() => setOpenId((cur) => (cur === venture.id ? null : venture.id))}
              note={notes[venture.id] ?? ""}
              onNoteChange={(value) => onNoteChange(venture.id, value)}
              onApply={() => onApply(venture)}
              onOpenChat={() => onOpenChat(venture)}
              applying={applyingId === venture.id}
              onWithdraw={onWithdraw}
              withdrawing={withdrawingId === venture.my_application?.id}
              undated={group.key === UNDATED}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function BoardRow({
  venture,
  open,
  onToggle,
  note,
  onNoteChange,
  onApply,
  onOpenChat,
  applying,
  onWithdraw,
  withdrawing,
  undated = false,
}: {
  venture: VentureParty;
  open: boolean;
  onToggle: () => void;
  note: string;
  onNoteChange: (value: string) => void;
  onApply: () => void;
  onOpenChat: () => void;
  applying: boolean;
  onWithdraw: (applicationId: string) => void;
  withdrawing: boolean;
  /** No start time. The clock column is dropped rather than filled with a dash. */
  undated?: boolean;
}) {
  const tz = ventureTz(venture);
  const application = venture.my_application;
  const accepted = application?.status === "accepted";
  const pending = application?.status === "pending";
  const declined = application?.status === "declined";
  const full = venture.filled_slots >= venture.max_slots;

  const mins = durationMinutes(venture);
  const duration = mins ? (mins % 60 === 0 ? `${mins / 60}h` : `${mins}m`) : null;

  return (
    <div className={cn("border-b border-border/60", full && !accepted && "opacity-40")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 py-3 text-left transition-colors active:bg-secondary/40"
      >
        {/* The clock column. Fixed width so titles align down the whole board
            regardless of how long any one time string is.

            Dropped entirely for undated Ventures rather than filled with a
            placeholder. Reserving the width to print an em-dash makes a whole
            group of legacy rows look like a rendering failure, when in fact
            they are simply Ventures from before times existed. */}
        {!undated && (
          <span className="flex w-14 shrink-0 flex-col gap-0.5 pt-0.5">
            <span className="font-mono text-[17px] font-bold leading-none tracking-tight">
              {venture.starts_at ? clock(venture.starts_at, tz) : ""}
            </span>
            {duration && (
              <span className="inline-flex items-center gap-1 font-mono text-[9.5px] text-muted-foreground">
                <CornerDownRight className="h-2.5 w-2.5" /> {duration}
              </span>
            )}
          </span>
        )}

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-bold leading-tight tracking-tight">{venture.title}</span>

          {venture.venue && (
            <span className="flex min-w-0 items-center gap-1 text-[11.5px] leading-tight text-foreground/80">
              <span className="truncate">{venture.venue.host_label}</span>
              {venture.venue.google_place_id && (
                <BadgeCheck className="h-3 w-3 shrink-0 text-accent" aria-label="Verified place" />
              )}
              {venture.venue.area && (
                <>
                  <span className="opacity-50">·</span>
                  <span className="truncate text-muted-foreground">{venture.venue.area}</span>
                </>
              )}
            </span>
          )}

          {venture.distance_band && (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
              <Navigation className="h-2.5 w-2.5" aria-hidden />
              {venture.distance_band}
            </span>
          )}

          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="h-2.5 w-2.5" />
              {venture.filled_slots}/{venture.max_slots} going
            </span>
            {venture.intents.slice(0, 2).map((intent) => (
              <span key={intent}>{intent}</span>
            ))}
            {full && !accepted && <span className="text-destructive">Full</span>}
            {accepted && <span className="text-accent">You're in</span>}
            {pending && <span>Requested</span>}
          </span>
        </span>
      </button>

      {open && (
        <div className={cn("animate-rise space-y-2 pb-4 pr-1", undated ? "pl-1" : "pl-[4.25rem]")}>
          {venture.note && (
            <p className="rounded-xl bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
              {venture.note}
            </p>
          )}

          {accepted ? (
            <button
              type="button"
              onClick={onOpenChat}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-semibold text-primary-foreground"
            >
              <MessageCircle className="h-4 w-4" /> Open party chat
            </button>
          ) : pending || declined ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-xs font-semibold text-muted-foreground">
                {pending ? <Users className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {pending ? "Request pending" : "Request declined"}
              </div>
              {pending && application && (
                <button
                  type="button"
                  onClick={() => onWithdraw(application.id)}
                  disabled={withdrawing}
                  className="w-full py-1 text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
                >
                  {withdrawing ? "Withdrawing…" : "Withdraw my request"}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={note}
                onChange={(event) => onNoteChange(event.target.value.slice(0, 180))}
                placeholder="Optional note to the host"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={onApply}
                disabled={applying || full}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {applying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserCheck className="h-4 w-4" />
                )}
                {full ? "This one is full" : "Apply to join"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
