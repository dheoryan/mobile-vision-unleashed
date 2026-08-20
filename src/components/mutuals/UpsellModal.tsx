import { Zap, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AnimatedModal } from "@/components/ui/animated-modal";

/**
 * MEUTUALS+ pitch.
 *
 * This deliberately does NOT collect payment details. It previously rendered a
 * card-number / expiry / CVC form prefilled with 4242 4242 4242 4242, behind a
 * "Pay $6.99" button that slept 1200ms and toasted success without charging or
 * granting anything. That was:
 *   - an automatic Apple 3.1.1 rejection (digital subscriptions must use IAP),
 *   - simulated functionality under Apple 2.3.1 / Google's misleading-claims policy,
 *   - and it trained users to type real card numbers into a form with no PCI path.
 *
 * When monetization is switched on, the CTA below should open StoreKit (iOS) /
 * Play Billing (Android) / a hosted processor checkout on web — never an
 * in-app card form. Entitlement must be granted server-side from the store
 * webhook, because `profiles.plan` is intentionally not user-writable
 * (see the prevent_plan_self_change trigger).
 */
export function UpsellModal({
  open, onClose, used = 3,
}: {
  open: boolean;
  onClose: () => void;
  used?: number;
}) {
  return (
    <AnimatedModal
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      title="MEUTUALS+ upgrade"
      contentClassName="p-6"
    >
      <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 text-muted-foreground hover:text-foreground">
        <X className="h-5 w-5" />
      </button>

      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Zap className="h-6 w-6" fill="currentColor" />
      </span>
      <h2 className="mt-4 font-display text-2xl font-bold leading-tight">
        You've used your {used} free Ventures this month.
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-semibold text-primary">MEUTUALS+</span> gives you unlimited
        Ventures, unlimited Hellos, full match visibility, and read receipts.
      </p>

      <div className="mt-5 flex flex-col gap-2">
        <Link
          to="/tiers"
          onClick={onClose}
          className="w-full rounded-2xl bg-primary py-3.5 text-center text-sm font-semibold text-primary-foreground"
        >
          See plans
        </Link>
        <button
          onClick={onClose}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Maybe later
        </button>
      </div>
    </AnimatedModal>
  );
}
