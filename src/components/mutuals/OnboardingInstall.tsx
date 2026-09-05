import { useEffect, useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { DownloadIcon } from "@phosphor-icons/react/dist/csr/Download";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { ListIcon } from "@phosphor-icons/react/dist/csr/List";
import { ShareIcon } from "@phosphor-icons/react/dist/csr/Share";
import { DeviceMobileIcon } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { PlusSquareIcon } from "@phosphor-icons/react/dist/csr/PlusSquare";
import type { Icon } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  canInstallNow,
  onInstallAvailabilityChange,
  triggerInstallPrompt,
} from "@/lib/install-prompt";
import {
  isAndroid,
  isIosSafari,
  isIosThirdPartyBrowser,
  isStandalonePwa,
} from "@/lib/push-subscribe";

type InstallPlatform = "ios" | "android" | "desktop";

interface InstallStep {
  icon: Icon;
  title: string;
  detail: string;
}

const IOS_SAFARI_STEPS: InstallStep[] = [
  {
    icon: ShareIcon,
    title: "Tap Share in Safari",
    detail: "Use the square-and-arrow button in Safari’s toolbar.",
  },
  {
    icon: PlusSquareIcon,
    title: "Choose Add to Home Screen",
    detail: "Scroll the share menu if the option is not immediately visible.",
  },
  {
    icon: DeviceMobileIcon,
    title: "Open the new MEUTUALS icon",
    detail: "It launches full-screen and can receive notifications when you enable them later.",
  },
];

const IOS_OTHER_BROWSER_STEPS: InstallStep[] = [
  {
    icon: ShareIcon,
    title: "Open this page in Safari",
    detail: "Use your browser’s Share menu, then choose Open in Safari or copy this page address.",
  },
  ...IOS_SAFARI_STEPS.slice(1),
];

const ANDROID_STEPS: InstallStep[] = [
  {
    icon: ListIcon,
    title: "Open the browser menu",
    detail: "In Chrome, tap the three-dot menu beside the address bar.",
  },
  {
    icon: DownloadIcon,
    title: "Choose Install app",
    detail: "Some browsers call this Add to Home screen.",
  },
  {
    icon: DeviceMobileIcon,
    title: "Open MEUTUALS from its icon",
    detail: "Your account stays the same; installation only changes how the app launches.",
  },
];

const DESKTOP_STEPS: InstallStep[] = [
  {
    icon: DownloadIcon,
    title: "Use your browser’s install control",
    detail: "Look in the address bar or browser menu for Install MEUTUALS or Add to Dock.",
  },
  {
    icon: CheckIcon,
    title: "Confirm installation",
    detail: "MEUTUALS will open in its own window and can be pinned like another app.",
  },
];

export function OnboardingInstall({ onContinue }: { onContinue: () => void }) {
  const [platform, setPlatform] = useState<InstallPlatform>("desktop");
  const [thirdPartyIos, setThirdPartyIos] = useState(false);
  const [installable, setInstallable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandalonePwa()) {
      onContinue();
      return;
    }

    setPlatform(isIosSafari() ? "ios" : isAndroid() ? "android" : "desktop");
    setThirdPartyIos(isIosThirdPartyBrowser());
    setInstallable(canInstallNow());
    return onInstallAvailabilityChange(setInstallable);
  }, [onContinue]);

  const steps =
    platform === "ios"
      ? thirdPartyIos
        ? IOS_OTHER_BROWSER_STEPS
        : IOS_SAFARI_STEPS
      : platform === "android"
        ? ANDROID_STEPS
        : DESKTOP_STEPS;

  const install = async () => {
    if (!installable) return;
    setBusy(true);
    try {
      const outcome = await triggerInstallPrompt();
      if (outcome === "accepted") {
        toast.success("MEUTUALS is being added to your device.");
        onContinue();
      } else if (outcome === "dismissed") {
        toast.message("No pressure—you can install later from Settings.");
      }
    } finally {
      setBusy(false);
    }
  };

  const platformLabel =
    platform === "ios"
      ? thirdPartyIos
        ? "iPhone or iPad browser"
        : "Safari on iPhone or iPad"
      : platform === "android"
        ? "Android browser"
        : "Desktop browser";

  return (
    <main data-onboarding-install className="bg-habitat relative min-h-dvh overflow-x-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
        <span className="ambient-orb ambient-orb-2" style={{ background: "#3A7CA5" }} />
        <span className="ambient-orb ambient-orb-4" style={{ background: "#D4A853" }} />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))]">
        <div className="animate-rise">
          <p className="label-mono text-primary">Optional final touch</p>
          <h1 className="mt-3 font-display text-[40px] font-bold leading-[1.06] tracking-tight">
            Keep your Tribe one tap away.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Your profile is ready. Install MEUTUALS for a full-screen launch and a faster way back
            to Chats and Ventures.
          </p>
        </div>

        <section className="mt-8 overflow-hidden rounded-[1.75rem] border border-border bg-card/85 backdrop-blur-xl">
          <div className="flex items-center gap-3 border-b border-border p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <DeviceMobileIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="label-mono text-muted-foreground">Detected</p>
              <p className="mt-1 font-display text-lg font-bold">{platformLabel}</p>
            </div>
          </div>

          {installable ? (
            <div className="p-5">
              <p className="text-sm font-semibold">Your browser can install MEUTUALS directly.</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                The browser will ask you to confirm. No second account or download-store sign-in is
                needed.
              </p>
            </div>
          ) : (
            <ol className="px-5">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li
                    key={step.title}
                    className="flex gap-3 border-b border-border py-4 last:border-b-0"
                  >
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
          )}
        </section>

        <div className="mt-auto space-y-3 pt-8">
          {installable ? (
            <button
              type="button"
              onClick={() => void install()}
              disabled={busy}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-meutuals-gradient px-4 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-[opacity,transform,filter] hover:brightness-110 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
            >
              {busy ? (
                <SpinnerGapIcon className="h-4 w-4 animate-spin" />
              ) : (
                <DownloadIcon className="h-4 w-4" />
              )}
              {busy ? "Opening install…" : "Install MEUTUALS"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onContinue}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-[transform,background-color] hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Continue to MEUTUALS <ArrowRightIcon className="h-4 w-4" />
            </button>
          )}
          {installable && (
            <button
              type="button"
              onClick={onContinue}
              className="min-h-11 w-full rounded text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Not now—install later in Settings
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
