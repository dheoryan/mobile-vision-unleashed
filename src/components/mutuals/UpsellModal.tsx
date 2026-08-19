import { useState } from "react";
import { Zap, X, CreditCard, Loader2, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

type Step = "offer" | "checkout" | "processing" | "success";

export function UpsellModal({
  open, onClose, used = 3, onUpgraded, initialStep = "offer",
}: {
  open: boolean;
  onClose: () => void;
  used?: number;
  onUpgraded?: () => void;
  /** Skip straight to a later step — e.g. "checkout" when opened from a direct "Upgrade" CTA that already made the pitch. */
  initialStep?: Step;
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [exp, setExp] = useState("12/29");
  const [cvc, setCvc] = useState("123");

  if (!open) return null;

  const close = () => { onClose(); setTimeout(() => setStep("offer"), 250); };

  const pay = async () => {
    setStep("processing");
    await new Promise((r) => setTimeout(r, 1200));
    setStep("success");
    toast.success("Welcome to MEUTUALS+ ⚡", { description: "Unlimited Ventures unlocked." });
    setTimeout(() => {
      onUpgraded?.();
      close();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={step === "processing" ? undefined : close} />
      <div className="relative mx-auto w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card p-6 animate-rise">
        {step !== "processing" && (
          <button onClick={close} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        )}

        {step === "offer" && (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Zap className="h-6 w-6" fill="currentColor" />
            </span>
            <h2 className="mt-4 font-display text-2xl font-bold leading-tight">You've used your {used} free Ventures this month.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Upgrade to <span className="font-semibold text-primary">MEUTUALS+</span> for unlimited Ventures, unlimited Hellos, full match visibility, and read receipts.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => setStep("checkout")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
              >
                <Zap className="h-4 w-4" fill="currentColor" /> Upgrade — $6.99/mo
              </button>
              <Link
                to="/tiers"
                onClick={close}
                className="w-full rounded-2xl border border-border bg-background py-3 text-center text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                Compare tiers
              </Link>
              <button
                onClick={close}
                className="w-full py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Maybe later
              </button>
            </div>
          </>
        )}

        {step === "checkout" && (
          <>
            <p className="label-mono text-muted-foreground">Checkout · MEUTUALS+</p>
            <h2 className="font-display text-2xl font-bold">$6.99 / month</h2>
            <p className="mt-1 text-xs text-muted-foreground">Cancel anytime. No real charges in this demo.</p>

            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="label-mono text-muted-foreground">Card number</span>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <input
                    inputMode="numeric"
                    value={card}
                    onChange={(e) => setCard(e.target.value)}
                    className="w-full bg-transparent text-sm focus:outline-none"
                  />
                </div>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="label-mono text-muted-foreground">Expiry</span>
                  <input value={exp} onChange={(e) => setExp(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none" />
                </label>
                <label className="block">
                  <span className="label-mono text-muted-foreground">CVC</span>
                  <input value={cvc} onChange={(e) => setCvc(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none" />
                </label>
              </div>
            </div>

            <button
              onClick={pay}
              disabled={!card.trim() || !exp.trim() || !cvc.trim()}
              className="mt-5 w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              Pay $6.99
            </button>
            <button onClick={() => setStep("offer")} className="mt-2 w-full py-2 text-xs text-muted-foreground hover:text-foreground">Back</button>
          </>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center py-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 font-display text-lg font-bold">Processing payment…</p>
            <p className="text-xs text-muted-foreground">Hang tight.</p>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-7 w-7" />
            </span>
            <p className="mt-4 font-display text-xl font-bold">You're MEUTUALS+ ⚡</p>
            <p className="mt-1 text-xs text-muted-foreground">Resuming your Venture…</p>
          </div>
        )}
      </div>
    </div>
  );
}
