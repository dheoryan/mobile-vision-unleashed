import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { TRIBES, type TribeId } from "@/lib/mutuals-data";
import { cn } from "@/lib/utils";

export function Onboarding({ onDone }: { onDone: (t: TribeId) => void }) {
  const [picked, setPicked] = useState<TribeId | null>(null);

  return (
    <div className="bg-habitat relative min-h-full overflow-hidden">
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent/40 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-14">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground">M</span>
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Mutuals</span>
        </div>

        <div className="mt-12">
          <h1 className="text-balance text-[40px] font-bold leading-[1.05] tracking-tight">
            Start with your <span className="text-primary">Tribe</span>.
            <br />
            Venture when you're ready.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            A new social layer for real-life meetups. Begin where you feel at home — explore beyond when it feels right.
          </p>
        </div>

        <div className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pick a home base</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {TRIBES.map((t) => {
              const active = picked === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setPicked(t.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-3xl border p-4 text-left transition-all",
                    active ? "border-transparent" : "border-border bg-card hover:bg-secondary"
                  )}
                  style={
                    active
                      ? {
                          background: `linear-gradient(135deg, color-mix(in oklab, ${t.colorVar} 40%, var(--card)) 0%, var(--card) 100%)`,
                          boxShadow: `0 0 0 2px ${t.colorVar}`,
                        }
                      : undefined
                  }
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-2xl text-xl"
                    style={{ backgroundColor: `color-mix(in oklab, ${t.colorVar} 30%, transparent)` }}
                  >
                    {t.emoji}
                  </span>
                  <p className="mt-3 text-sm font-semibold">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">{t.scene}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-auto pt-8">
          <button
            disabled={!picked}
            onClick={() => picked && onDone(picked)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
          >
            Enter your habitat <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            For socially curious adults, 21+
          </p>
        </div>
      </div>
    </div>
  );
}
