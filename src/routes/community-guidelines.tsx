import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { HeartIcon } from "@phosphor-icons/react/dist/csr/Heart";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { LockIcon } from "@phosphor-icons/react/dist/csr/Lock";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { LegalFooter } from "@/components/mutuals/LegalFooter";

export const Route = createFileRoute("/community-guidelines")({
  head: () => ({
    meta: [
      { title: "Community Guidelines — MEUTUALS — Your tribe is waiting" },
      { name: "description", content: "Five simple rules that keep MEUTUALS warm, safe, and real." },
      { property: "og:title", content: "Community Guidelines — MEUTUALS — Your tribe is waiting" },
      { property: "og:description", content: "Five simple rules that keep MEUTUALS warm, safe, and real." },
    ],
  }),
  component: GuidelinesPage,
});

const RULES = [
  { icon: HeartIcon,       title: "Be authentic", body: "No impersonating others, no fake personas designed to deceive. Your profile should represent who you actually are." },
  { icon: ShieldCheckIcon, title: "Be kind",      body: "No harassment, hate speech, or discrimination of any kind." },
  { icon: LockIcon,        title: "Be safe",      body: "Don't share other people's personal info without their consent." },
  { icon: SparkleIcon,     title: "21 and up",    body: "MEUTUALS is for adults. Underage accounts will be removed." },
  { icon: XIcon,           title: "Keep it clean", body: "No explicit, violent, or unlawful content." },
];

function GuidelinesPage() {
  return (
    <div className="bg-habitat min-h-screen pb-16">
      <div className="mx-auto max-w-2xl px-5 pt-6">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="h-3.5 w-3.5" /> Back
        </Link>
        <header className="mt-6 text-center">
          <p className="label-mono text-muted-foreground">Community</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight">Guidelines</h1>
          <p className="mt-2 text-sm text-muted-foreground">A small social contract. Five things, no fine print.</p>
        </header>

        <ul className="mt-8 space-y-3">
          {RULES.map((r) => (
            <li key={r.title} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <r.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-lg font-bold">{r.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Violations may result in account termination. Report anyone breaking these from their profile menu.
        </p>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Think we got it wrong? Appeal a decision by emailing{" "}
          <a className="text-primary hover:underline" href="mailto:appeals@mutuals.app">appeals@mutuals.app</a>{" "}
          with your account details and reason. We review all appeals within 5 business days.
        </p>

        <LegalFooter className="mt-10" />
      </div>
    </div>
  );
}
