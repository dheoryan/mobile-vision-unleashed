import { useEffect, useState } from "react";
import { Bell, Loader2, Smartphone, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  getCurrentSubscription,
  getPushPermission,
  isIosSafari,
  isPushSupported,
  isStandalonePwa,
  subscribeToPush,
} from "@/lib/push-subscribe";
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

const COPY: Record<PushPromptTrigger, { title: string; body: string }> = {
  session: {
    title: "Don't miss a beat",
    body: "Get push notifications when someone likes, comments, follows, or DMs you — even when MUTUALS is closed.",
  },
  dm: {
    title: "Get notified when they reply",
    body: "Turn on push notifications so you don't miss the next message — even when MUTUALS is closed.",
  },
  post: {
    title: "See reactions in real time",
    body: "Turn on push notifications to know when people like or comment on your post.",
  },
};

export function PushPromptModal() {
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<PushPromptTrigger>("session");
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveSubscription);

  // Subscribe to high-intent trigger requests.
  useEffect(() => {
    if (!user) return;
    const off = onPushPromptRequest((t) => { tryOpen(t); });
    return () => { off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Session prompt on app open.
  useEffect(() => {
    if (authLoading || !user) return;
    if (!isPushSupported()) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        const sub = await getCurrentSubscription();
        if (sub) return;
        const perm = getPushPermission();
        if (perm === "denied") return;
        tryOpen("session");
      })();
    }, 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  function tryOpen(t: PushPromptTrigger) {
    if (!user) return;
    if (!isPushSupported()) return;
    if (getPushPermission() === "denied") return;
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
      const sub = await subscribeToPush();
      if (!sub) throw new Error("Could not subscribe.");
      await save({
        data: {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          userAgent: navigator.userAgent.slice(0, 500),
        },
      });
      markEnabled(user.id);
      toast.success("Push notifications enabled.");
      setOpen(false);
    } catch (err) {
      toast.error("Could not enable push", { description: (err as Error).message });
    } finally {
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

  if (!open || !user) return null;

  const iosNeedsInstall = isIosSafari() && !isStandalonePwa();
  const copy = COPY[trigger];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={skipSoft} />
      <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl animate-rise">
        <button
          onClick={skipSoft}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          {iosNeedsInstall ? <Smartphone className="h-6 w-6" /> : <Bell className="h-6 w-6" />}
        </div>
        <h2 className="mt-4 font-display text-lg font-bold text-foreground">
          {iosNeedsInstall ? "Get push notifications on iPhone" : copy.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {iosNeedsInstall
            ? "Tap Share → Add to Home Screen, then open MUTUALS from the home screen and enable notifications there."
            : copy.body}
        </p>

        {iosNeedsInstall ? (
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={skipSoft}
              className="rounded-full px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Got it
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            <button
              onClick={enable}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              Enable notifications
            </button>
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={skipSoft}
                className="flex-1 rounded-2xl px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </button>
              <button
                onClick={skipHard}
                className="flex-1 rounded-2xl px-4 py-2.5 text-xs font-semibold text-muted-foreground/70 hover:text-foreground"
              >
                Don't ask again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export so callers don't need to know the events module exists.
export { requestPushPrompt };
