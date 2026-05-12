import { useState } from "react";
import { Settings, Edit3, Grid, Bookmark, Zap, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { POSTS, tribeById, type TribeId } from "@/lib/mutuals-data";
import type { Profile } from "./Onboarding";
import { AppHeader, SectionTitle, TribeBadge } from "./Shared";
import { PlusBadge } from "./PlusBadge";
import { LegalFooter } from "./LegalFooter";
import { DeleteAccountModal } from "./DeleteAccountModal";

export function ProfileScreen({
  profile,
  onOpenMessages,
  unread,
  setProfile,
}: {
  profile: Profile;
  onOpenMessages: () => void;
  unread?: number;
  setProfile?: (updater: (p: Profile | null) => Profile | null) => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const tribe = tribeById(profile.tribeId);
  const myPosts = POSTS.slice(0, 6);
  const isPlus = profile.plan === "plus";

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
            <span className="relative">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-card text-4xl ring-2" style={{ ["--tw-ring-color" as string]: tribe.colorVar }}>
                {profile.avatar}
              </span>
              {isPlus && <PlusBadge size="md" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-bold leading-tight">{profile.name || "You"}</h2>
                {isPlus && (
                  <span className="label-mono inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-primary">
                    <Zap className="h-3 w-3" fill="currentColor" /> PLUS
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{profile.city || "Somewhere"}</p>
              <div className="mt-2"><TribeBadge name={tribe.name} color={tribe.colorVar} hosted={tribe.hosted} /></div>
            </div>
          </div>
          {profile.bio && <p className="mt-4 text-sm text-muted-foreground">{profile.bio}</p>}

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Following" value="48" />
            <Stat label="Followers" value="62" />
            <Stat label="Ventures" value={String(profile.ventureCount)} />
          </div>

          <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background/40 py-2.5 text-xs font-semibold">
            <Edit3 className="h-3.5 w-3.5" /> Edit profile
          </button>
        </section>

        {/* Plan / Upgrade card */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="label-mono text-muted-foreground">Plan</p>
              <p className="font-display text-lg font-bold">
                {isPlus ? (<><span className="text-primary">MUTUALS+</span></>) : "Free"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isPlus
                  ? "Unlimited Ventures, unlimited Hellos, full match visibility."
                  : `${Math.max(0, 3 - profile.ventureCount)} of 3 free Ventures left this month.`}
              </p>
            </div>
            {!isPlus && (
              <Link to="/upgrade" className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground">
                <Zap className="h-3.5 w-3.5" fill="currentColor" /> Upgrade
              </Link>
            )}
          </div>

          {/* Demo toggle */}
          {setProfile && (
            <button
              onClick={() => setProfile((p) => (p ? { ...p, plan: isPlus ? "free" : "plus" } : p))}
              className="mt-3 w-full rounded-xl border border-dashed border-border py-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Demo: toggle plan to {isPlus ? "Free" : "Plus"}
            </button>
          )}
        </section>

        {/* Quick links */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link to="/tiers" className="rounded-2xl border border-border bg-card p-3 text-center text-xs font-semibold hover:bg-secondary">
            Compare tiers
          </Link>
          <Link to="/host" className="rounded-2xl border border-border bg-card p-3 text-center text-xs font-semibold hover:bg-secondary">
            Apply to host a Tribe
          </Link>
        </div>

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

        <div className="mt-8 rounded-2xl border border-border bg-card p-4">
          <p className="label-mono text-muted-foreground">Account</p>
          <button
            onClick={() => setDeleteOpen(true)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 py-2.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete account
          </button>
        </div>

        <LegalFooter className="mt-6" />
      </main>

      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => setProfile?.(() => null)}
      />
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
