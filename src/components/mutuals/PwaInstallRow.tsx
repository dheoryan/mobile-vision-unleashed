import { useEffect, useState } from "react";
import { Check, Download, Share, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  canInstallNow,
  onInstallAvailabilityChange,
  triggerInstallPrompt,
} from "@/lib/install-prompt";
import { isAndroid, isIosSafari, isStandalonePwa } from "@/lib/push-subscribe";

export function PwaInstallRow() {
  const [installed, setInstalled] = useState(false);
  const [installable, setInstallable] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const syncInstalled = () => setInstalled(isStandalonePwa());
    syncInstalled();
    setInstallable(canInstallNow());
    setPlatform(isIosSafari() ? "ios" : isAndroid() ? "android" : "other");
    const removeAvailabilityListener = onInstallAvailabilityChange(setInstallable);
    window.addEventListener("appinstalled", syncInstalled);
    const media = window.matchMedia?.("(display-mode: standalone)");
    media?.addEventListener?.("change", syncInstalled);
    return () => {
      removeAvailabilityListener();
      window.removeEventListener("appinstalled", syncInstalled);
      media?.removeEventListener?.("change", syncInstalled);
    };
  }, []);

  if (installed) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
          <Check className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Installed app</p>
          <p className="text-[11px] text-muted-foreground">
            Running from your home screen in standalone mode.
          </p>
        </div>
      </div>
    );
  }

  const ios = platform === "ios";
  const android = platform === "android";

  const install = async () => {
    setBusy(true);
    try {
      const outcome = await triggerInstallPrompt();
      if (outcome === "accepted") {
        toast.success("MEUTUALS is installing.");
      } else if (outcome === "unavailable") {
        toast.message("Use your browser menu", {
          description: android
            ? "Open Chrome’s menu and choose Install app."
            : "Choose Install app or Add to Home Screen.",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  if (ios) {
    return (
      <div className="rounded-xl border border-border bg-background p-3">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold">Install on iPhone</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              In Safari, tap Share, choose Add to Home Screen, then open MEUTUALS from its new icon.
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold">
          <span className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-secondary">
            <Share className="h-3.5 w-3.5 text-primary" /> 1. Share
          </span>
          <span className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-secondary">
            <Download className="h-3.5 w-3.5 text-primary" /> 2. Add to Home
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Smartphone className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Install MEUTUALS</p>
          <p className="text-[11px] text-muted-foreground">
            {installable
              ? "Add the full-screen app to this device."
              : "Available from your browser menu."}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={install}
        disabled={busy}
        className="min-h-11 shrink-0 rounded-full bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Opening…" : installable ? "Install" : "How"}
      </button>
    </div>
  );
}
