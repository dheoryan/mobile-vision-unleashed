import { useNavigate } from "@tanstack/react-router";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/csr/CaretLeft";
import logoMark from "@/assets/logo-mark.svg";
import { NotificationBell } from "./NotificationBell";
import { TribeMark } from "./TribeMark";
import { readableAccentColor, tribeById, type Tribe, type TribeId } from "@/lib/mutuals-data";

/**
 * The 44px circular back button used everywhere else in the app
 * (Notifications, post detail, profile, Settings) - standalone pages
 * (legal docs, upgrade, host application) had each grown their own smaller
 * inline "← Back" text link instead, a real tap-target and visual
 * inconsistency once you land on both kinds of page back to back.
 *
 * Actually goes back through browser history (same pattern as
 * `p.$postId.tsx`'s header) rather than a fixed `to` route - these pages
 * are reached from genuinely different places (Settings' Policies list,
 * the auth-screen footer, a shared link opened cold), and a hardcoded
 * destination is only ever right for one of them. `to` is purely the
 * fallback for when there's no history to return to at all.
 */
export function BackButton({ to = "/", label = "Back" }: { to?: string; label?: string }) {
  const navigate = useNavigate();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to });
  };
  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <CaretLeftIcon className="h-5 w-5" />
    </button>
  );
}

/**
 * The messages button used to live here because conversations had no tab —
 * every screen carried a shortcut into a panel that rendered its own thread
 * list. Chats is that list now, and a second entrance to it (a worse one, in
 * an overlay) is exactly the duplication this restructure is removing. The
 * panel survives, but only ever opens to a specific thread or party.
 */
export function AppHeader({
  title,
  subtitle,
  action,
  showNotifications = true,
}: {
  title: string;
  subtitle?: string;
  accent: string;
  action?: React.ReactNode;
  /** Profile is the one screen that drops the bell in favour of its own
   *  hamburger taking the edge slot. Every other screen keeps it - a
   *  hamburger and a bell both wanting the edge only comes up here. */
  showNotifications?: boolean;
}) {
  return (
    <header
      className="glass sticky top-0 z-20 border-b border-border pt-[env(safe-area-inset-top)]"
      style={{
        background: "color-mix(in oklab, var(--color-background) 56%, transparent)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
      }}
    >
      <div className="mx-auto grid max-w-md grid-cols-[1fr_auto_1fr] items-center px-5 py-3">
        <div className="min-w-0 justify-self-start leading-tight">
          <p className="label-mono truncate text-muted-foreground">{subtitle ?? "MEUTUALS"}</p>
          <p className="truncate font-display text-sm font-semibold">{title}</p>
        </div>
        <img src={logoMark} alt="MEUTUALS" className="h-9 w-9 object-contain" />
        <div className="flex items-center gap-1 justify-self-end">
          {action}
          {showNotifications && <NotificationBell />}
        </div>
      </div>
    </header>
  );
}

export function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
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
      style={{
        color: readableAccentColor(accent),
        backgroundColor: `color-mix(in oklab, ${accent} 16%, transparent)`,
      }}
    >
      {resolved && <TribeMark tribe={resolved} size="xs" />}
      {label}
    </span>
  );
}
