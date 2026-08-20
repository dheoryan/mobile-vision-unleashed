import { useEffect, useRef, useState } from "react";

const SWIPE_THRESHOLD = 56;
const MAX_DRAG = 80;
const LONG_PRESS_MS = 450;

/**
 * Swipe-right or long-press (~450ms) to trigger a "Reply" action,
 * with a haptic tap and a translated bubble. Mirrors the gesture used
 * in CommentsModal so chat surfaces feel consistent.
 */
export function useSwipeReply(onTrigger: () => void, disabled = false) {
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const axis = useRef<"x" | "y" | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggered = useRef(false);

  const fire = () => {
    if (triggered.current || disabled) return;
    triggered.current = true;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.(15);
      } catch {
        /* noop */
      }
    }
    onTrigger();
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (disabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    axis.current = null;
    triggered.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(fire, LONG_PRESS_MS);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (startX.current == null || startY.current == null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (axis.current == null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axis.current === "y") {
      clearLongPress();
      return;
    }
    clearLongPress();
    const next = Math.max(0, Math.min(MAX_DRAG, dx));
    setDragX(next);
    if (next >= SWIPE_THRESHOLD) fire();
  };

  const endDrag = () => {
    clearLongPress();
    startX.current = null;
    startY.current = null;
    axis.current = null;
    setDragX(0);
  };

  useEffect(() => () => clearLongPress(), []);

  return {
    dragX,
    peekOpacity: Math.min(1, dragX / SWIPE_THRESHOLD),
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onPointerLeave: endDrag,
    },
  };
}
