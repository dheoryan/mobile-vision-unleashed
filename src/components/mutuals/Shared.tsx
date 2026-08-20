import { MessageCircle } from "lucide-react";
import logoMark from "@/assets/logo-mark.webp";
import { NotificationBell } from "./NotificationBell";

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

export function TribeBadge({ name, color, className = "" }: { name: string; color: string; className?: string }) {
  return (
    <span
      className={`label-mono inline-flex items-center gap-1 rounded-full px-2 py-1 ${className}`}
      style={{ color, backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)` }}
    >
      {name}
    </span>
  );
}
