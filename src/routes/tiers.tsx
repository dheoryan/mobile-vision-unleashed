import { createFileRoute, notFound } from "@tanstack/react-router";
import { MONETIZATION_ENABLED } from "@/lib/feature-flags";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { CompassIcon } from "@phosphor-icons/react/dist/csr/Compass";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { CrownIcon } from "@phosphor-icons/react/dist/csr/Crown";
import { BackButton } from "@/components/mutuals/Shared";

export const Route = createFileRoute("/tiers")({
  // Advertises paid plans. Unreachable while monetization is off — otherwise a
  // store reviewer can open a live pricing page for a product that can't bill.
  beforeLoad: () => {
    if (!MONETIZATION_ENABLED) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Subscription tiers — MEUTUALS — Your tribe is waiting" },
      { name: "description", content: "Explorer, Venturer, and Scene Maker tiers — pick the level of social ambition that fits you." },
      { property: "og:title", content: "Subscription tiers — MEUTUALS — Your tribe is waiting" },
      { property: "og:description", content: "Free, $9.99/mo, and $24.99/mo plans." },
    ],
  }),
  component: TiersPage,
});

function TiersPage() {
  return (
    <div className="bg-habitat min-h-screen pb-16">
      <div className="mx-auto max-w-3xl px-5 pt-6">
        <BackButton />

        <header className="mt-6 text-center">
          <p className="label-mono text-muted-foreground">Subscription tiers</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight">Most pay nothing. Some go deeper.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Three plans for three levels of social ambition.</p>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Tier
            icon={<CompassIcon className="h-5 w-5" />}
            name="Explorer"
            price="Free"
            features={["1 Tribe", "3 Ventures / month", "Standard discovery"]}
          />
          <Tier
            icon={<LightningIcon className="h-5 w-5" weight="fill" />}
            name="Venturer"
            price="$9.99/mo"
            highlighted
            features={[
              "2 Tribes",
              "Unlimited Ventures",
              "Priority match visibility",
              "Venture analytics (views)",
              "Recurring weekly windows",
              "Stealth mode in Discover",
            ]}
          />
          <Tier
            icon={<CrownIcon className="h-5 w-5" />}
            name="Scene Maker"
            price="$24.99/mo"
            features={[
              "All Tribes access",
              "Everything in Venturer",
              "Create private sub-Tribes",
              "Pin recurring event card",
              "Priority Discover placement",
              "Dedicated support",
            ]}
          />
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">Mock pricing for demonstration. No payment is processed.</p>
      </div>
    </div>
  );
}

function Tier({ icon, name, price, features, highlighted }: { icon: React.ReactNode; name: string; price: string; features: string[]; highlighted?: boolean }) {
  return (
    <div className={`relative rounded-2xl border bg-card p-5 ${highlighted ? "border-primary shadow-[0_0_0_1px_var(--primary)]" : "border-border"}`}>
      {highlighted && (
        <span className="label-mono absolute -top-2.5 right-4 rounded-full bg-primary px-2 py-0.5 text-primary-foreground">POPULAR</span>
      )}
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${highlighted ? "bg-primary/15 text-primary" : "bg-secondary text-foreground"}`}>
        {icon}
      </span>
      <p className="mt-3 font-display text-xl font-bold">{name}</p>
      <p className="mt-1 text-2xl font-bold">{price}</p>
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
