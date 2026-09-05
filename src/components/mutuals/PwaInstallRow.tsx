import { useEffect, useState } from "react";
import { BellIcon } from "@phosphor-icons/react/dist/csr/Bell";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { DownloadIcon } from "@phosphor-icons/react/dist/csr/Download";
import { ListIcon } from "@phosphor-icons/react/dist/csr/List";
import { DotsThreeVerticalIcon } from "@phosphor-icons/react/dist/csr/DotsThreeVertical";
import { ShareIcon } from "@phosphor-icons/react/dist/csr/Share";
import { DeviceMobileIcon } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { PlusSquareIcon } from "@phosphor-icons/react/dist/csr/PlusSquare";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import type { Icon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { AnimatedModal } from "@/components/ui/animated-modal";
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
  const [guideOpen, setGuideOpen] = useState(false);

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
          <CheckIcon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Installed app</p>
          <p className="text-xs text-muted-foreground">
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
        setGuideOpen(true);
      }
    } finally {
      setBusy(false);
    }
  };

  if (ios) {
    return (
      <>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
          <div className="flex min-w-0 items-center gap-3">
            <DeviceMobileIcon className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Install on iPhone</p>
              <p className="text-xs text-muted-foreground">
                Add MEUTUALS to your Home Screen from Safari.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="min-h-11 shrink-0 rounded-full border border-primary/35 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Show steps
          </button>
        </div>
        <InstallGuide open={guideOpen} platform="ios" onClose={() => setGuideOpen(false)} />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
        <div className="flex min-w-0 items-center gap-3">
          <DeviceMobileIcon className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Install MEUTUALS</p>
            <p className="text-xs text-muted-foreground">
              {installable
                ? "Add the full-screen app to this device."
                : "See the steps for your browser and device."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={install}
          disabled={busy}
          className="min-h-11 shrink-0 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-95 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        >
          {busy ? "Opening…" : installable ? "Install" : "Show steps"}
        </button>
      </div>
      <InstallGuide
        open={guideOpen}
        platform={android ? "android" : "other"}
        onClose={() => setGuideOpen(false)}
      />
    </>
  );
}

interface GuideStep {
  icon: Icon;
  title: string;
  detail: string;
}

const IOS_STEPS: GuideStep[] = [
  {
    icon: DeviceMobileIcon,
    title: "Open MEUTUALS in Safari",
    detail: "If you are viewing this in another browser, copy the address and open it in Safari.",
  },
  {
    icon: ShareIcon,
    title: "Tap the Share button",
    detail: "It is the square with an upward arrow in Safari's toolbar.",
  },
  {
    icon: PlusSquareIcon,
    title: "Choose Add to Home Screen",
    detail: "Scroll down in the Share menu if the option is not immediately visible.",
  },
  {
    icon: CheckIcon,
    title: "Tap Add, then open the icon",
    detail: "MEUTUALS will launch full-screen from your Home Screen like an installed app.",
  },
];

const ANDROID_STEPS: GuideStep[] = [
  {
    icon: DotsThreeVerticalIcon,
    title: "Open your browser menu",
    detail: "In Chrome, tap ⋮ at the top right. In Samsung Internet, tap ≡ at the bottom right.",
  },
  {
    icon: DownloadIcon,
    title: "Choose the install option",
    detail:
      'Tap "Install app" or "Add to Home screen". Samsung Internet may show "Add page to" first.',
  },
  {
    icon: CheckIcon,
    title: "Confirm Install or Add",
    detail: "Your browser will create a MEUTUALS icon on the Home Screen or in the app drawer.",
  },
  {
    icon: DeviceMobileIcon,
    title: "Open MEUTUALS from its icon",
    detail: "It will launch without the normal browser controls and feel like a standalone app.",
  },
];

const DESKTOP_STEPS: GuideStep[] = [
  {
    icon: ListIcon,
    title: "Open Chrome or Edge",
    detail: "MEUTUALS installation is supported best in a Chromium-based desktop browser.",
  },
  {
    icon: DownloadIcon,
    title: "Choose Install MEUTUALS",
    detail:
      "Use the install icon in the address bar, or open the browser menu and choose Install app.",
  },
  {
    icon: CheckIcon,
    title: "Confirm the installation",
    detail: "MEUTUALS will open in its own window and can be pinned like another desktop app.",
  },
];

function InstallGuide({
  open,
  platform,
  onClose,
}: {
  open: boolean;
  platform: "ios" | "android" | "other";
  onClose: () => void;
}) {
  const steps =
    platform === "ios" ? IOS_STEPS : platform === "android" ? ANDROID_STEPS : DESKTOP_STEPS;
  const title =
    platform === "ios"
      ? "Install on iPhone"
      : platform === "android"
        ? "Install on Android"
        : "Install on this computer";

  return (
    <AnimatedModal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={title}
      contentClassName="max-h-[88dvh] overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close installation guide"
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <XIcon className="h-5 w-5" />
      </button>

      <p className="label-mono text-primary">Install MEUTUALS</p>
      <h3 className="mt-2 pr-10 font-display text-2xl font-bold">{title}</h3>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
        Installation does not create a second account. It adds the same MEUTUALS experience to your
        device with a full-screen launch and easier access.
      </p>

      <ol className="mt-6 border-y border-border">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="flex gap-3 border-b border-border py-4 last:border-b-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  <span className="mr-1.5 text-primary">{index + 1}.</span>
                  {step.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {step.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex items-start gap-3 border-l-2 border-primary pl-4">
        <BellIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          After opening the installed app, enable notifications in Settings if you want Venture,
          Chat, and request alerts on this device.
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-6 min-h-12 w-full rounded-2xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Got it
      </button>
    </AnimatedModal>
  );
}
