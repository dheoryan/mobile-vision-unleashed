import { MessageCircle } from "lucide-react";
import logoMark from "@/assets/logo-mark.webp";
import { NotificationBell } from "./NotificationBell";
import { TribeMark } from "./TribeMark";
import { tribeById, type Tribe, type TribeId } from "@/lib/mutuals-data";

export function AppHeader({
  title,
  subtitle,
  accent,
  onOpenMessages,
  unread,
}: {
  title: string;
  subtitle?: string;
  accent: string;
  onOpenMessages: () => void;
  unread?: number;
}) {
  return (
    <header className="glass sticky top-0 z-20 border-b border-border">
      <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2.5">
          <img
            src={logoMark}
            alt="MEUTUALS"
            className="h-9 w-9 rounded-xl object-cover"
            style={{ boxShadow: `0 0 0 1px color-mix(in oklab, ${accent} 35%, transparent)` }}
          />
          <div className="leading-tight">
            <p className="label-mono text-muted-foreground">{subtitle ?? "Meutuals"}</p>
            <p className="font-display text-sm font-semibold">{title}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenMessages}
            aria-label="Messages"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <MessageCircle className="h-5 w-5" />
            {unread ? (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unread}
              </span>
            ) : null}
          </button>
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}

export function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-end justify-between gap-3">
      <div>
        <h3 className="font-display text-lg font-bold">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * The Tribe pill.
 *
 * Carries the crest, not just the name. With one Tribe per person this pill is
 * the main place someone's Tribe is stated away from the Tribe screen itself,
 * and the crests are the thing people actually learn to recognise — a
 * lowercase-mono name alone made every Tribe look like the same pill in a
 * different colour.
 *
 * `tribe` may be the object or its id, matching TribeMark. The legacy
 * name/color pair is still accepted for the few call sites that only have
 * strings; those render without a crest rather than guessing one.
 */
export function TribeBadge({
  tribe,
  name,
  color,
  className = "",
}: {
  tribe?: Tribe | TribeId;
  name?: string;
  color?: string;
  className?: string;
}) {
  const resolved = typeof tribe === "string" ? tribeById(tribe) : tribe;
  const label = resolved?.name ?? name ?? "";
  const accent = resolved?.colorVar ?? color ?? "var(--color-primary)";

  return (
    <span
      className={`label-mono inline-flex items-center gap-1.5 rounded-full py-1 pr-2.5 ${resolved ? "pl-1" : "pl-2.5"} ${className}`}
      style={{ color: accent, backgroundColor: `color-mix(in oklab, ${accent} 16%, transparent)` }}
    >
      {resolved && <TribeMark tribe={resolved} size="xs" />}
      {label}
    </span>
  );
}
