import { useEffect, useRef, useState } from "react";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { WifiSlashIcon } from "@phosphor-icons/react/dist/csr/WifiSlash";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";

const UPDATE_CHECK_MS = 60 * 60 * 1000;

function isPreviewContext(): boolean {
  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();
  const host = window.location.hostname;
  return (
    inIframe ||
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("-dev.lovable.app")
  );
}

/** Owns installed-app connectivity and service-worker update lifecycle. */
export function PwaLifecycle() {
  const [offline, setOffline] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const refreshing = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncConnection = () => setOffline(!navigator.onLine);
    syncConnection();
    window.addEventListener("online", syncConnection);
    window.addEventListener("offline", syncConnection);

    return () => {
      window.removeEventListener("online", syncConnection);
      window.removeEventListener("offline", syncConnection);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (isPreviewContext()) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        )
        .catch(() => undefined);
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;
    let updateTimer: number | undefined;

    const watchInstallingWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const onStateChange = () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(worker);
          setUpdateDismissed(false);
        }
      };
      worker.addEventListener("statechange", onStateChange);
    };

    const onControllerChange = () => {
      if (!refreshing.current) return;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((nextRegistration) => {
        registration = nextRegistration;
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting);
        }
        registration.addEventListener("updatefound", () => {
          watchInstallingWorker(registration?.installing ?? null);
        });
        void registration.update().catch(() => undefined);
        updateTimer = window.setInterval(() => {
          if (document.visibilityState === "visible") {
            void registration?.update().catch(() => undefined);
          }
        }, UPDATE_CHECK_MS);
      })
      .catch((error: unknown) => {
        console.warn("[sw] registration failed", error);
      });

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void registration?.update().catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (updateTimer !== undefined) window.clearInterval(updateTimer);
    };
  }, []);

  const applyUpdate = () => {
    if (!waitingWorker) return;
    refreshing.current = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  if (!offline && (!waitingWorker || updateDismissed)) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-[80] mx-auto max-w-sm">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-xl"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {offline ? (
            <WifiSlashIcon className="h-5 w-5" />
          ) : (
            <ArrowClockwiseIcon className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {offline ? "You’re offline" : "MEUTUALS is ready to update"}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {offline
              ? "Live posts, chats, and Ventures will resume when your connection returns."
              : "Reload once to use the newest version."}
          </p>
        </div>
        {!offline && (
          <>
            <button
              type="button"
              onClick={applyUpdate}
              className="min-h-11 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Update
            </button>
            <button
              type="button"
              onClick={() => setUpdateDismissed(true)}
              aria-label="Dismiss update"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
