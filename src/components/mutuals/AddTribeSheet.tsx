import { X, Check, LogOut } from "lucide-react";
import { toast } from "sonner";
import { TRIBES, type TribeId } from "@/lib/mutuals-data";
import { AnimatedModal } from "@/components/ui/animated-modal";
import type { Profile } from "./Onboarding";
import { TribeMark } from "./TribeMark";

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
  const remaining = TRIBES.filter((t) => !profile.tribeIds.includes(t.id));
  const joined = TRIBES.filter((t) => profile.tribeIds.includes(t.id));
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

  const leave = (tribeId: TribeId, tribeName: string) => {
    if (profile.tribeIds.length <= 1) {
      toast.error("Keep at least one home Tribe.");
      return;
    }
    setProfile?.((p) =>
      p ? { ...p, tribeIds: p.tribeIds.filter((id) => id !== tribeId) } : p,
    );
    toast.success(`Left ${tribeName}`);
  };

  return (
    <AnimatedModal
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      title="Manage Tribes"
      contentClassName="p-6"
    >
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-display text-xl font-bold">Manage Tribes</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          You're in {profile.tribeIds.length} of 3 Tribes.
        </p>

        <p className="label-mono mt-5 text-muted-foreground">Your Tribes</p>
        <ul className="mt-2 space-y-2">
          {joined.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background/40 p-3">
              <TribeMark tribe={t} size="sm" />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{t.name}</p>
              <button
                onClick={() => leave(t.id, t.name)}
                disabled={profile.tribeIds.length <= 1}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <LogOut className="h-3.5 w-3.5" /> Leave
              </button>
            </li>
          ))}
        </ul>

        <p className="label-mono mt-5 text-muted-foreground">Explore</p>

        {atMax || remaining.length === 0 ? (
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-dashed border-border bg-background/40 p-4 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-primary" /> You're at this account's 3-Tribe maximum. Leave one to switch.
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {remaining.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background/40 p-3">
                <TribeMark tribe={t} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{t.scene}</p>
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
    </AnimatedModal>
  );
}
