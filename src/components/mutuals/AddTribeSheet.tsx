import { useEffect, useState } from "react";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { LockIcon } from "@phosphor-icons/react/dist/csr/Lock";
import { toast } from "sonner";
import { TRIBES, type TribeId } from "@/lib/mutuals-data";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { useSwitchTribe, useTribeSwitchStatus } from "@/lib/profile-store";
import type { Profile } from "./Onboarding";
import { TribeMark } from "./TribeMark";

/**
 * Tribe membership is exclusive — you belong to one Tribe and change it,
 * rather than collecting several. This sheet is therefore a *switch* flow, not
 * an add flow.
 *
 * Changing Tribe is rate-limited to once every 21 days, with an unlimited
 * grace window for the first week after signup (someone correcting an
 * onboarding mistake is not tribe-hopping). The remaining wait is shown up
 * front so the constraint is legible before the user commits to a choice,
 * rather than surfacing as an error after they tap.
 */
export function AddTribeSheet({
  open,
  onClose,
  profile,
  onJoined,
  initialTargetId,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  onJoined?: (tribeId: TribeId) => void;
  /** Skip the Tribe list and jump straight to the confirm step for this one
   *  — e.g. "Move here" from a Discover Tribe preview instead of Settings'
   *  full list. */
  initialTargetId?: TribeId;
}) {
  const [confirming, setConfirming] = useState<TribeId | null>(initialTargetId ?? null);
  const status = useTribeSwitchStatus();
  const switchTribe = useSwitchTribe();

  useEffect(() => {
    if (open) setConfirming(initialTargetId ?? null);
  }, [open, initialTargetId]);

  const currentId = profile.tribeIds[0];
  const current = TRIBES.find((t) => t.id === currentId);
  const others = TRIBES.filter((t) => t.id !== currentId);

  const locked = status.data ? !status.data.can_switch : false;
  const daysLeft = status.data?.days_remaining ?? 0;
  const target = confirming ? TRIBES.find((t) => t.id === confirming) : null;

  const commit = (tribeId: TribeId, tribeName: string) => {
    switchTribe.mutate(tribeId, {
      onSuccess: () => {
        toast.success(`You're now ${tribeName}`, {
          description: "Their feed and chat are your home. Your posts stay where you made them.",
        });
        setConfirming(null);
        onJoined?.(tribeId);
        onClose();
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const close = () => {
    if (switchTribe.isPending) return;
    setConfirming(null);
    onClose();
  };

  return (
    <AnimatedModal
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      title="Your Tribe"
      preventClose={switchTribe.isPending}
      contentClassName="p-6"
    >
      <button
        onClick={close}
        aria-label="Close"
        className="absolute right-4 top-4 rounded-full text-muted-foreground transition-colors hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <XIcon className="h-5 w-5" />
      </button>

      {target ? (
        <>
          <h2 className="font-display text-xl font-bold">Move to {target.name}?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You'll leave <span className="font-semibold text-foreground">{current?.name}</span> and
            lose access to its chat. Posts you made there stay there.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            You won't be able to change Tribe again for 21 days.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              disabled={switchTribe.isPending}
              onClick={() => commit(target.id, target.name)}
              style={{ backgroundColor: target.colorVar }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-primary-foreground transition-[filter] hover:brightness-110 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            >
              {switchTribe.isPending ? (
                <>
                  <SpinnerGapIcon className="h-4 w-4 animate-spin" /> Moving…
                </>
              ) : (
                `Yes, move to ${target.name}`
              )}
            </button>
            <button
              onClick={() => setConfirming(null)}
              disabled={switchTribe.isPending}
              className="w-full rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            >
              Stay in {current?.name}
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="font-display text-xl font-bold">Your Tribe</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            You belong to one Tribe at a time. It's your home feed, your chat, and how others see
            you.
          </p>

          {current && (
            <div
              className="mt-5 flex items-center gap-3 rounded-2xl border p-3"
              style={{
                borderColor: current.colorVar,
                background: `color-mix(in oklab, ${current.colorVar} 12%, transparent)`,
              }}
            >
              <TribeMark tribe={current} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{current.name}</p>
                <p className="truncate text-xs text-muted-foreground">{current.scene}</p>
              </div>
              <span className="label-mono shrink-0 text-muted-foreground">HOME</span>
            </div>
          )}

          {locked ? (
            <div className="mt-5 flex items-start gap-2 rounded-2xl border border-dashed border-border bg-background/40 p-4">
              <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">
                  You can change Tribe again in {daysLeft} {daysLeft === 1 ? "day" : "days"}.
                </p>
                <p className="mt-1">
                  Tribes are limited to one change every 21 days, so each one stays a real community
                  rather than a room people pass through.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="label-mono mt-5 text-muted-foreground">Move to another Tribe</p>
              <ul className="mt-2 space-y-2">
                {others.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-background/40 p-3"
                  >
                    <TribeMark tribe={t} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.scene}</p>
                    </div>
                    <button
                      onClick={() => setConfirming(t.id)}
                      className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Move
                    </button>
                  </li>
                ))}
              </ul>
              {status.data?.available_at === null && status.data.can_switch && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckIcon className="h-3.5 w-3.5 text-primary" /> You can change Tribe freely for
                  now.
                </p>
              )}
            </>
          )}
        </>
      )}
    </AnimatedModal>
  );
}
