import { useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  Clock3,
  MapPin,
  Navigation,
  Pencil,
  Pin,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { AnimatedModal } from "@/components/ui/animated-modal";
import type { VentureArrivalStatus, VentureCoordination, VentureParty } from "@/lib/ventures-store";
import {
  VENTURE_ARRIVAL_CHOICES,
  venturePlaceLabel,
  ventureReminderLabel,
} from "@/lib/venture-coordination";
import { timingLabel } from "@/lib/venture-time";
import { cn } from "@/lib/utils";

const ARRIVAL_ICONS = {
  on_my_way: Navigation,
  arrived: CheckCircle2,
  running_late: Clock3,
  cant_make_it: CircleSlash,
} satisfies Record<VentureArrivalStatus, typeof Navigation>;

export function VentureCoordinationPanel({
  venture,
  coordination,
  currentUserId,
  isComplete,
  statusPending,
  announcementPending,
  onSetStatus,
  onSaveAnnouncement,
}: {
  venture: VentureParty;
  coordination?: VentureCoordination;
  currentUserId?: string;
  isComplete: boolean;
  statusPending: boolean;
  announcementPending: boolean;
  onSetStatus: (status: VentureArrivalStatus | null) => void;
  onSaveAnnouncement: (content: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (announcementOpen) setAnnouncementDraft(coordination?.announcement?.content ?? "");
  }, [announcementOpen, coordination?.announcement?.content]);

  const reminder = ventureReminderLabel(venture, now);
  const when = timingLabel(venture);
  const place = venturePlaceLabel(venture);
  const myStatus = coordination?.statuses.find((item) => item.user_id === currentUserId)?.status;
  const isHost = venture.host_id === currentUserId;
  const controlsReady = coordination?.schema_ready === true && !isComplete;

  return (
    <section className="border-b border-border bg-card/25 px-4 py-3" aria-label="Venture brief">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="label-mono text-primary">Venture brief</p>
          {reminder && <p className="mt-1 text-xs font-semibold text-primary">{reminder}</p>}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded px-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Details
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>

      <div className="mt-2 space-y-1.5 text-xs">
        {when && (
          <p className="flex items-start gap-2 text-foreground">
            <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{when}</span>
          </p>
        )}
        {place && (
          <p className="flex items-start gap-2 text-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{place}</span>
          </p>
        )}
        {!when && !place && (
          <p className="text-muted-foreground">The host has not added timing or a place yet.</p>
        )}
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-l border-primary/50 pl-3 text-xs">
          {venture.private_venue?.arrival_details && (
            <div>
              <p className="font-semibold text-foreground">Arrival instructions</p>
              <p className="mt-0.5 leading-relaxed text-muted-foreground">
                {venture.private_venue.arrival_details}
              </p>
            </div>
          )}
          {venture.note && (
            <div>
              <p className="font-semibold text-foreground">Host note</p>
              <p className="mt-0.5 leading-relaxed text-muted-foreground">{venture.note}</p>
            </div>
          )}
          <p className="flex items-start gap-2 pt-1 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Meet in a public place and keep personal location sharing optional.
          </p>
        </div>
      )}

      {(coordination?.announcement || (controlsReady && isHost)) && (
        <div className="mt-3 flex items-start gap-2 border-t border-border/70 pt-3">
          <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Host update
            </p>
            {coordination?.announcement ? (
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                {coordination.announcement.content}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Pin one update everyone should see first.
              </p>
            )}
          </div>
          {controlsReady && isHost && (
            <button
              type="button"
              onClick={() => setAnnouncementOpen(true)}
              aria-label={coordination?.announcement ? "Edit pinned update" : "Pin an update"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {controlsReady && (
        <div className="mt-3 border-t border-border/70 pt-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold">Your arrival</p>
            {myStatus && (
              <button
                type="button"
                onClick={() => onSetStatus(null)}
                disabled={statusPending}
                className="min-h-9 rounded px-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-95 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {VENTURE_ARRIVAL_CHOICES.map((choice) => {
              const Icon = ARRIVAL_ICONS[choice.value];
              const selected = myStatus === choice.value;
              return (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() => onSetStatus(selected ? null : choice.value)}
                  disabled={statusPending}
                  aria-pressed={selected}
                  className={cn(
                    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-3 text-[11px] font-semibold transition-colors active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {choice.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <AnimatedModal
        open={announcementOpen}
        onOpenChange={setAnnouncementOpen}
        title="Pinned Venture update"
        contentClassName="overflow-hidden"
        zIndex={70}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label-mono text-primary">Host control</p>
              <h2 className="mt-1 font-display text-xl font-bold">Pin one useful update</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Keep it focused on meeting, timing, or what to bring.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAnnouncementOpen(false)}
              aria-label="Close pinned update editor"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="mt-5 block">
            <span className="text-xs font-semibold">Pinned update</span>
            <textarea
              value={announcementDraft}
              onChange={(event) => setAnnouncementDraft(event.target.value.slice(0, 280))}
              rows={4}
              placeholder="Meet beside the front counter. I’ll be wearing a green jacket."
              className="mt-2 w-full resize-none rounded-2xl border border-border bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <span className="mt-1 block text-right text-[10px] text-muted-foreground">
              {announcementDraft.length}/280
            </span>
          </label>

          <div className="mt-4 flex gap-2">
            {coordination?.announcement && (
              <button
                type="button"
                onClick={() => {
                  onSaveAnnouncement(null);
                  setAnnouncementOpen(false);
                }}
                disabled={announcementPending}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-destructive/50 px-4 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const content = announcementDraft.trim();
                if (!content) return;
                onSaveAnnouncement(content);
                setAnnouncementOpen(false);
              }}
              disabled={!announcementDraft.trim() || announcementPending}
              className="min-h-11 flex-1 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            >
              Save update
            </button>
          </div>
        </div>
      </AnimatedModal>
    </section>
  );
}
