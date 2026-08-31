import { useEffect, useRef, useState, type ReactNode } from "react";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { BellIcon } from "@phosphor-icons/react/dist/csr/Bell";
import { BellSlashIcon } from "@phosphor-icons/react/dist/csr/BellSlash";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { DeviceMobileIcon } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  isStandalonePwa,
  isIosSafari,
  isAndroid,
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
import { Switch } from "@/components/ui/switch";

const DISMISS_KEY = "mutuals.push-banner.dismissed-session";
const DEVICE_DISABLED_KEY = "mutuals.push.device-disabled";
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
        <DeviceMobileIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
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
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <XIcon className="h-4 w-4" />
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
      <BellIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
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
            className="inline-flex items-center gap-1.5 rounded-full bg-meutuals-gradient px-3 py-1.5 text-[11px] font-semibold text-white transition-[filter] hover:brightness-110 active:scale-95 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
          >
            {loading ? (
              <SpinnerGapIcon className="h-3 w-3 animate-spin" />
            ) : (
              <BellIcon className="h-3 w-3" />
            )}
            <span aria-live="polite">{progressLabel(progress, "Enable")}</span>
          </button>
          <button
            onClick={dismiss}
            className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="rounded-full text-muted-foreground transition-colors hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export function PushSettingsRow() {
  const [permission, setPermission] = useState<PushPermission>("unsupported");
  const [availability, setAvailability] = useState<PushAvailability | null>(null);
  const [status, setStatus] = useState<"checking" | "off" | "active" | "success" | "repair">(
    "checking",
  );
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<EnableProgress>(null);
  const save = useServerFn(saveSubscription);
  const remove = useServerFn(deleteSubscription);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    let cancelled = false;

    const reconcile = async () => {
      const nextAvailability = getPushAvailability();
      const nextPermission = getPushPermission();
      setAvailability(nextAvailability);
      setPermission(nextPermission);

      if (nextAvailability !== "available" || nextPermission === "denied") {
        setStatus("off");
        return;
      }

      const sub = await getCurrentSubscriptionData();
      if (cancelled) return;
      if (!sub) {
        let intentionallyDisabled = false;
        try {
          intentionallyDisabled = localStorage.getItem(DEVICE_DISABLED_KEY) === "1";
        } catch {
          /* ignore */
        }
        setStatus(nextPermission === "granted" && !intentionallyDisabled ? "repair" : "off");
        return;
      }

      try {
        await saveRef.current({
          data: { ...sub, userAgent: navigator.userAgent.slice(0, 500) },
        });
        if (cancelled) return;
        try {
          localStorage.removeItem(DEVICE_DISABLED_KEY);
        } catch {
          /* ignore */
        }
        setStatus("active");
      } catch {
        if (!cancelled) setStatus("repair");
      }
    };

    void reconcile();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== "success") return;
    const timer = window.setTimeout(() => setStatus("active"), 2200);
    return () => window.clearTimeout(timer);
  }, [status]);

  const deviceLabel = isIosSafari()
    ? "this iPhone or iPad"
    : isAndroid()
      ? "this Android device"
      : "this browser";

  if (availability === "needs-install") {
    return (
      <div className="overflow-hidden rounded-2xl border border-primary/30 bg-background">
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <DeviceMobileIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-semibold">Install to turn on notifications</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Add MEUTUALS to your Home Screen, open it from the new icon, then return here.
            </p>
          </div>
        </div>
        <p className="border-t border-border px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
          On iPhone or iPad: tap Share → Add to Home Screen.
        </p>
      </div>
    );
  }

  if (availability === "unsupported") {
    return (
      <NotificationStateCard
        icon={<BellSlashIcon className="h-5 w-5" />}
        title="Notifications unavailable"
        detail="This device or browser does not support web notifications."
      />
    );
  }

  if (availability === "insecure") {
    return (
      <NotificationStateCard
        icon={<WarningIcon className="h-5 w-5" />}
        title="Open the secure MEUTUALS app"
        detail="Notifications can only be connected from the published HTTPS app."
        tone="warning"
      />
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
    setStatus("checking");
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
      try {
        localStorage.removeItem(DEVICE_DISABLED_KEY);
      } catch {
        /* ignore */
      }
      setPermission("granted");
      setAvailability(getPushAvailability());
      setStatus("success");
    } catch {
      const nextPermission = getPushPermission();
      setPermission(nextPermission);
      setAvailability(getPushAvailability());
      setStatus(nextPermission === "denied" ? "off" : "repair");
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
      try {
        localStorage.setItem(DEVICE_DISABLED_KEY, "1");
      } catch {
        /* ignore */
      }
      setStatus("off");
    } catch (err) {
      toast.error("Could not disable", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const blocked = availability === "blocked" || permission === "denied";
  const connecting = loading || status === "checking";

  if (blocked) {
    return (
      <div className="overflow-hidden rounded-2xl border border-destructive/30 bg-background">
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <BellSlashIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-semibold">Notifications are blocked</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Allow notifications for MEUTUALS in your device or browser settings.
            </p>
          </div>
        </div>
        <details className="group border-t border-border px-4 py-3">
          <summary className="cursor-pointer list-none text-xs font-semibold text-primary">
            How to unblock notifications
          </summary>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Open this app’s notification permissions, choose Allow, then return here and try again.
          </p>
        </details>
      </div>
    );
  }

  if (status === "success") {
    return (
      <NotificationStateCard
        icon={<CheckIcon className="h-5 w-5" />}
        title="Notifications are on"
        detail="You’ll hear about important activity while MEUTUALS is closed."
        tone="success"
        live
      />
    );
  }

  if (status === "repair" && !connecting) {
    return (
      <div className="overflow-hidden rounded-2xl border border-primary/30 bg-background">
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <WarningIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-semibold">Notifications need attention</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {deviceLabel[0].toUpperCase() + deviceLabel.slice(1)} lost its connection.
            </p>
          </div>
        </div>
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={enable}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-meutuals-gradient px-4 text-xs font-semibold text-white transition-[filter] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <BellIcon className="h-4 w-4" />
            Repair connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="flex items-center gap-3 p-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            status === "active"
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-primary/15 text-primary"
          }`}
        >
          {connecting ? (
            <SpinnerGapIcon className="h-5 w-5 animate-spin" />
          ) : status === "active" ? (
            <BellIcon className="h-5 w-5" />
          ) : (
            <BellSlashIcon className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Push notifications</p>
            {status === "active" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> On
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground" aria-live="polite">
            {connecting
              ? progressLabel(progress, "Checking this device…")
              : status === "active"
                ? `Active on ${deviceLabel}.`
                : "Keep up with messages and Ventures when MEUTUALS is closed."}
          </p>
        </div>
        {status === "active" && (
          <Switch
            checked
            disabled={loading}
            aria-label="Turn off push notifications on this device"
            onCheckedChange={() => disable()}
          />
        )}
      </div>
      {status !== "active" && !connecting && (
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={enable}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-meutuals-gradient px-4 text-xs font-semibold text-white transition-[filter] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <BellIcon className="h-4 w-4" />
            Turn on notifications
          </button>
        </div>
      )}
    </div>
  );
}

function NotificationStateCard({
  icon,
  title,
  detail,
  tone = "neutral",
  live = false,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  tone?: "neutral" | "warning" | "success";
  live?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : tone === "warning"
        ? "border-primary/30 bg-primary/[0.04]"
        : "border-border bg-background";
  const iconClass =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-400"
      : tone === "warning"
        ? "bg-primary/15 text-primary"
        : "bg-secondary text-muted-foreground";

  return (
    <div
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
      className={`flex items-start gap-3 rounded-2xl border p-4 ${toneClass}`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}
      >
        {icon}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
