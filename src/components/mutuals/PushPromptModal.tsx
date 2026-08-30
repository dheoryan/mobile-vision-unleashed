import { useEffect, useState } from "react";
import { Bell, ChevronDown, Download, Loader2, Plus, Share, Smartphone, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  getCurrentSubscriptionData,
  getPushAvailability,
  getPushPermission,
  isAndroid,
  isIosSafari,
  isStandalonePwa,
  subscribeToPush,
  withPushTimeout,
  type PushEnableStage,
} from "@/lib/push-subscribe";
import {
  canInstallNow,
  onInstallAvailabilityChange,
  triggerInstallPrompt,
} from "@/lib/install-prompt";
import { saveSubscription } from "@/lib/push.functions";
import {
  markEnabled,
  markShownThisSession,
  markSkipped,
  shouldShowPrompt,
} from "@/lib/push-prompt-state";
import {
  onPushPromptRequest,
  requestPushPrompt,
  type PushPromptTrigger,
} from "@/lib/push-prompt-events";
import { useProfileRow } from "@/lib/profile-store";

const COPY: Record<PushPromptTrigger, { title: string; body: string }> = {
  session: {
    title: "Don't miss a beat",
    body: "Get push notifications when someone likes, comments, follows, or DMs you — even when MEUTUALS is closed.",
  },
  dm: {
    title: "Get notified when they reply",
    body: "Turn on push notifications so you don't miss the next message — even when MEUTUALS is closed.",
  },
  post: {
    title: "See reactions in real time",
    body: "Turn on push notifications to know when people like or comment on your post.",
  },
  venture: {
    title: "Keep your Venture moving",
    body: "Turn on push notifications for join requests, acceptances, and party chat.",
  },
};

const SAVE_TIMEOUT_MS = 15_000;

const enableLabel = (stage: PushEnableStage | "saving" | null) => {
  if (stage === "permission") return "Waiting for permission…";
  if (stage === "service") return "Starting notifications…";
  if (stage === "subscription") return "Connecting device…";
  if (stage === "saving") return "Saving…";
  return "Enable notifications";
};

export function PushPromptModal() {
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<PushPromptTrigger>("session");
  const [busy, setBusy] = useState(false);
  const [enableStage, setEnableStage] = useState<PushEnableStage | "saving" | null>(null);
  const [installable, setInstallable] = useState(canInstallNow());
  const save = useServerFn(saveSubscription);
  const profileQuery = useProfileRow();
  const profileReady = !!(
    profileQuery.data?.adult_verified_at &&
    profileQuery.data.display_name &&
    profileQuery.data.tribe_ids?.length
  );

  useEffect(() => onInstallAvailabilityChange(setInstallable), []);

  // Subscribe to high-intent trigger requests.
  useEffect(() => {
    if (!user || !profileReady) return;
    const off = onPushPromptRequest((t) => {
      tryOpen(t);
    });
    return () => {
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profileReady]);

  // Session prompt on app open.
  useEffect(() => {
    if (authLoading || !user || !profileReady) return;
    const availability = getPushAvailability();
    if (availability === "unsupported" || availability === "blocked" || availability === "insecure")
      return;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (availability === "available") {
          const sub = await getCurrentSubscriptionData();
          if (sub) {
            try {
              await save({
                data: {
                  ...sub,
                  userAgent: navigator.userAgent.slice(0, 500),
                },
              });
              markEnabled(user.id);
              return;
            } catch {
              // Keep going to the visible retry path if server reconciliation
              // failed. The browser permission itself remains intact.
            }
          }
          const perm = getPushPermission();
          if (perm === "denied") return;
        }
        tryOpen("session");
      })();
    }, 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, profileReady]);

  function tryOpen(t: PushPromptTrigger) {
    if (!user || !profileReady) return;
    const availability = getPushAvailability();
    if (availability === "unsupported" || availability === "blocked" || availability === "insecure")
      return;
    if (!shouldShowPrompt(user.id, t)) return;
    setTrigger(t);
    setOpen(true);
    markShownThisSession();
  }

  const close = () => setOpen(false);

  const enable = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const sub = await subscribeToPush(setEnableStage);
      setEnableStage("saving");
      await withPushTimeout(
        save({
          data: {
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
            userAgent: navigator.userAgent.slice(0, 500),
          },
        }),
        SAVE_TIMEOUT_MS,
        "MEUTUALS could not save this device in time. Check your connection and try again.",
      );
      markEnabled(user.id);
      toast.success("Push notifications enabled.");
      setOpen(false);
    } catch (err) {
      toast.error("Could not enable push", { description: (err as Error).message });
    } finally {
      setEnableStage(null);
      setBusy(false);
    }
  };

  const skipSoft = () => {
    if (user) markSkipped(user.id, "soft");
    setOpen(false);
  };

  const skipHard = () => {
    if (user) markSkipped(user.id, "hard");
    setOpen(false);
  };

  const standalone = isStandalonePwa();
  const ios = isIosSafari();
  const android = isAndroid();
  const iosNeedsInstall = ios && !standalone;
  const androidCanInstall = android && !standalone;
  const copy = COPY[trigger];

  const iosSteps = [
    {
      icon: <Share className="h-4 w-4" />,
      text: "Open your browser's Share menu. In Safari, tap Share in the toolbar.",
    },
    { icon: <Plus className="h-4 w-4" />, text: 'Scroll and tap "Add to Home Screen".' },
    {
      icon: <Smartphone className="h-4 w-4" />,
      text: 'Tap "Add", then open MEUTUALS from your home screen.',
    },
    { icon: <Bell className="h-4 w-4" />, text: "Come back here and tap Enable notifications." },
  ];

  const androidSteps = [
    { icon: <Smartphone className="h-4 w-4" />, text: "Open Chrome's menu (⋮ in the top right)." },
    { icon: <Plus className="h-4 w-4" />, text: 'Tap "Install app" or "Add to Home screen".' },
    {
      icon: <Smartphone className="h-4 w-4" />,
      text: "Confirm, then open MEUTUALS from your home screen.",
    },
    { icon: <Bell className="h-4 w-4" />, text: "Tap Enable notifications when prompted." },
  ];

  return (
    <AnimatedModal
      open={open && !!user}
      onOpenChange={(o) => {
        if (!o) skipSoft();
      }}
      title="Push notifications"
      center
      zIndex={60}
      contentClassName="max-h-[90vh] overflow-y-auto scroll-panel p-6 shadow-2xl"
    >
      <button
        onClick={skipSoft}
        aria-label="Close"
        className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        {iosNeedsInstall ? <Smartphone className="h-6 w-6" /> : <Bell className="h-6 w-6" />}
      </div>
      <h2 className="mt-4 font-display text-lg font-bold text-foreground">
        {iosNeedsInstall ? "Get push notifications on iPhone or iPad" : copy.title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {iosNeedsInstall
          ? "On iOS or iPadOS 16.4 and later, push requires installing MEUTUALS to your home screen. Follow these steps:"
          : copy.body}
      </p>

      {iosNeedsInstall ? (
        <>
          <ol className="mt-4 space-y-2.5">
            {iosSteps.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="flex items-start gap-2 text-xs text-foreground">
                  <span className="mt-0.5 text-primary">{s.icon}</span>
                  <span>{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={skipSoft}
              className="rounded-full px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Got it
            </button>
          </div>
        </>
      ) : (
        <div className="mt-5 space-y-2">
          <button
            onClick={enable}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            <span aria-live="polite">{enableLabel(enableStage)}</span>
          </button>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={skipSoft}
              className="flex-1 rounded-2xl px-4 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Skip for now
            </button>
            <button
              onClick={skipHard}
              className="flex-1 rounded-2xl px-4 py-2.5 text-xs font-semibold text-muted-foreground/70 transition-colors hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Don't ask again
            </button>
          </div>

          {androidCanInstall && installable && (
            <button
              onClick={async () => {
                const outcome = await triggerInstallPrompt();
                if (outcome === "accepted") {
                  toast.success("MEUTUALS is installing — open it from your home screen.");
                  setOpen(false);
                } else if (outcome === "unavailable") {
                  toast.message("Install not available", {
                    description: "Use Chrome's menu → Install app instead.",
                  });
                }
              }}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Download className="h-4 w-4" />
              Install MEUTUALS on home screen
            </button>
          )}

          {androidCanInstall && !installable && (
            <details className="group mt-3 rounded-2xl border border-border/60 bg-secondary/30 p-3">
              <summary className="flex cursor-pointer items-center justify-between gap-2 text-xs font-semibold text-foreground">
                <span className="inline-flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  Install MEUTUALS on Android
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Optional — installing gives a fullscreen app and more reliable notifications.
              </p>
              <ol className="mt-2 space-y-2">
                {androidSteps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="flex items-start gap-2">
                      <span className="mt-0.5 text-primary">{s.icon}</span>
                      <span>{s.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </AnimatedModal>
  );
}

// Re-export so callers don't need to know the events module exists.
export { requestPushPrompt };
