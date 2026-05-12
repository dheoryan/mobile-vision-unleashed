import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Heart, ShieldCheck, Lock, Sparkles, X } from "lucide-react";
import { LegalFooter } from "@/components/mutuals/LegalFooter";

export const Route = createFileRoute("/community-guidelines")({
  head: () => ({
    meta: [
      { title: "Community Guidelines — MUTUALS" },
      { name: "description", content: "How we keep MUTUALS warm, safe, and real." },
    ],
  }),
  component: GuidelinesPage,
});

const RULES = [
  { icon: Heart,       title: "Be real",   body: "No fake profiles. Use your real name, real photo, real city." },
  { icon: ShieldCheck, title: "Be kind",   body: "No harassment, hate speech, or discrimination of any kind." },
  { icon: Lock,        title: "Be safe",   body: "Don't share other people's personal info without their consent." },
  { icon: Sparkles,    title: "21 and up", body: "MUTUALS is for adults. Underage accounts will be removed." },
  { icon: X,           title: "Keep it clean", body: "No explicit, violent, or unlawful content." },
];

function GuidelinesPage() {
  return (
    <div className="bg-habitat min-h-screen pb-16">
      <div className="mx-auto max-w-2xl px-5 pt-6">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
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

        <LegalFooter className="mt-10" />
      </div>
    </div>
  );
}
