import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

export const SWIPE_REPLY_THRESHOLD = 48;
const MAX_DRAG = 72;
const DRAG_RESISTANCE = 0.82;
// Same hold duration CommentsModal's own long-press-to-reply already uses -
// long enough that a normal tap or the start of a scroll never fires it,
// short enough to still feel immediate once you mean to hold.
const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_TOLERANCE = 8;

export function swipeReplyOffset(deltaX: number) {
  return Math.min(MAX_DRAG, Math.max(0, deltaX * DRAG_RESISTANCE));
}

export function shouldTriggerSwipeReply(offset: number) {
  return offset >= SWIPE_REPLY_THRESHOLD;
}

/**
 * Swipe a message to the right and release to reply. The bubble follows the
 * finger with resistance, reveals the reply affordance, then snaps home. A
 * normal action-menu Reply remains available for keyboard and desktop users.
 *
 * Also owns long-press-to-open-actions (WhatsApp-style) when `onLongPress`
 * is given: holding still for `LONG_PRESS_MS` opens the reaction/options
 * tray instead of a tap doing it, so a bare tap on a bubble goes back to
 * being inert like every other chat app. Bundled into this hook rather than
 * a second one because both gestures start from the same pointerdown and
 * have to agree on when a touch has become "not a tap" - the swipe axis
 * lock already computed here is exactly what should also cancel the
 * long-press timer.
 */
export function useSwipeReply(onTrigger: () => void, disabled = false, onLongPress?: () => void) {
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const activePointer = useRef<number | null>(null);
  const axis = useRef<"x" | "y" | null>(null);
  const dragXRef = useRef(0);
  const suppressClick = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const fire = () => {
    if (disabled) return;
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

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (disabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("a, button, input, textarea")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointer.current = e.pointerId;
    startX.current = e.clientX;
    startY.current = e.clientY;
    axis.current = null;
    dragXRef.current = 0;
    suppressClick.current = false;
    longPressFired.current = false;
    clearLongPress();
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        longPressFired.current = true;
        suppressClick.current = true;
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate?.(15);
          } catch {
            /* noop */
          }
        }
        onLongPress();
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (activePointer.current !== e.pointerId || startX.current == null || startY.current == null)
      return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (
      longPressTimer.current &&
      (Math.abs(dx) > LONG_PRESS_MOVE_TOLERANCE || Math.abs(dy) > LONG_PRESS_MOVE_TOLERANCE)
    ) {
      clearLongPress();
    }
    if (axis.current == null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axis.current === "y") {
      return;
    }
    if (e.cancelable) e.preventDefault();
    const next = swipeReplyOffset(dx);
    dragXRef.current = next;
    setDragX(next);
  };

  const finishDrag = (e: ReactPointerEvent<HTMLElement>, allowReply: boolean) => {
    if (activePointer.current !== e.pointerId) return;
    clearLongPress();
    const shouldReply =
      allowReply && !longPressFired.current && shouldTriggerSwipeReply(dragXRef.current);
    suppressClick.current = suppressClick.current || dragXRef.current > 6;
    // Clear our state before releasing capture. WebKit can dispatch
    // lostpointercapture synchronously from releasePointerCapture().
    activePointer.current = null;
    startX.current = null;
    startY.current = null;
    axis.current = null;
    dragXRef.current = 0;
    setDragX(0);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (shouldReply) fire();
  };

  const endDrag = (e: ReactPointerEvent<HTMLElement>) => finishDrag(e, true);
  const cancelDrag = (e: ReactPointerEvent<HTMLElement>) => finishDrag(e, false);

  const onLostPointerCapture = (e: ReactPointerEvent<HTMLElement>) => {
    if (activePointer.current !== e.pointerId) return;
    clearLongPress();
    suppressClick.current = suppressClick.current || dragXRef.current > 6;
    activePointer.current = null;
    startX.current = null;
    startY.current = null;
    axis.current = null;
    dragXRef.current = 0;
    setDragX(0);
  };

  const onClickCapture = (e: ReactMouseEvent<HTMLElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    if (!disabled) return;
    clearLongPress();
    activePointer.current = null;
    dragXRef.current = 0;
    setDragX(0);
    // clearLongPress is stable (recreated each render but side-effect-free
    // to omit); only `disabled` should re-run this reset.
  }, [disabled]);

  useEffect(() => () => clearLongPress(), []);

  return {
    dragX,
    peekOpacity: Math.min(1, dragX / SWIPE_REPLY_THRESHOLD),
    ready: shouldTriggerSwipeReply(dragX),
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: cancelDrag,
      onLostPointerCapture,
      onClickCapture,
    },
  };
}
