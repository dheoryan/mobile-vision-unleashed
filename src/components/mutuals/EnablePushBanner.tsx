import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, X, Smartphone, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  isStandalonePwa,
  isIosSafari,
  getPushAvailability,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscriptionData,
  withPushTimeout,
  type PushEnableStage,
  type PushPermission,
  type PushAvailability,
} from "@/lib/push-subscribe";
import { saveSubscription, deleteSubscription } from "@/lib/push.functions";

const DISMISS_KEY = "mutuals.push-banner.dismissed-session";
const SAVE_TIMEOUT_MS = 15_000;

type EnableProgress = PushEnableStage | "saving" | null;

const progressLabel = (progress: EnableProgress, fallback: string) => {
  if (progress === "permission") return "Waiting for permission…";
  if (progress === "service") return "Starting notifications…";
  if (progress === "subscription") return "Connecting device…";
  if (progress === "saving") return "Saving…";
  return fallback;
};

export function EnablePushBanner() {
  const [permission, setPermission] = useState<PushPermission>("unsupported");
  const [availability, setAvailability] = useState<PushAvailability>("unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<EnableProgress>(null);
  const save = useServerFn(saveSubscription);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    setAvailability(getPushAvailability());
    setPermission(getPushPermission());
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      /* ignore */
    }
    void getCurrentSubscriptionData().then(async (sub) => {
      if (!sub) return;
      try {
        await saveRef.current({
          data: { ...sub, userAgent: navigator.userAgent.slice(0, 500) },
        });
        setSubscribed(true);
      } catch {
        setSubscribed(false);
      }
    });
  }, []);

  const enable = async () => {
    setLoading(true);
    try {
      const sub = await subscribeToPush(setProgress);
      setProgress("saving");
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
      setSubscribed(true);
      setPermission("granted");
      toast.success("Push notifications enabled.");
    } catch (err) {
      toast.error("Could not enable push", { description: (err as Error).message });
    } finally {
      setProgress(null);
      setLoading(false);
    }
  };

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  if (availability === "needs-install") {
    if (dismissed) return null;
    return (
      <div className="mx-3 mt-3 flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 text-xs">
          <p className="font-semibold text-foreground">Get push notifications on iPhone</p>
          <p className="mt-1 text-muted-foreground">
            On iOS 16.4 or later, open Share → <b>Add to Home Screen</b>, then launch MEUTUALS from
            its new icon.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (availability === "unsupported" || availability === "insecure") return null;
  if (subscribed) return null;
  if (availability === "blocked" || permission === "denied") return null;
  if (dismissed) return null;

  return (
    <div className="mx-3 mt-3 flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-xs">
        <p className="font-semibold text-foreground">Don't miss a beat</p>
        <p className="mt-1 text-muted-foreground">
          Get push notifications when someone likes, comments, follows, or DMs you — even when
          MEUTUALS is closed.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={enable}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
            <span aria-live="polite">{progressLabel(progress, "Enable")}</span>
          </button>
          <button
            onClick={dismiss}
            className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function PushSettingsRow() {
  const [permission, setPermission] = useState<PushPermission>("unsupported");
  const [availability, setAvailability] = useState<PushAvailability>("unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<EnableProgress>(null);
  const save = useServerFn(saveSubscription);
  const remove = useServerFn(deleteSubscription);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    setAvailability(getPushAvailability());
    setPermission(getPushPermission());
    void getCurrentSubscriptionData().then(async (sub) => {
      if (!sub) return;
      try {
        await saveRef.current({
          data: { ...sub, userAgent: navigator.userAgent.slice(0, 500) },
        });
        setSubscribed(true);
      } catch {
        setSubscribed(false);
      }
    });
  }, []);

  if (availability === "needs-install") {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-3">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">Install to enable notifications</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              On iOS or iPadOS 16.4 and later, open Share → Add to Home Screen. Launch MEUTUALS from
              its new icon, then return here to enable push.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (availability === "unsupported") {
    return (
      <p className="rounded-xl border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
        Push notifications aren't supported on this device or browser.
      </p>
    );
  }

  if (availability === "insecure") {
    return (
      <p className="rounded-xl border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
        Push requires a secure HTTPS connection. Open the published MEUTUALS app to enable it.
      </p>
    );
  }

  const enable = async () => {
    if (isIosSafari() && !isStandalonePwa()) {
      toast.message("Install the app first", {
        description: "Tap Share → Add to Home Screen, then open MEUTUALS from the home screen.",
      });
      return;
    }
    setLoading(true);
    try {
      const sub = await subscribeToPush(setProgress);
      setProgress("saving");
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
      setSubscribed(true);
      setPermission("granted");
      toast.success("Push notifications enabled.");
    } catch (err) {
      toast.error("Could not enable push", { description: (err as Error).message });
    } finally {
      setProgress(null);
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) {
        try {
          await remove({ data: { endpoint } });
        } catch {
          /* ignore */
        }
      }
      setSubscribed(false);
      toast.success("Push notifications disabled on this device.");
    } catch (err) {
      toast.error("Could not disable", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Push notifications</p>
        <p className="text-[11px] text-muted-foreground">
          {subscribed
            ? "On for this device."
            : availability === "blocked" || permission === "denied"
              ? "Blocked. Enable them in your browser site settings."
              : "Off. Get notified when MEUTUALS is closed."}
        </p>
      </div>
      {subscribed ? (
        <button
          onClick={disable}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <BellOff className="h-3 w-3" />}
          Turn off
        </button>
      ) : (
        <button
          onClick={enable}
          disabled={loading || availability === "blocked" || permission === "denied"}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
          <span aria-live="polite">{progressLabel(progress, "Enable")}</span>
        </button>
      )}
    </div>
  );
}
