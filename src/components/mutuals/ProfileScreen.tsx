import { useState } from "react";
import { Settings, Edit3, Grid, Bookmark, Zap, Trash2, LogOut, X, Camera, Ban } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { POSTS, PEOPLE, tribeById, personById, type TribeId } from "@/lib/mutuals-data";
import type { Profile } from "./Onboarding";
import { AppHeader, SectionTitle, TribeBadge } from "./Shared";
import { PlusBadge } from "./PlusBadge";
import { LegalFooter } from "./LegalFooter";
import { DeleteAccountModal } from "./DeleteAccountModal";
import { useSocial } from "@/lib/social-store";
import { blockedStore, useBlocked } from "@/lib/blocked-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type GridTab = "posts" | "saved" | "ventures";

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
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gridTab, setGridTab] = useState<GridTab>("posts");
  const primaryId = profile.tribeIds[0];
  const tribe = tribeById(primaryId);
  const otherTribes = profile.tribeIds.slice(1).map((id) => tribeById(id));
  const isPlus = profile.plan === "plus";
  const social = useSocial();

  const myPosts = social.posts.filter((p) => p.authorId === "me");
  const samplePosts = POSTS.filter((p) => profile.tribeIds.includes(p.tribeId)).slice(0, 6);
  const postsToShow = myPosts.length ? myPosts : samplePosts;

  const savedPlaceholder = POSTS.slice(2, 5);

  return (
    <div className="bg-habitat min-h-screen pb-28">
      <AppHeader title="Profile" subtitle="You" accent={tribe.colorVar} onOpenMessages={onOpenMessages} unread={unread} />
      <main className="mx-auto max-w-md px-5">
        <section
          className="relative mt-4 overflow-hidden rounded-2xl border border-border p-5"
          style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${tribe.colorVar} 35%, var(--card)) 0%, var(--card) 100%)` }}
        >
          <button
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-background/40 text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-4">
            <span className="relative">
              <span
                className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-card text-4xl ring-2"
                style={{ ["--tw-ring-color" as string]: tribe.colorVar }}
              >
                {profile.avatar?.startsWith("data:") || profile.avatar?.startsWith("http") ? (
                  <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  profile.avatar
                )}
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
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <TribeBadge name={tribe.name} color={tribe.colorVar} hosted={tribe.hosted} />
                {otherTribes.map((t) => (
                  <span
                    key={t.id}
                    title={t.name}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-sm"
                    style={{ backgroundColor: `color-mix(in oklab, ${t.colorVar} 28%, transparent)` }}
                  >
                    {t.emoji}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {profile.bio && <p className="mt-4 text-sm text-muted-foreground">{profile.bio}</p>}

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Following" value={String(social.following.size)} />
            <Stat label="Followers" value="62" />
            <Stat label="Ventures" value={String(profile.ventureCount)} />
          </div>

          <button
            onClick={() => setEditOpen(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background/40 py-2.5 text-xs font-semibold hover:bg-background/60"
          >
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
              <p className="mt-1 text-xs text-muted-foreground">
                {isPlus ? (
                  <>
                    You're in <span className="text-foreground font-semibold">{profile.tribeIds.length}</span> of 3 Tribes.
                  </>
                ) : (
                  <>You're in 1 Tribe. Upgrade to join up to 3.</>
                )}
              </p>
            </div>
            {!isPlus && (
              <Link to="/upgrade" className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground">
                <Zap className="h-3.5 w-3.5" fill="currentColor" /> Upgrade
              </Link>
            )}
          </div>

          {setProfile && (
            <button
              onClick={() => setProfile((p) => p ? { ...p, plan: isPlus ? "free" : "plus", tribeIds: isPlus ? [p.tribeIds[0]] : Array.from(new Set([...p.tribeIds, "owl" as const])).slice(0, 3) } : p)}
              className="mt-3 w-full rounded-xl border border-dashed border-border py-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Demo: toggle plan to {isPlus ? "Free" : "Plus"}
            </button>
          )}
        </section>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link to="/tiers" className="rounded-2xl border border-border bg-card p-3 text-center text-xs font-semibold hover:bg-secondary">
            Compare tiers
          </Link>
          <Link to="/host" className="rounded-2xl border border-border bg-card p-3 text-center text-xs font-semibold hover:bg-secondary">
            Apply to host a Tribe
          </Link>
        </div>

        <SectionTitle
          title={gridTab === "posts" ? "Your posts" : gridTab === "saved" ? "Saved" : "Ventures"}
          action={
            <div className="flex items-center gap-1 rounded-full bg-card p-1 text-muted-foreground">
              <TabBtn active={gridTab === "posts"} onClick={() => setGridTab("posts")}><Grid className="h-3.5 w-3.5" /></TabBtn>
              <TabBtn active={gridTab === "saved"} onClick={() => setGridTab("saved")}><Bookmark className="h-3.5 w-3.5" /></TabBtn>
              <TabBtn active={gridTab === "ventures"} onClick={() => setGridTab("ventures")}><Zap className="h-3.5 w-3.5" /></TabBtn>
            </div>
          }
        />

        {gridTab === "posts" && (
          <div className="grid grid-cols-3 gap-1">
            {postsToShow.map((p) => {
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
            {postsToShow.length === 0 && (
              <p className="col-span-3 rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                You haven't posted yet.
              </p>
            )}
          </div>
        )}

        {gridTab === "saved" && (
          <div className="grid grid-cols-3 gap-1">
            {savedPlaceholder.map((p) => {
              const t = tribeById(p.tribeId as TribeId);
              return (
                <div
                  key={p.id}
                  className="aspect-square overflow-hidden rounded-md p-2 text-[10px] leading-tight text-foreground/90"
                  style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${t.colorVar} 35%, var(--card)), var(--card))` }}
                >
                  <span className="text-base">🔖</span>
                  <p className="mt-1 line-clamp-3">{p.content}</p>
                </div>
              );
            })}
          </div>
        )}

        {gridTab === "ventures" && (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm">
            {profile.ventureCount === 0 ? (
              <p className="text-muted-foreground">You haven't launched a Venture yet. Open the Ventures tab when you're ready to meet someone in person.</p>
            ) : (
              <p>
                You've launched <span className="font-semibold text-foreground">{profile.ventureCount}</span> {profile.ventureCount === 1 ? "Venture" : "Ventures"}{profile.plan === "free" ? ` · ${Math.max(0, 3 - profile.ventureCount)} free left this month.` : "."}
              </p>
            )}
          </div>
        )}

        <LegalFooter className="mt-6" />
      </main>

      <EditProfileModal
        open={editOpen}
        profile={profile}
        onClose={() => setEditOpen(false)}
        onSave={(patch) => {
          setProfile?.((p) => (p ? { ...p, ...patch } : p));
          setEditOpen(false);
          toast.success("Profile updated.");
        }}
      />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onLogout={() => {
          setSettingsOpen(false);
          setProfile?.(() => null);
          toast.success("Signed out.");
        }}
        onDelete={() => { setSettingsOpen(false); setDeleteOpen(true); }}
      />

      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => setProfile?.(() => null)}
      />
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn("rounded-full px-2 py-1 transition-colors", active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}
    >
      {children}
    </button>
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

const EMOJI_AVATARS = ["🌿", "🦊", "🐺", "🐟", "🎵", "🦉", "🐝", "🌙", "📚", "🏃", "🎸", "☕"];

function EditProfileModal({
  open, profile, onClose, onSave,
}: {
  open: boolean; profile: Profile; onClose: () => void;
  onSave: (patch: Partial<Profile>) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [city, setCity] = useState(profile.city);
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState(profile.avatar);

  if (!open) return null;

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image too large", { description: "Please pick an image under 2MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") setAvatar(result);
    };
    reader.readAsDataURL(file);
  };

  const isImage = avatar.startsWith("data:") || avatar.startsWith("http");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto w-full max-w-md rounded-t-3xl border border-border bg-card p-6 sm:rounded-3xl animate-rise">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-display text-xl font-bold">Edit profile</h2>

        <div className="mt-5 flex flex-col items-center">
          <label className="relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-background text-4xl">
            {isImage ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{avatar}</span>
            )}
            <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Camera className="h-4 w-4" />
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0])}
            />
          </label>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {EMOJI_AVATARS.map((e) => (
              <button
                key={e}
                onClick={() => setAvatar(e)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-lg transition",
                  avatar === e ? "bg-primary/20 ring-1 ring-primary" : "bg-secondary hover:bg-secondary/70"
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <Input label="Display name" value={name} onChange={setName} />
          <Input label="City" value={city} onChange={setCity} />
          <Input label="Bio" value={bio} onChange={(v) => setBio(v.slice(0, 140))} multiline hint={`${bio.length}/140`} />
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            disabled={!name.trim() || !city.trim()}
            onClick={() => onSave({ name: name.trim(), city: city.trim(), bio, avatar })}
            className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Save changes
          </button>
          <button onClick={onClose} className="w-full rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({
  label, value, onChange, multiline, hint,
}: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; hint?: string }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between">
        <span className="label-mono text-muted-foreground">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      )}
    </label>
  );
}

function SettingsSheet({
  open, onClose, onLogout, onDelete,
}: { open: boolean; onClose: () => void; onLogout: () => void; onDelete: () => void }) {
  const blocked = useBlocked();
  const blockedPeople = [...blocked].map((id) => PEOPLE.find((p) => p.id === id) ?? personById(id)).filter(Boolean);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto w-full max-w-md rounded-t-3xl border border-border bg-card p-6 sm:rounded-3xl animate-rise">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-display text-xl font-bold">Settings</h2>

        <div className="mt-5">
          <p className="label-mono text-muted-foreground">Blocked accounts</p>
          {blockedPeople.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              You haven't blocked anyone.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {blockedPeople.map((p) => p && (
                <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-lg">{p.avatar}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{p.handle}</p>
                  </div>
                  <button
                    onClick={() => { blockedStore.unblock(p.id); toast.success(`Unblocked ${p.name}.`); }}
                    className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <Ban className="h-3 w-3" /> Unblock
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-sm font-semibold hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
          <button
            onClick={onDelete}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 py-3 text-sm font-semibold text-destructive hover:bg-destructive/20"
          >
            <Trash2 className="h-4 w-4" /> Delete account
          </button>
        </div>
      </div>
    </div>
  );
}
