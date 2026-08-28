import { useEffect, useState, type CSSProperties } from "react";

interface VisualViewportState {
  height: number | null;
  offsetTop: number;
}

const INITIAL_VIEWPORT: VisualViewportState = { height: null, offsetTop: 0 };

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
    const update = () => {
      setViewport({
        height: Math.round(visualViewport?.height ?? window.innerHeight),
        offsetTop: Math.round(visualViewport?.offsetTop ?? 0),
      });
    };

    update();
    visualViewport?.addEventListener("resize", update);
    visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      visualViewport?.removeEventListener("resize", update);
      visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [enabled]);

  return viewport;
}

export function visualViewportStyle(viewport: VisualViewportState): CSSProperties {
  return viewport.height === null
    ? { height: "100dvh" }
    : { height: `${viewport.height}px`, top: `${viewport.offsetTop}px` };
}
