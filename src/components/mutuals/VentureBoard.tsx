import { useMemo, useState } from "react";
import {
  BadgeCheck,
  ChevronDown,
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
 * The public ticket rack.
 *
 * A Venture starts as an available ticket, becomes a pending ticket after an
 * application, and moves into Yours once accepted. The shared silhouette makes
 * that state change legible, while restrained public styling keeps an available
 * ticket from looking like something the member already owns.
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
  // One open ticket keeps the rack scannable and makes the selected plan the
  // obvious next action without introducing a separate modal.
  const [openId, setOpenId] = useState<string | null>(null);
  const groups = useMemo(() => groupByDay(ventures), [ventures]);

  return (
    <div className="mt-1 space-y-1">
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

          <div className="space-y-3">
            {group.ventures.map((venture) => (
              <BoardTicket
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
          </div>
        </section>
      ))}
    </div>
  );
}

function BoardTicket({
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
  const remaining = Math.max(venture.max_slots - venture.filled_slots, 0);

  const mins = durationMinutes(venture);
  const duration = mins ? (mins % 60 === 0 ? `${mins / 60}h` : `${mins}m`) : null;
  const stub = venture.starts_at ? ticketDateParts(venture.starts_at, tz) : null;
  const detailsId = `venture-ticket-${venture.id}`;

  const statusLabel = accepted
    ? "You're in"
    : pending
      ? "Request sent"
      : declined
        ? "Closed to you"
        : full
          ? "Sold out"
          : remaining === 1
            ? "Last spot"
            : `${remaining} spots`;

  return (
    <article
      className={cn("relative transition-opacity", full && !accepted && !pending && "opacity-55")}
    >
      {stub && (
        <>
          <span
            aria-hidden
            className="absolute -top-1.5 left-[4.75rem] z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-background"
          />
          <span
            aria-hidden
            className="absolute -bottom-1.5 left-[4.75rem] z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-background"
          />
        </>
      )}

      <div
        className={cn(
          "grid overflow-hidden rounded-2xl border bg-card shadow-[0_12px_30px_-24px_rgba(0,0,0,0.9)] transition-colors",
          stub ? "grid-cols-[4.75rem_1fr]" : "grid-cols-1",
          open ? "border-primary/60" : "border-border",
          accepted && "border-accent/60",
        )}
      >
        {stub && !undated && (
          <div className="flex flex-col items-center justify-start gap-0.5 border-r border-dashed border-border bg-secondary/20 px-2 py-4 text-center">
            <span className="label-mono text-muted-foreground">{stub.weekday}</span>
            <span className="font-mono text-[27px] font-bold leading-none tracking-tighter text-primary">
              {stub.day}
            </span>
            <span className="label-mono text-muted-foreground">{stub.month}</span>
            <span className="my-1.5 h-px w-6 bg-border" aria-hidden />
            <span className="font-mono text-[13px] font-bold">{clock(venture.starts_at!, tz)}</span>
            {duration && (
              <span className="font-mono text-[9px] text-muted-foreground">{duration}</span>
            )}
          </div>
        )}

        <div className="min-w-0">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={detailsId}
            className="flex min-h-32 w-full flex-col p-3.5 text-left transition-colors hover:bg-secondary/20 active:bg-secondary/40"
          >
            <span className="mb-2 flex w-full items-center justify-between gap-2">
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.16em]",
                  accepted
                    ? "border-accent text-accent"
                    : pending
                      ? "border-primary/50 text-primary"
                      : "border-border text-muted-foreground",
                )}
              >
                {statusLabel}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                  open && "rotate-180",
                )}
                aria-hidden
              />
            </span>

            <span className="text-[15px] font-bold leading-tight tracking-tight">
              {venture.title}
            </span>

            {!stub && venture.time_window && (
              <span className="mt-1 text-[11px] text-muted-foreground">{venture.time_window}</span>
            )}

            {venture.venue && (
              <span className="mt-1 flex min-w-0 items-center gap-1 text-[11.5px] leading-tight text-foreground/80">
                <span className="truncate">{venture.venue.host_label}</span>
                {venture.venue.google_place_id && (
                  <BadgeCheck
                    className="h-3 w-3 shrink-0 text-accent"
                    aria-label="Verified place"
                  />
                )}
                {venture.venue.area && (
                  <>
                    <span className="opacity-50">·</span>
                    <span className="truncate text-muted-foreground">{venture.venue.area}</span>
                  </>
                )}
              </span>
            )}

            <span className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-3 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-2.5 w-2.5" />
                {venture.filled_slots}/{venture.max_slots} going
              </span>
              {venture.distance_band && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Navigation className="h-2.5 w-2.5" aria-hidden />
                  {venture.distance_band}
                </span>
              )}
              {venture.intents.slice(0, 2).map((intent) => (
                <span key={intent}>{intent}</span>
              ))}
            </span>
          </button>

          {open && (
            <div
              id={detailsId}
              className="animate-rise space-y-2 border-t border-dashed border-border px-3.5 pb-3.5 pt-3"
            >
              {venture.note && (
                <p className="rounded-xl bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  {venture.note}
                </p>
              )}

              {accepted ? (
                <button
                  type="button"
                  onClick={onOpenChat}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground"
                >
                  <MessageCircle className="h-4 w-4" /> Open party chat
                </button>
              ) : pending || declined ? (
                <div className="space-y-2">
                  <div className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-xs font-semibold text-muted-foreground">
                    {pending ? <Users className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    {pending ? "Request pending" : "Request declined"}
                  </div>
                  {pending && application && (
                    <button
                      type="button"
                      onClick={() => onWithdraw(application.id)}
                      disabled={withdrawing}
                      className="min-h-11 w-full text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
                    >
                      {withdrawing ? "Withdrawing…" : "Withdraw my request"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="sr-only" htmlFor={`venture-note-${venture.id}`}>
                    Optional note to the host
                  </label>
                  <input
                    id={`venture-note-${venture.id}`}
                    value={note}
                    onChange={(event) => onNoteChange(event.target.value.slice(0, 180))}
                    placeholder="Optional note to the host"
                    className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-xs outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={onApply}
                    disabled={applying || full}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {applying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserCheck className="h-4 w-4" />
                    )}
                    {full ? "This one is full" : "Request this ticket"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ticketDateParts(iso: string, tz: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) parts[part.type] = part.value;
  return {
    weekday: (parts.weekday ?? "").toUpperCase(),
    day: parts.day ?? "",
    month: (parts.month ?? "").toUpperCase().replace(".", ""),
  };
}
