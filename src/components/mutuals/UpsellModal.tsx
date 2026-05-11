import { Zap, X } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function UpsellModal({
  open,
  onClose,
  used = 3,
}: {
  open: boolean;
  onClose: () => void;
  used?: number;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card p-6 animate-rise">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>

        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Zap className="h-6 w-6" fill="currentColor" />
        </span>

        <h2 className="mt-4 font-display text-2xl font-bold leading-tight">You've used your {used} free Ventures this month.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Upgrade to <span className="font-semibold text-primary">MUTUALS+</span> for unlimited Ventures, unlimited Hellos, full match visibility, and read receipts.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <Link
            to="/upgrade"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
          >
            Upgrade — $6.99/mo
          </Link>
          <button
            onClick={onClose}
            className="w-full rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
