import { useEffect, useState } from "react";
import { Bell, BellOff, X, Smartphone, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  isPushSupported,
  isStandalonePwa,
  isIosSafari,
  isIosThirdPartyBrowser,
  getPushBlocker,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
  type PushPermission,
} from "@/lib/push-subscribe";
import { saveSubscription, deleteSubscription } from "@/lib/push.functions";

const DISMISS_KEY = "mutuals.push-banner.dismissed-session";

export function EnablePushBanner() {
  const [permission, setPermission] = useState<PushPermission>("unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const save = useServerFn(saveSubscription);

  useEffect(() => {
    setPermission(getPushPermission());
    try { setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1"); } catch { /* ignore */ }
    getCurrentSubscription().then((s) => setSubscribed(!!s));
  }, []);

  const enable = async () => {
    setLoading(true);
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
      setSubscribed(true);
      setPermission("granted");
      toast.success("Push notifications enabled.");
    } catch (err) {
      toast.error("Could not enable push", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  };

  const blocker = getPushBlocker();
  if (blocker === "unsupported") return null;
  if (subscribed) return null;
  if (permission === "denied") return null;
  if (dismissed) return null;

  // iOS Safari: must install PWA first.
  if (blocker === "needs-install") {
    return (
      <div className="mx-3 mt-3 flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 text-xs">
          <p className="font-semibold text-foreground">Get push notifications on iPhone</p>
          <p className="mt-1 text-muted-foreground">
            {isIosThirdPartyBrowser() ? "Open MEUTUALS in Safari, then tap " : "Tap "}Share → <b>Add to Home Screen</b>, then open MEUTUALS from the home screen and enable notifications there.
          </p>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-3 mt-3 flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-xs">
        <p className="font-semibold text-foreground">Don't miss a beat</p>
        <p className="mt-1 text-muted-foreground">
          Get push notifications when someone likes, comments, follows, or DMs you — even when MEUTUALS is closed.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={enable}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
            Enable
          </button>
          <button onClick={dismiss} className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
            Not now
          </button>
        </div>
      </div>
      <button onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function PushSettingsRow() {
  const [permission, setPermission] = useState<PushPermission>("unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const save = useServerFn(saveSubscription);
  const remove = useServerFn(deleteSubscription);

  useEffect(() => {
    setPermission(getPushPermission());
    getCurrentSubscription().then((s) => setSubscribed(!!s));
  }, []);

  const blocker = getPushBlocker();

  if (blocker === "needs-install") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
        <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 text-[11px]">
          <p className="text-sm font-semibold text-foreground">Push notifications</p>
          <p className="mt-1 text-muted-foreground">
            iPhone and iPad only allow notifications for installed apps.{" "}
            {isIosThirdPartyBrowser() ? "Open MEUTUALS in Safari, then tap " : "Tap "}
            Share → <b>Add to Home Screen</b>, open MEUTUALS from the home screen, and enable them
            there.
          </p>
        </div>
      </div>
    );
  }

  if (blocker === "unsupported") {
    return (
      <p className="rounded-xl border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
        Push notifications aren't supported on this device or browser.
      </p>
    );
  }

  const enable = async () => {
    setLoading(true);
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
      setSubscribed(true);
      setPermission("granted");
      toast.success("Push notifications enabled.");
    } catch (err) {
      toast.error("Could not enable push", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) {
        try { await remove({ data: { endpoint } }); } catch { /* ignore */ }
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
            : permission === "denied"
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
          disabled={loading || permission === "denied"}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
          Enable
        </button>
      )}
    </div>
  );
}
