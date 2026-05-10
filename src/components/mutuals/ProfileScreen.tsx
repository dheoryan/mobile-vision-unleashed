import { Settings, Edit3, Grid, Bookmark, Zap } from "lucide-react";
import { POSTS, tribeById, type TribeId } from "@/lib/mutuals-data";
import type { Profile } from "./Onboarding";
import { AppHeader, SectionTitle, TribeBadge } from "./Shared";

export function ProfileScreen({ profile, onOpenMessages, unread }: { profile: Profile; onOpenMessages: () => void; unread?: number }) {
  const tribe = tribeById(profile.tribeId);
  // sample post grid
  const myPosts = POSTS.slice(0, 6);

  return (
    <div className="bg-habitat min-h-screen pb-28">
      <AppHeader title="Profile" subtitle="You" accent={tribe.colorVar} onOpenMessages={onOpenMessages} unread={unread} />
      <main className="mx-auto max-w-md px-5">
        <section
          className="relative mt-4 overflow-hidden rounded-2xl border border-border p-5"
          style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${tribe.colorVar} 35%, var(--card)) 0%, var(--card) 100%)` }}
        >
          <button aria-label="Settings" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-background/40 text-muted-foreground hover:text-foreground">
            <Settings className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-4">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-card text-4xl ring-2" style={{ ["--tw-ring-color" as string]: tribe.colorVar }}>
              {profile.avatar}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-bold leading-tight">{profile.name || "You"}</h2>
              <p className="text-xs text-muted-foreground">{profile.city || "Somewhere"}</p>
              <div className="mt-2"><TribeBadge name={tribe.name} color={tribe.colorVar} /></div>
            </div>
          </div>
          {profile.bio && <p className="mt-4 text-sm text-muted-foreground">{profile.bio}</p>}

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Following" value="48" />
            <Stat label="Followers" value="62" />
            <Stat label="Ventures" value="7" />
          </div>

          <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background/40 py-2.5 text-xs font-semibold">
            <Edit3 className="h-3.5 w-3.5" /> Edit profile
          </button>
        </section>

        <SectionTitle
          title="Your posts"
          action={
            <div className="flex items-center gap-1 rounded-full bg-card p-1 text-muted-foreground">
              <button className="rounded-full bg-secondary px-2 py-1 text-foreground"><Grid className="h-3.5 w-3.5" /></button>
              <button className="px-2 py-1"><Bookmark className="h-3.5 w-3.5" /></button>
              <button className="px-2 py-1"><Zap className="h-3.5 w-3.5" /></button>
            </div>
          }
        />

        <div className="grid grid-cols-3 gap-1">
          {myPosts.map((p) => {
            const t = tribeById(p.tribeId as TribeId);
            return (
              <div
                key={p.id}
                className="aspect-square overflow-hidden rounded-md p-2 text-[10px] leading-tight text-foreground/90"
                style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${t.colorVar} 35%, var(--card)), var(--card))` }}
              >
                <span className="text-base">{p.image ?? "✦"}</span>
                <p className="mt-1 line-clamp-3">{p.content}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background/40 py-2.5">
      <p className="font-display text-lg font-bold">{value}</p>
      <p className="label-mono text-muted-foreground">{label}</p>
    </div>
  );
}
