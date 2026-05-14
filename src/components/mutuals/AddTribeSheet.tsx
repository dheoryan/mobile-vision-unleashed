import { X, Check } from "lucide-react";
import { toast } from "sonner";
import { TRIBES, type TribeId } from "@/lib/mutuals-data";
import type { Profile } from "./Onboarding";

export function AddTribeSheet({
  open,
  onClose,
  profile,
  setProfile,
  onJoined,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  setProfile?: (updater: (p: Profile | null) => Profile | null) => void;
  onJoined?: (tribeId: TribeId) => void;
}) {
  if (!open) return null;

  const remaining = TRIBES.filter((t) => !profile.tribeIds.includes(t.id));
  const atMax = profile.tribeIds.length >= 3;

  const join = (tribeId: TribeId, tribeName: string) => {
    if (atMax) {
      toast("You're at the maximum — 3 Tribes.", { description: "Leave one to join another." });
      return;
    }
    setProfile?.((p) => (p ? { ...p, tribeIds: [...p.tribeIds, tribeId] } : p));
    toast.success(`Welcome to ${tribeName}! 🎉`, {
      description: "Their feed and chat are now in your Tribe tab.",
    });
    onJoined?.(tribeId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto w-full max-w-md rounded-t-3xl border border-border bg-card p-6 sm:rounded-3xl animate-rise">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-display text-xl font-bold">Join another Tribe</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          You're in {profile.tribeIds.length} of 3 Tribes.
        </p>

        {atMax || remaining.length === 0 ? (
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-dashed border-border bg-background/40 p-4 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-primary" /> You're in 3 Tribes — the maximum for MUTUALS+.
          </div>
        ) : (
          <ul className="mt-5 space-y-2">
            {remaining.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background/40 p-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl"
                  style={{ backgroundColor: `color-mix(in oklab, ${t.colorVar} 28%, transparent)` }}
                >
                  {t.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{t.scene}</p>
                  <p className="text-[10px] text-muted-foreground">{t.members.toLocaleString()} members</p>
                </div>
                <button
                  onClick={() => join(t.id, t.name)}
                  className="shrink-0 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-background hover:bg-amber-300"
                >
                  Join
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
