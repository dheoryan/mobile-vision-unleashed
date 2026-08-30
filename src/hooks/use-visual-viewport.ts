import { useEffect, useState, type CSSProperties } from "react";

export interface VisualViewportState {
  height: number | null;
  offsetTop: number;
  bottomInset: number;
  keyboardOpen: boolean;
}

const KEYBOARD_THRESHOLD = 120;
const INITIAL_VIEWPORT: VisualViewportState = {
  height: null,
  offsetTop: 0,
  bottomInset: 0,
  keyboardOpen: false,
};

export function getVisualViewportMetrics({
  stableHeight,
  layoutHeight,
  visualHeight,
  offsetTop,
}: {
  stableHeight: number;
  layoutHeight: number;
  visualHeight: number;
  offsetTop: number;
}): VisualViewportState {
  return {
    height: Math.round(visualHeight),
    offsetTop: Math.round(offsetTop),
    // Only compensate elements that still use the unresized layout viewport.
    // Browsers honoring interactive-widget=resizes-content report zero here.
    bottomInset: Math.max(0, Math.round(layoutHeight - visualHeight - offsetTop)),
    keyboardOpen: stableHeight - visualHeight >= KEYBOARD_THRESHOLD,
  };
}

/**
 * Tracks the actually visible browser area while a mobile keyboard is open.
 * `100dvh` follows the browser chrome, but older WebKit and some Android
 * webviews keep it tied to the layout viewport when the IME appears.
 */
export function useVisualViewport(enabled = true): VisualViewportState {
  const [viewport, setViewport] = useState<VisualViewportState>(INITIAL_VIEWPORT);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setViewport(INITIAL_VIEWPORT);
      return;
    }

    const visualViewport = window.visualViewport;
    let stableHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
    const update = () => {
      const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
      const visualHeight = visualViewport?.height ?? layoutHeight;
      const offsetTop = visualViewport?.offsetTop ?? 0;
      stableHeight = Math.max(stableHeight, layoutHeight, visualHeight + offsetTop);
      setViewport(
        getVisualViewportMetrics({ stableHeight, layoutHeight, visualHeight, offsetTop }),
      );
    };

    const resetAfterOrientationChange = () => {
      stableHeight = 0;
      requestAnimationFrame(update);
    };

    update();
    visualViewport?.addEventListener("resize", update);
    visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", resetAfterOrientationChange);

    return () => {
      visualViewport?.removeEventListener("resize", update);
      visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", resetAfterOrientationChange);
    };
  }, [enabled]);

  return viewport;
}

export function visualViewportStyle(viewport: VisualViewportState): CSSProperties {
  return viewport.height === null
    ? { height: "100dvh" }
    : { height: `${viewport.height}px`, top: `${viewport.offsetTop}px` };
}
