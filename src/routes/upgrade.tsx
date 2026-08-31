import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MONETIZATION_ENABLED } from "@/lib/feature-flags";
import { useState } from "react";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { LegalFooter } from "@/components/mutuals/LegalFooter";
import { BackButton } from "@/components/mutuals/Shared";

export const Route = createFileRoute("/upgrade")({
  // Same reasoning as /tiers — and this one previously mounted a card-entry
  // checkout, which is an automatic Apple 3.1.1 rejection.
  beforeLoad: () => {
    if (!MONETIZATION_ENABLED) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "MEUTUALS+ — Venture further — Your tribe is waiting" },
      { name: "description", content: "Upgrade to MEUTUALS+ for unlimited Ventures, unlimited Hellos, full match visibility, and read receipts." },
      { property: "og:title", content: "MEUTUALS+ — Venture further — Your tribe is waiting" },
      { property: "og:description", content: "Unlimited Ventures, unlimited Hellos, and read receipts." },
    ],
  }),
  component: UpgradePage,
});

function UpgradePage() {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const price = cycle === "monthly" ? "$6.99" : "$49.99";
  const sub = cycle === "monthly" ? "per month" : "per year · save 40%";

  return (
    <div className="bg-habitat min-h-screen pb-16">
      <div className="mx-auto max-w-md px-5 pt-6">
        <BackButton />

        <header className="mt-6 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <LightningIcon className="h-7 w-7" weight="fill" />
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight">
            <span className="text-primary">MEUTUALS+</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Venture further. Connect deeper.</p>
        </header>

        <div className="mx-auto mt-6 inline-flex w-full items-center justify-center gap-1 rounded-full border border-border bg-card p-1">
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold capitalize transition-colors ${
                cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {c}{c === "yearly" && " · save 40%"}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PlanCard
            title="Free"
            price="$0"
            sub="current plan"
            features={[
              "3 Ventures / month",
              "3 Hellos / month",
              "Standard discovery",
              "1 Tribe",
            ]}
          />
          <PlanCard
            title="MEUTUALS+"
            price={price}
            sub={sub}
            highlighted
            features={[
              "Unlimited Ventures",
              "Unlimited Hellos",
              "Full match visibility",
              "Read receipts in DMs",
              "MEUTUALS+ profile badge",
              "Early access to new Tribes",
              "Hide profile visits",
            ]}
          />
        </div>

        {/* TODO(billing): wire to StoreKit (iOS) / Play Billing (Android) / a hosted
            processor on web. Never an in-app card form — Apple 3.1.1. Entitlement
            must be granted server-side from the store webhook, since profiles.plan
            is not user-writable by design. */}
        <button
          disabled
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          <LightningIcon className="h-4 w-4" weight="fill" /> Coming soon
        </button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">MEUTUALS+ isn't available for purchase yet.</p>

        <div className="mt-8 text-center">
          <Link to="/tiers" className="text-xs text-primary hover:underline">Compare full subscription tiers →</Link>
        </div>
        <LegalFooter className="mt-6" />
      </div>
    </div>
  );
}

function PlanCard({
  title, price, sub, features, highlighted,
}: {
  title: string; price: string; sub: string; features: string[]; highlighted?: boolean;
}) {
  return (
    <div className={`relative rounded-2xl border bg-card p-5 ${highlighted ? "border-primary shadow-[0_0_0_1px_var(--primary)]" : "border-border"}`}>
      {highlighted && (
        <span className="label-mono absolute -top-2.5 right-4 rounded-full bg-primary px-2 py-0.5 text-primary-foreground">MOST POPULAR</span>
      )}
      <p className="label-mono text-muted-foreground">{title}</p>
      <p className="mt-1 font-display text-3xl font-bold">{price}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
      <ul className="mt-4 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs">
            <CheckIcon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${highlighted ? "text-primary" : "text-muted-foreground"}`} />
            <span className={highlighted ? "text-foreground" : "text-muted-foreground"}>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
