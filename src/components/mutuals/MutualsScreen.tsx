import { useMemo, useState } from "react";
import { Bell, Search, Plus, MessageCircle, Sparkles } from "lucide-react";
import { TRIBES, POSTS, VENTURES, type TribeId, tribeById } from "@/lib/mutuals-data";
import { TribeSwitcher } from "./TribeSwitcher";
import { PostCard } from "./PostCard";
import { VentureCard } from "./VentureCard";
import type { TabKey } from "./BottomNav";

export function MutualsScreen({ tab }: { tab: TabKey }) {
  const [activeTribe, setActiveTribe] = useState<TribeId>("wolf");
  const tribe = tribeById(activeTribe);

  const tribePosts = useMemo(() => POSTS.filter(p => p.tribeId === activeTribe), [activeTribe]);
  const tribeVentures = useMemo(() => VENTURES.filter(v => v.tribeId === activeTribe), [activeTribe]);

  return (
    <div className="bg-habitat min-h-full pb-28">
      <Header tribeName={tab === "tribe" ? tribe.name : tabTitle(tab)} accent={tribe.colorVar} />

      <main className="mx-auto max-w-md px-5">
        {tab === "tribe" && (
          <>
            <div className="mt-2">
              <TribeSwitcher active={activeTribe} onChange={setActiveTribe} />
            </div>
            <TribeHero tribe={tribe} />
            <SectionTitle title="Tribe Timeline" hint="Following · within your scene" />
            <div className="flex flex-col gap-3">
              {tribePosts.map(p => <PostCard key={p.id} post={p} />)}
            </div>
            {tribeVentures.length > 0 && (
              <>
                <SectionTitle title="Ventures from your Tribe" hint="Optional · choose your distance" />
                <div className="flex flex-col gap-3">
                  {tribeVentures.slice(0, 1).map(v => <VentureCard key={v.id} venture={v} />)}
                </div>
              </>
            )}
          </>
        )}

        {tab === "timeline" && (
          <>
            <SearchBar />
            <SectionTitle title="Global Timeline" hint="Algorithmic discovery beyond your Tribe" />
            <div className="flex flex-col gap-3">
              {POSTS.map(p => <PostCard key={p.id} post={p} showTribe />)}
            </div>
          </>
        )}

        {tab === "ventures" && (
          <>
            <div className="mt-3 rounded-3xl border border-border bg-card/60 p-4">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Ventures</span>
              </div>
              <p className="mt-2 text-[15px] leading-snug text-foreground">
                Choose your distance. Cross from online to real life — only when you're ready.
              </p>
            </div>
            <SectionTitle title="Open this week" hint="Curated across your Tribes" />
            <div className="flex flex-col gap-3">
              {VENTURES.map(v => <VentureCard key={v.id} venture={v} />)}
            </div>
          </>
        )}

        {tab === "profile" && <ProfileScreen />}
      </main>

      {tab !== "profile" && <FAB tab={tab} accent={tribe.colorVar} />}
    </div>
  );
}

function tabTitle(t: TabKey) {
  if (t === "timeline") return "Discover";
  if (t === "ventures") return "Ventures";
  return "You";
}

function Header({ tribeName, accent }: { tribeName: string; accent: string }) {
  return (
    <header className="glass sticky top-0 z-20 border-b border-border">
      <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black"
            style={{ backgroundColor: accent, color: "var(--background)" }}
          >
            M
          </span>
          <div className="leading-tight">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Mutuals</p>
            <p className="text-sm font-semibold">{tribeName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn aria="Messages"><MessageCircle className="h-5 w-5" /></IconBtn>
          <IconBtn aria="Notifications">
            <span className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />
            </span>
          </IconBtn>
        </div>
      </div>
    </header>
  );
}

function IconBtn({ children, aria }: { children: React.ReactNode; aria: string }) {
  return (
    <button aria-label={aria} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
      {children}
    </button>
  );
}

function TribeHero({ tribe }: { tribe: ReturnType<typeof tribeById> }) {
  return (
    <section
      className="relative mt-4 overflow-hidden rounded-3xl border border-border p-5"
      style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${tribe.colorVar} 35%, var(--card)) 0%, var(--card) 75%)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full opacity-40 blur-3xl"
        style={{ backgroundColor: tribe.colorVar }}
      />
      <div className="relative flex items-start gap-4">
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl text-3xl"
          style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 30%, var(--card))` }}
        >
          {tribe.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: tribe.colorVar }}>Home base</p>
          <h2 className="text-2xl font-bold leading-tight">{tribe.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tribe.scene}</p>
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {tribe.online} online
            </span>
            <span>·</span>
            <span>{tribe.members.toLocaleString()} members</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-3 mt-6">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function SearchBar() {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input
        placeholder="Search Tribes, people, plans"
        className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
      />
    </div>
  );
}

function FAB({ tab, accent }: { tab: TabKey; accent: string }) {
  const label = tab === "ventures" ? "New Venture" : tab === "timeline" ? "Post" : "Share";
  return (
    <button
      className="fixed bottom-24 right-5 z-30 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/40 transition-transform active:scale-95"
      style={{ backgroundColor: accent }}
    >
      <Plus className="h-4 w-4" /> {label}
    </button>
  );
}

function ProfileScreen() {
  const myTribes = TRIBES.slice(0, 3);
  return (
    <>
      <section className="mt-4 rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/20 text-3xl">🌿</span>
          <div>
            <h2 className="text-xl font-bold">Alex Rivera</h2>
            <p className="text-xs text-muted-foreground">@alex · Joined this season</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Quiet mornings, loud weekends. Looking for a small running crew + a slow book club.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Tribes" value="3" />
          <Stat label="Ventures" value="7" />
          <Stat label="Real meets" value="12" />
        </div>
      </section>

      <SectionTitle title="Your Tribes" hint="Where you feel at home" />
      <div className="flex flex-col gap-3">
        {myTribes.map(t => (
          <div
            key={t.id}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl"
              style={{ backgroundColor: `color-mix(in oklab, ${t.colorVar} 25%, transparent)` }}
            >
              {t.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.scene}</p>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: t.colorVar, backgroundColor: `color-mix(in oklab, ${t.colorVar} 18%, transparent)` }}
            >
              Active
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary py-3">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
