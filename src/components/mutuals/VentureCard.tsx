import { MapPin, Clock, Users } from "lucide-react";
import type { Venture } from "@/lib/mutuals-data";
import { tribeById } from "@/lib/mutuals-data";

export function VentureCard({ venture }: { venture: Venture }) {
  const tribe = tribeById(venture.tribeId);
  const pct = Math.round((venture.taken / venture.spots) * 100);
  return (
    <article
      className="relative overflow-hidden rounded-3xl border border-border bg-card p-5"
      style={{ ["--tribe-active" as string]: tribe.colorVar }}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-30 blur-2xl"
        style={{ backgroundColor: tribe.colorVar }}
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              color: tribe.colorVar,
              backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 18%, transparent)`,
            }}
          >
            {tribe.name}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{venture.vibe}</span>
        </div>

        <h3 className="mt-3 text-xl font-semibold leading-tight">{venture.title}</h3>

        <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p className="flex items-center gap-2"><Clock className="h-4 w-4" /> {venture.when}</p>
          <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {venture.where}</p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-base">
            {venture.hostAvatar}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Hosted by <span className="text-foreground">{venture.host}</span></p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: tribe.colorVar }}
                />
              </div>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Users className="h-3 w-3" /> {venture.taken}/{venture.spots}
              </span>
            </div>
          </div>
        </div>

        <button
          className="mt-4 w-full rounded-2xl py-3 text-sm font-semibold text-primary-foreground transition-opacity active:opacity-80"
          style={{ backgroundColor: tribe.colorVar }}
        >
          Request to join
        </button>
      </div>
    </article>
  );
}
