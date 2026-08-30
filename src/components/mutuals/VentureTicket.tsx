import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Check,
  Clock,
  ExternalLink,
  Loader2,
  LogOut,
  Map,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { GOOGLE_PLACES_ENABLED } from "@/lib/feature-flags";
import type { VentureParty } from "@/lib/ventures.functions";
import { clock, durationMinutes, timingLabel, ventureTz } from "@/lib/venture-time";
import { cn } from "@/lib/utils";

/**
 * A Venture you hold.
 *
 * The board and the ticket are the same object in two states, and moving
 * between them is the product. On the board a Venture is a departure you might
 * catch — one of many, none of them yours. Once a host accepts you it becomes
 * something you have: your date, your time, your stub.
 *
 * The perforation is doing real work rather than decoration. A torn stub means
 * somebody tore it for you, which is the whole shape of this app — one Hello,
 * a "no" that is final, an address you do not see until you are let in. When
 * the private tier lands at step 5, the venue and map go on the back of this
 * same object, so being accepted reads as a thing you were handed rather than
 * a setting that changed.
 *
 * A pending ticket is the same shape without the stamp. That is deliberate:
 * waiting should feel like almost having, not like nothing.
 */

type Props = {
  venture: VentureParty;
  onOpenChat: () => void;
  /** Opens the back of the ticket. */
  onOpenDetail?: () => void;
  onLeave: (applicationId: string) => void;
  /** Only set on invites, which are the one state that needs an answer. */
  onAcceptInvite?: () => void;
  onDeclineInvite?: () => void;
  busy?: boolean;
};

export function VentureTicket({
  venture,
  onOpenChat,
  onOpenDetail,
  onLeave,
  onAcceptInvite,
  onDeclineInvite,
  busy = false,
}: Props) {
  const tz = ventureTz(venture);
  const status = venture.my_application?.status;
  const accepted = status === "accepted";
  const invited = status === "invited";

  const mins = durationMinutes(venture);
  const duration = mins ? (mins % 60 === 0 ? `${mins / 60}h` : `${mins}m`) : null;

  const stub = venture.starts_at ? stubParts(venture.starts_at, tz) : null;

  return (
    <article className="relative">
      {/* The notches. Positioned on the seam so the card reads as torn rather
          than as two boxes side by side. They are filled with the page
          background, which is why this needs the exact token and not a guess. */}
      {stub && (
        <>
          <span
            aria-hidden
            className="absolute -top-1.5 left-[4.5rem] z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-background"
          />
          <span
            aria-hidden
            className="absolute -bottom-1.5 left-[4.5rem] z-10 h-3 w-3 -translate-x-1/2 rounded-full bg-background"
          />
        </>
      )}

      <div
        className={cn(
          "grid overflow-hidden rounded-2xl border bg-card",
          stub ? "grid-cols-[4.5rem_1fr]" : "grid-cols-1",
          accepted ? "border-accent/60" : "border-border",
        )}
      >
        {/* The stub. Dropped entirely on a legacy Venture with no start time —
            a torn edge around an empty box is worse than no torn edge. */}
        {stub && (
          <div className="flex flex-col items-center justify-center gap-0.5 border-r border-dashed border-border py-4">
            <span className="label-mono text-muted-foreground">{stub.weekday}</span>
            <span className="font-mono text-[27px] font-bold leading-none tracking-tighter text-primary">
              {stub.day}
            </span>
            <span className="label-mono text-muted-foreground">{stub.month}</span>
            <span className="my-1.5 h-px w-6 bg-border" aria-hidden />
            <span className="font-mono text-[13px] font-bold">{stub.time}</span>
            {duration && (
              <span className="font-mono text-[9px] text-muted-foreground">{duration}</span>
            )}
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-1.5 p-3.5">
          {/* The title opens the back of the ticket. Everything a member needs
              to actually turn up lives there — until now an accepted member
              could see that they were in and nothing else about what they had
              joined. */}
          <button
            type="button"
            onClick={onOpenDetail}
            disabled={!onOpenDetail}
            className="rounded text-left text-[15px] font-bold leading-tight tracking-tight transition-opacity active:opacity-70 disabled:cursor-default disabled:active:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {venture.title}
          </button>

          {!stub && venture.time_window && (
            <p className="text-xs text-muted-foreground">{venture.time_window}</p>
          )}

          {venture.venue && (
            <p className="flex min-w-0 items-center gap-1 text-xs text-foreground/85">
              <span className="truncate">{venture.venue.host_label}</span>
              {venture.venue.google_place_id && (
                <BadgeCheck className="h-3 w-3 shrink-0 text-accent" aria-label="Verified place" />
              )}
            </p>
          )}

          <p className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
            <Users className="h-2.5 w-2.5" />
            {venture.filled_slots} of {venture.max_slots} going
          </p>

          <Stamp status={status} />

          {invited ? (
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={onDeclineInvite}
                disabled={busy}
                className="flex-1 rounded-xl border border-border py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                <X className="mr-1 inline h-3 w-3" /> Pass
              </button>
              <button
                type="button"
                onClick={onAcceptInvite}
                disabled={busy}
                className="inline-flex flex-[1.4] items-center justify-center gap-1 rounded-xl bg-primary py-2 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Accept
              </button>
            </div>
          ) : accepted ? (
            <button
              type="button"
              onClick={onOpenChat}
              className="mt-1.5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Open party chat
            </button>
          ) : (
            venture.my_application && (
              <button
                type="button"
                onClick={() => onLeave(venture.my_application!.id)}
                disabled={busy}
                className="mt-1 self-start rounded text-[11px] font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                Withdraw my request
              </button>
            )
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * The back of the ticket.
 *
 * An accepted member could see that they were in, and nothing whatsoever about
 * what they had joined — no host, no note, no idea who else was coming. The
 * host had a rich view of their own Venture the whole time; the people actually
 * attending had a stub and a chat button.
 *
 * This is the container the venue and the map drop into at step 5. Building it
 * now means the address reveal has somewhere to land that already makes sense.
 */
export function VentureTicketDetail({
  venture,
  open,
  onClose,
  onOpenChat,
  onLeave,
  leaving = false,
}: {
  venture: VentureParty | null;
  open: boolean;
  onClose: () => void;
  onOpenChat: () => void;
  onLeave: (applicationId: string) => void;
  leaving?: boolean;
}) {
  const [mapRequested, setMapRequested] = useState(false);

  useEffect(() => {
    setMapRequested(false);
  }, [open, venture?.id]);

  if (!venture) return null;

  const accepted = venture.my_application?.status === "accepted";
  const timing = timingLabel(venture);
  const host = venture.host;
  const placeId = GOOGLE_PLACES_ENABLED && accepted ? venture.venue?.google_place_id : null;
  const embedUrl = placeId ? googleMapsEmbedUrl(placeId) : null;
  const externalMapUrl = placeId ? googleMapsSearchUrl(placeId, venture.venue?.host_label) : null;

  // Only populated once the party-members read policy ships. Until then this
  // is legitimately empty for a member, so it renders a line saying so rather
  // than an empty box implying nobody is coming.
  const going = venture.applications.filter((a) => a.status === "accepted");

  return (
    <AnimatedModal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={venture.title}
      contentClassName="flex max-h-[86dvh] flex-col"
    >
      <div className="flex shrink-0 flex-col gap-3 px-5 pt-3">
        <span className="mx-auto h-1 w-9 rounded-full bg-secondary" aria-hidden />
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-extrabold leading-tight tracking-tight">{venture.title}</h2>
          {timing && (
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {timing}
            </p>
          )}
        </div>
      </div>

      <div className="scroll-panel min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-2 pt-4">
        {host && (
          <section className="space-y-2">
            <p className="label-mono text-muted-foreground">Hosted by</p>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm">
                {host.avatar_url ? (
                  <img src={host.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  host.avatar_emoji
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{host.display_name}</span>
                {host.city && (
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {host.city}
                  </span>
                )}
              </span>
            </div>
          </section>
        )}

        {venture.venue && (
          <section className="space-y-2">
            <p className="label-mono text-muted-foreground">Where</p>
            <div className="flex items-start gap-2.5 rounded-xl bg-secondary/40 p-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <span className="truncate">{venture.venue.host_label}</span>
                  {GOOGLE_PLACES_ENABLED && venture.venue.google_place_id && (
                    <BadgeCheck
                      className="h-3.5 w-3.5 shrink-0 text-accent"
                      aria-label="Verified place"
                    />
                  )}
                </p>
                {venture.venue.area && (
                  <p className="truncate text-[11px] text-muted-foreground">{venture.venue.area}</p>
                )}
                {accepted && venture.private_venue ? (
                  <div className="mt-3 border-t border-border/70 pt-3">
                    <p className="mb-1 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-accent">
                      <ShieldCheck className="h-3 w-3" /> Accepted members only
                    </p>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/85">
                      {venture.private_venue.arrival_details}
                    </p>
                  </div>
                ) : accepted ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    The host has not added private arrival details yet. Check the party chat before
                    leaving.
                  </p>
                ) : (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" /> Exact arrival details unlock after
                    acceptance.
                  </p>
                )}
              </div>
            </div>

            {accepted && externalMapUrl && (
              <div className="overflow-hidden rounded-xl border border-border bg-background">
                {mapRequested && embedUrl ? (
                  <iframe
                    title={`Map for ${venture.title}`}
                    src={embedUrl}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="aspect-[4/3] w-full border-0"
                    allowFullScreen
                  />
                ) : embedUrl ? (
                  <button
                    type="button"
                    onClick={() => setMapRequested(true)}
                    className="flex min-h-28 w-full flex-col items-center justify-center gap-2 px-5 py-4 text-center transition-colors hover:bg-secondary/30 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Map className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-semibold">Load the meeting map</span>
                    <span className="text-[10px] leading-relaxed text-muted-foreground">
                      Loads Google Maps only when you ask. Google receives your IP address.
                    </span>
                  </button>
                ) : (
                  <div className="flex min-h-24 flex-col items-center justify-center gap-2 px-5 py-4 text-center">
                    <Map className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">
                      Map preview is unavailable. Open the place in Maps instead.
                    </span>
                  </div>
                )}
                <a
                  href={externalMapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center justify-center gap-1.5 border-t border-border px-3 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  Open in Maps <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </section>
        )}

        {venture.note && (
          <section className="space-y-2">
            <p className="label-mono text-muted-foreground">From the host</p>
            <p className="rounded-xl bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
              {venture.note}
            </p>
          </section>
        )}

        <section className="space-y-2">
          <p className="label-mono text-muted-foreground">
            Who's going · {venture.filled_slots} of {venture.max_slots}
          </p>
          {going.length ? (
            <div className="flex flex-wrap gap-2">
              {going.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px]"
                >
                  <span className="text-xs">{a.applicant?.avatar_emoji ?? "•"}</span>
                  {a.applicant?.display_name ?? "Someone"}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {venture.filled_slots > 1
                ? `${venture.filled_slots - 1} other${venture.filled_slots > 2 ? "s" : ""} joined. Names show up in the party chat.`
                : "You're the first one in."}
            </p>
          )}
        </section>

        <section className="space-y-2">
          <p className="label-mono text-muted-foreground">Vibe</p>
          <div className="flex flex-wrap gap-1.5">
            {venture.intents.map((intent) => (
              <span
                key={intent}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                {intent}
              </span>
            ))}
          </div>
        </section>
      </div>

      <div className="shrink-0 space-y-2 border-t border-border/60 p-4">
        {accepted && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenChat();
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MessageCircle className="h-4 w-4" /> Open party chat
          </button>
        )}
        {venture.my_application && (
          <button
            type="button"
            onClick={() => onLeave(venture.my_application!.id)}
            disabled={leaving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-2.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            {leaving ? "Leaving…" : accepted ? "Leave this Venture" : "Withdraw my request"}
          </button>
        )}
      </div>
    </AnimatedModal>
  );
}

/**
 * The stamp is what makes a ticket a ticket. Pending gets the same frame in
 * muted tones rather than nothing at all — the shape says "almost", which is
 * exactly what waiting on a host is.
 */
function Stamp({ status }: { status?: string }) {
  const map: Record<string, { label: string; className: string; icon: boolean }> = {
    accepted: { label: "You're in", className: "border-accent text-accent", icon: true },
    invited: {
      label: "Invited — needs an answer",
      className: "border-primary text-primary",
      icon: false,
    },
    pending: {
      label: "Waiting on host",
      className: "border-border text-muted-foreground",
      icon: false,
    },
  };
  const stamp = status ? map[status] : undefined;
  if (!stamp) return null;

  return (
    <span
      className={cn(
        "mt-0.5 inline-flex w-fit items-center gap-1 rounded border px-1.5 py-0.5",
        "font-mono text-[9px] font-bold uppercase tracking-widest",
        stamp.className,
      )}
    >
      {stamp.icon && <BadgeCheck className="h-2.5 w-2.5" />}
      {stamp.label}
    </span>
  );
}

function stubParts(iso: string, tz: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const out: Record<string, string> = {};
  for (const p of f.formatToParts(d)) out[p.type] = p.value;
  return {
    weekday: (out.weekday ?? "").toUpperCase(),
    day: out.day ?? "",
    month: (out.month ?? "").toUpperCase().replace(".", ""),
    time: clock(iso, tz),
  };
}

function googleMapsEmbedUrl(placeId: string): string | null {
  const key = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY?.trim();
  if (!key) return null;
  const params = new URLSearchParams({ key, q: `place_id:${placeId}` });
  return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
}

function googleMapsSearchUrl(placeId: string, label?: string): string {
  const params = new URLSearchParams({
    api: "1",
    query: label?.trim() || "Meeting place",
    query_place_id: placeId,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}
