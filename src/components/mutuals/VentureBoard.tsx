import { useMemo, useState } from "react";
import { CalendarDotIcon } from "@phosphor-icons/react/dist/csr/CalendarDot";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { LockIcon } from "@phosphor-icons/react/dist/csr/Lock";
import { MapPinIcon } from "@phosphor-icons/react/dist/csr/MapPin";
import { NavigationArrowIcon } from "@phosphor-icons/react/dist/csr/NavigationArrow";
import { SealCheckIcon } from "@phosphor-icons/react/dist/csr/SealCheck";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { TicketIcon } from "@phosphor-icons/react/dist/csr/Ticket";
import { UserCheckIcon } from "@phosphor-icons/react/dist/csr/UserCheck";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import type { VentureParty } from "@/lib/ventures.functions";
import { dayKey, dayLabel, timingLabel, ventureTz } from "@/lib/venture-time";
import { cn } from "@/lib/utils";
import { VentureImage } from "./VentureImage";
import { VentureVibeLabel } from "./VentureVibeLabel";

/**
 * The public Venture list.
 *
 * Looking is a decision surface, so every row leads with the Venture's photo
 * and enough context to compare plans. Expanding one row reveals the complete
 * public detail and request action without leaving the board.
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
  // One open row keeps the list scannable and makes the selected plan the
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
              <BoardListItem
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
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BoardListItem({
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
}) {
  const application = venture.my_application;
  const accepted = application?.status === "accepted";
  const pending = application?.status === "pending";
  const declined = application?.status === "declined";
  const full = venture.filled_slots >= venture.max_slots;
  const remaining = Math.max(venture.max_slots - venture.filled_slots, 0);
  const detailsId = `venture-list-item-${venture.id}`;
  const timing = timingLabel(venture);

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
      className={cn(
        "overflow-hidden rounded-2xl border bg-card transition-colors",
        open ? "border-primary/60" : "border-border",
        accepted && "border-accent/60",
        full && !accepted && !pending && "opacity-55",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={detailsId}
        className="grid min-h-32 w-full grid-cols-[5.5rem_1fr] gap-3 p-3 text-left transition-colors hover:bg-secondary/20 active:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <div className="relative h-[6.5rem] w-[5.5rem] overflow-hidden rounded-xl bg-secondary/50">
          <span className="absolute inset-0 flex items-center justify-center text-muted-foreground/45">
            <TicketIcon className="h-5 w-5" aria-hidden />
          </span>
          <VentureImage
            path={venture.image_url}
            rounded="rounded-xl"
            className="absolute inset-0 h-full w-full"
          />
          {timing && (
            <span className="absolute inset-x-1 bottom-1 truncate rounded-md bg-background/90 px-1.5 py-1 text-center font-mono text-xs font-bold uppercase tracking-wide backdrop-blur-sm">
              {timing}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-col py-0.5">
          <span className="mb-2 flex w-full items-center justify-between gap-2">
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 font-mono text-xs font-bold uppercase tracking-[0.12em]",
                accepted
                  ? "border-accent text-accent-readable"
                  : pending
                    ? "border-primary/50 text-primary"
                    : "border-border text-muted-foreground",
              )}
            >
              {statusLabel}
            </span>
            <CaretDownIcon
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </span>

          <span className="line-clamp-2 text-[15px] font-bold leading-tight tracking-tight">
            {venture.title}
          </span>

          {timing && <span className="mt-1 truncate text-xs text-muted-foreground">{timing}</span>}

          {venture.venue && (
            <span className="mt-1 flex min-w-0 items-center gap-1 text-xs leading-tight text-foreground/80">
              <span className="truncate">{venture.venue.host_label}</span>
              {venture.venue.google_place_id && (
                <SealCheckIcon
                  className="h-3 w-3 shrink-0 text-accent-readable"
                  aria-label="Verified place"
                />
              )}
            </span>
          )}

          <span className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <UsersIcon className="h-2.5 w-2.5" />
              {venture.filled_slots}/{venture.max_slots} going
            </span>
            {venture.distance_band && (
              <span className="inline-flex items-center gap-1 text-primary">
                <NavigationArrowIcon className="h-2.5 w-2.5" aria-hidden />
                {venture.distance_band}
              </span>
            )}
            {venture.intents[0] && (
              <span className="inline-flex items-center gap-1">
                <VentureVibeLabel value={venture.intents[0]} iconClassName="h-2.5 w-2.5" />
              </span>
            )}
          </span>
        </div>
      </button>

      {open && (
        <div
          id={detailsId}
          className="animate-rise space-y-4 border-t border-border px-4 pb-4 pt-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <DetailItem icon={<CalendarDotIcon className="h-3.5 w-3.5" />} label="When">
              {timing || "Time arranged with host"}
            </DetailItem>
            <DetailItem icon={<UsersIcon className="h-3.5 w-3.5" />} label="Group">
              {venture.filled_slots} going · {remaining} open
            </DetailItem>
            <DetailItem icon={<UserCheckIcon className="h-3.5 w-3.5" />} label="Hosted by">
              {venture.host?.display_name || "A MEUTUALS member"}
            </DetailItem>
            <DetailItem icon={<MapPinIcon className="h-3.5 w-3.5" />} label="Area">
              {venture.venue
                ? [venture.venue.host_label, venture.venue.area].filter(Boolean).join(" · ")
                : venture.host?.city || "Shared after acceptance"}
            </DetailItem>
          </div>

          {venture.intents.length > 0 && (
            <div>
              <p className="label-mono text-muted-foreground">Vibe</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {venture.intents.map((intent) => (
                  <span
                    key={intent}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    <VentureVibeLabel value={intent} />
                  </span>
                ))}
              </div>
            </div>
          )}

          {venture.note && (
            <div>
              <p className="label-mono text-muted-foreground">From the host</p>
              <p className="mt-2 rounded-xl bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
                {venture.note}
              </p>
            </div>
          )}

          {accepted ? (
            <button
              type="button"
              onClick={onOpenChat}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-meutuals-gradient px-4 text-xs font-semibold text-white transition-[transform,filter] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChatCircleIcon className="h-4 w-4" /> Open party chat
            </button>
          ) : pending || declined ? (
            <div className="space-y-2">
              <div className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-xs font-semibold text-muted-foreground">
                {pending ? <UsersIcon className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
                {pending ? "Request pending" : "Request declined"}
              </div>
              {pending && application && (
                <button
                  type="button"
                  onClick={() => onWithdraw(application.id)}
                  disabled={withdrawing}
                  className="min-h-11 w-full rounded text-xs font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
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
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-meutuals-gradient px-4 text-xs font-semibold text-white transition-[transform,filter] hover:brightness-110 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
              >
                {applying ? (
                  <SpinnerGapIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <UserCheckIcon className="h-4 w-4" />
                )}
                {full ? "This one is full" : "Request this Venture"}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function DetailItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-secondary/35 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-foreground/85">{children}</p>
    </div>
  );
}
