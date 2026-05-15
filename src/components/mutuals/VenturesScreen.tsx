import { useMemo, useState } from "react";
import { Zap, ArrowRight, ArrowLeft, X, Send, MapPin, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TRIBES, INTENTS, tribeById, type Person, type TribeId } from "@/lib/mutuals-data";
import { AppHeader, SectionTitle, TribeBadge } from "./Shared";
import { PlusBadge } from "./PlusBadge";
import { UpsellModal } from "./UpsellModal";
import { useBlocked } from "@/lib/blocked-store";
import { useAuth } from "@/lib/auth-context";
import { listVentureMatches, type VentureMatch } from "@/lib/profile.functions";
import { useThreads } from "@/lib/messages-store";
import { useLaunchVenture } from "@/lib/posts-store";
import type { Profile } from "./Onboarding";
import { cn } from "@/lib/utils";
import { MONETIZATION_ENABLED, showPlusBadge } from "@/lib/feature-flags";

type Stage = "landing" | "setup" | "active";

type RichPerson = Person & { allTribeIds: TribeId[] };

function rowToPerson(r: VentureMatch): RichPerson {
  const allTribeIds = (r.tribe_ids ?? []).filter(Boolean) as TribeId[];
  const tribeId = (allTribeIds[0] as TribeId | undefined) ?? "wolf";
  const avatar = r.avatar_url || r.avatar_emoji || "🙂";
  return {
    id: r.id,
    name: r.display_name?.trim() || "Someone",
    handle: r.handle ? `@${r.handle}` : "",
    avatar,
    tribeId,
    city: r.city || "",
    bio: r.bio || "",
    plus: showPlusBadge(r.plan),
    mutuals: 0,
    allTribeIds,
  };
}

export function VenturesScreen({
  profile,
  setProfile,
  onOpenMessages,
  onSendHello,
  onLaunchVenture,
  unread,
}: {
  profile: Profile;
  setProfile: (updater: (p: Profile | null) => Profile | null) => void;
  onOpenMessages: () => void;
  onSendHello: (person: Person, message: string) => void;
  onLaunchVenture: () => void;
  unread?: number;
}) {
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>("landing");
  const [step, setStep] = useState(0);
  const [intents, setIntents] = useState<string[]>([]);
  const [tribeFilter, setTribeFilter] = useState<"mine" | "all">("all");
  const [timeWindow, setTimeWindow] = useState("This week · evenings");
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [helloed, setHelloed] = useState<Set<string>>(new Set());
  const [paywall, setPaywall] = useState(false);
  const blocked = useBlocked();
  const threadsQuery = useThreads();
  const launchVentureMut = useLaunchVenture();

  // Cross-device "already said hello" — anyone I've already DMed shows up in threads.
  const persistedHelloed = useMemo(() => {
    const s = new Set<string>();
    for (const t of threadsQuery.data ?? []) s.add(t.other_id);
    return s;
  }, [threadsQuery.data]);

  const reset = () => { setStage("landing"); setStep(0); setIntents([]); setSkipped(new Set()); setHelloed(new Set()); };

  const persistAndGoLive = () => {
    launchVentureMut.mutate(
      { intents, scope: tribeFilter, time_window: timeWindow },
      {
        onSuccess: () => {
          onLaunchVenture();
          setStage("active");
        },
      },
    );
  };

  const tryGoLive = () => {
    if (MONETIZATION_ENABLED && profile.plan === "free" && profile.ventureCount >= 3) {
      setPaywall(true);
      return;
    }
    persistAndGoLive();
  };

  const handleUpgraded = () => {
    setProfile((p) => (p ? { ...p, plan: "plus" } : p));
    setPaywall(false);
    persistAndGoLive();
  };

  const matchesFn = useServerFn(listVentureMatches);
  const matchesQuery = useQuery({
    queryKey: ["ventures", "matches", tribeFilter, profile.tribeIds.join(","), user?.id ?? null],
    queryFn: () =>
      matchesFn({
        data: {
          scope: tribeFilter,
          tribe_ids: tribeFilter === "mine" ? profile.tribeIds : undefined,
        },
      }),
    enabled: stage === "active" && !!user,
    staleTime: 30_000,
  });

  // Deterministic shuffle keyed by timeWindow so the matches list visibly
  // reshuffles when the user picks a different time window.
  const seed = [...timeWindow].reduce((s, c) => (s * 31 + c.charCodeAt(0)) | 0, 7);
  const matches = useMemo<RichPerson[]>(() => {
    const rows = matchesQuery.data ?? [];
    return rows
      .map(rowToPerson)
      .filter((p) => !blocked.has(p.id))
      .filter((p) => !skipped.has(p.id) && !helloed.has(p.id) && !persistedHelloed.has(p.id))
      .map((p, i) => ({ p, k: ((i + 1) * 2654435761) ^ seed }))
      .sort((a, b) => a.k - b.k)
      .map(({ p }) => p);
  }, [matchesQuery.data, blocked, skipped, helloed, persistedHelloed, seed]);

  return (
    <div className="bg-habitat min-h-screen pb-28">
      <AppHeader
        title="Ventures"
        subtitle={stage === "active" ? "Live" : "Optional"}
        accent="var(--color-primary)"
        onOpenMessages={onOpenMessages}
        unread={unread}
      />
      <main className="mx-auto max-w-md px-5">
        {stage === "landing" && (
          <Landing onStart={() => { setStage("setup"); setStep(0); }} />
        )}

        {stage === "setup" && (
          <Setup
            step={step}
            setStep={setStep}
            intents={intents}
            setIntents={setIntents}
            tribeFilter={tribeFilter}
            setTribeFilter={setTribeFilter}
            timeWindow={timeWindow}
            setTimeWindow={setTimeWindow}
            onLaunch={tryGoLive}
            onCancel={reset}
            profile={profile}
          />
        )}

        {stage === "active" && (
          <Active
            intents={intents}
            matches={matches}
            isLoading={matchesQuery.isLoading}
            isError={matchesQuery.isError}
            onRetry={() => matchesQuery.refetch()}
            onSkip={(id) => setSkipped((s) => new Set(s).add(id))}
            onHello={(p) => {
              const msg = `Hey ${p.name.split(" ")[0]} — saw we're both up for ${intents[0] ?? "something this week"}. Want to make a plan?`;
              onSendHello(p, msg);
              setHelloed((s) => new Set(s).add(p.id));
            }}
            onExit={reset}
          />
        )}
      </main>
      <UpsellModal open={paywall} onClose={() => setPaywall(false)} used={profile.ventureCount} onUpgraded={handleUpgraded} />
    </div>
  );
}

function Landing({ onStart }: { onStart: () => void }) {
  return (
    <>
      <section className="relative mt-6 overflow-hidden rounded-3xl border border-border bg-card p-6 animate-rise">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/30 blur-3xl" />
        <div className="relative">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Zap className="h-6 w-6" />
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight">Ventures are optional.</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Enter only when you're ready to connect. Choose the kind of meetup, the people, and the time. No swiping. No matches unless you both say hello.
          </p>
        </div>
      </section>

      <SectionTitle title="How it works" />
      <ol className="space-y-2.5">
        {[
          ["Set your intent", "Coffee, drinks, a hike — what you're open to this week."],
          ["Choose your distance", "Just your Tribe, or open it up."],
          ["Send a Hello", "A short, real-life invitation. They reply, you make a plan."],
        ].map(([title, body], i) => (
          <li key={title} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <button
        onClick={onStart}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground"
      >
        Start a Venture <ArrowRight className="h-4 w-4" />
      </button>
    </>
  );
}

function Setup({
  step, setStep, intents, setIntents, tribeFilter, setTribeFilter, timeWindow, setTimeWindow, onLaunch, onCancel, profile,
}: {
  step: number; setStep: (n: number) => void;
  intents: string[]; setIntents: (v: string[]) => void;
  tribeFilter: "mine" | "all"; setTribeFilter: (v: "mine" | "all") => void;
  timeWindow: string; setTimeWindow: (v: string) => void;
  onLaunch: () => void; onCancel: () => void;
  profile: Profile;
}) {
  const myTribes = TRIBES.filter((t) => profile.tribeIds.includes(t.id));
  const multi = myTribes.length > 1;
  const mineTitle = multi ? "My Tribes" : "Just my Tribe";
  const mineBody = multi
    ? `Stay within your ${myTribes.length} home bases.`
    : "Stay close to your home base.";
  const canNext = step === 0 ? intents.length > 0 : true;
  const next = () => (step < 2 ? setStep(step + 1) : onLaunch());

  const toggleIntent = (i: string) =>
    setIntents(intents.includes(i) ? intents.filter((x) => x !== i) : [...intents, i]);

  return (
    <>
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {step === 0 ? "Cancel" : "Back"}
        </button>
        <p className="label-mono text-muted-foreground">Step {step + 1} of 3</p>
        <button onClick={onCancel} aria-label="Close" className="text-muted-foreground"><X className="h-4 w-4" /></button>
      </div>

      {step === 0 && (
        <section className="mt-4 animate-rise">
          <h2 className="font-display text-2xl font-bold leading-tight">What are you open to?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pick a few — the more honest, the better the matches.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {INTENTS.map((i) => {
              const on = intents.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleIntent(i)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"
                  )}
                >
                  {i}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="mt-4 animate-rise">
          <h2 className="font-display text-2xl font-bold leading-tight">Connect with people from…</h2>
          <p className="mt-1 text-sm text-muted-foreground">You can change this anytime.</p>
          <div className="mt-5 grid grid-cols-1 gap-3">
            {[
              { key: "mine", title: mineTitle, body: mineBody },
              { key: "all", title: "All Tribes", body: "Open it up to the whole habitat." },
            ].map((o) => {
              const on = tribeFilter === o.key;
              return (
                <button
                  key={o.key}
                  onClick={() => setTribeFilter(o.key as "mine" | "all")}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-colors",
                    on ? "border-primary bg-primary/10" : "border-border bg-card"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{o.title}</p>
                    {o.key === "mine" && multi && (
                      <span className="flex gap-0.5 text-base">
                        {myTribes.map((t) => <span key={t.id}>{t.emoji}</span>)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{o.body}</p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="mt-4 animate-rise">
          <h2 className="font-display text-2xl font-bold leading-tight">When are you open?</h2>
          <p className="mt-1 text-sm text-muted-foreground">A loose window works fine.</p>
          <div className="mt-5 grid grid-cols-1 gap-3">
            {["Tonight", "This week · evenings", "This weekend", "Next week"].map((opt) => {
              const on = timeWindow === opt;
              return (
                <button
                  key={opt}
                  onClick={() => setTimeWindow(opt)}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
                    on ? "border-primary bg-primary/10" : "border-border bg-card"
                  )}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <button
        onClick={next}
        disabled={!canNext}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
      >
        {step < 2 ? "Continue" : "Go live"} <ArrowRight className="h-4 w-4" />
      </button>
    </>
  );
}

function Active({
  intents, matches, isLoading, isError, onRetry, onSkip, onHello, onExit,
}: {
  intents: string[]; matches: RichPerson[];
  isLoading: boolean; isError: boolean; onRetry: () => void;
  onSkip: (id: string) => void; onHello: (p: RichPerson) => void; onExit: () => void;
}) {
  return (
    <>
      <section className="mt-4 flex items-center justify-between rounded-2xl border border-primary/40 bg-primary/10 p-4 animate-rise">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Zap className="h-5 w-5" />
            <span className="absolute inset-0 rounded-full bg-primary/30 animate-pulse-glow" />
          </span>
          <div>
            <p className="text-sm font-semibold">Your Venture is live</p>
            <p className="text-[11px] text-muted-foreground">{intents.slice(0, 3).join(" · ") || "Open to anything"}</p>
          </div>
        </div>
        <button onClick={onExit} className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground">
          End
        </button>
      </section>

      <SectionTitle title="People open to the same things" hint={isLoading ? "loading…" : `${matches.length} this window`} />

      {isLoading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Couldn't load matches.{" "}
          <button onClick={onRetry} className="font-semibold text-foreground underline">Retry</button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {matches.map((p, i) => (
            <MatchCard key={p.id} person={p} sharedIntents={intents.slice(0, 2)} delay={i * 60} onSkip={() => onSkip(p.id)} onHello={() => onHello(p)} />
          ))}
          {matches.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              That's everyone for this window. Open it up or check back soon.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function MatchCard({ person, sharedIntents, delay, onSkip, onHello }: { person: RichPerson; sharedIntents: string[]; delay: number; onSkip: () => void; onHello: () => void }) {
  const tribe = tribeById(person.tribeId);
  const isImg = person.avatar.startsWith("http") || person.avatar.startsWith("data:");
  const extraTribes = person.allTribeIds.slice(1).map(tribeById).filter(Boolean);
  const initial = (person.name?.[0] ?? "🙂").toUpperCase();
  return (
    <article className="rounded-2xl border border-border bg-card p-4 animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start gap-3">
        <span className="relative">
          <span
            className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full text-xl font-semibold text-foreground"
            style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 28%, transparent)` }}
          >
            {isImg ? (
              <img
                src={person.avatar}
                alt={person.name}
                className="h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : person.avatar?.length <= 4 ? person.avatar : initial}
          </span>
          {person.plus && <PlusBadge />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{person.name}</p>
            <TribeBadge name={tribe.name} color={tribe.colorVar} hosted={tribe.hosted} />
            {extraTribes.map((t) => (
              <TribeBadge key={t.id} name={t.name} color={t.colorVar} hosted={t.hosted} />
            ))}
            {person.plus && (
              <span className="label-mono rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-primary">Plus</span>
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" /> {person.city || "—"}
          </p>
          {person.bio && <p className="mt-1.5 line-clamp-3 text-xs text-muted-foreground">{person.bio}</p>}
        </div>
      </div>

      {sharedIntents.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sharedIntents.map((s) => (
            <span key={s} className="label-mono rounded-full bg-accent/15 px-2 py-1 text-accent">{s}</span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button onClick={onSkip} className="flex-1 rounded-2xl border border-border bg-background py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
          Skip
        </button>
        <button onClick={onHello} className="flex flex-[1.4] items-center justify-center gap-1.5 rounded-2xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground">
          <Send className="h-3.5 w-3.5" /> Send Hello
        </button>
      </div>
    </article>
  );
}
