import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/**
 * Drag-down-to-dismiss for a bottom sheet's own grab handle, wired once into
 * `AnimatedModal` so every sheet built on it gets a real gesture behind the
 * handle bar it already shows - rather than a purely decorative pill that
 * looks draggable and isn't. Mirrors the pointer-tracking shape already used
 * for the Explore deck's swipe cards (drag-then-commit-or-snap-back), not a
 * new gesture idiom for this app.
 *
 * Deliberately scoped to the handle element only, not the whole sheet body -
 * most sheets have their own internal `overflow-y-auto` content, and a drag
 * anywhere on the sheet would fight a user trying to scroll that content
 * instead of dismiss it.
 */
export function useSheetSwipeToClose(onOpenChange: (open: boolean) => void) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ y: number; time: number } | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    startRef.current = { y: event.clientY, time: performance.now() };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    // Only down - dragging up from the handle isn't "cancel the dismiss
    // further", it just isn't a gesture this handle does anything with.
    setDragY(Math.max(event.clientY - startRef.current.y, 0));
  };

  const release = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    startRef.current = null;
    setDragging(false);
    if (!start) {
      setDragY(0);
      return;
    }
    const delta = event.clientY - start.y;
    const elapsed = Math.max(performance.now() - start.time, 1);
    const velocity = delta / elapsed;
    const shouldClose = delta > 120 || (delta > 40 && velocity > 0.5);
    setDragY(0);
    if (shouldClose) onOpenChange(false);
  };

  const cancel = () => {
    startRef.current = null;
    setDragging(false);
    setDragY(0);
  };

  return {
    dragY,
    dragging,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: release,
      onPointerCancel: cancel,
      style: { touchAction: "none" as const },
    },
  };
}
