import { useEffect, useRef } from "react";

const MODAL_STACK_KEY = "__modalStack";

let modalIdCounter = 0;
function nextModalId() {
  modalIdCounter += 1;
  return `modal-${modalIdCounter}`;
}

/** True once `myId` is no longer present in the stack of currently-open
 *  modal ids recorded on a history entry - i.e. a back-gesture (or the
 *  browser's own back button) navigated past this modal specifically, not
 *  just past something deeper in a stack of nested modals. A single
 *  back-step only removes the topmost id, so a modal further down the
 *  stack still finds itself listed and should stay open. Exported
 *  standalone so this decision can be unit tested without a real
 *  `window`/`history`. */
export function wasPoppedPast(currentStack: string[] | undefined, myId: string): boolean {
  return !(currentStack ?? []).includes(myId);
}

/**
 * Gives a Radix-Dialog-based sheet a real spot in browser history so
 * Android's system back and iOS's edge-back gesture close the sheet instead
 * of silently navigating whatever screen sits behind it - the same problem
 * `app-navigation.ts` already solved for full-screen layers (Tribe chat,
 * the Messages panel), applied here to every smaller sheet built on
 * AnimatedModal instead of requiring each of the ~25 call sites to wire
 * this up themselves.
 *
 * Nested modals (a confirm dialog opened from inside another sheet) carry
 * the *whole* stack of currently-open modal ids on the pushed state, not
 * just this modal's own id, so a single back-step closes only the topmost
 * one - see `wasPoppedPast`.
 */
export function useModalBackGesture(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  preventClose = false,
) {
  const idRef = useRef<string | null>(null);
  const poppedByGestureRef = useRef(false);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const id = nextModalId();
    idRef.current = id;
    poppedByGestureRef.current = false;

    const prevState = (window.history.state ?? {}) as Record<string, unknown>;
    const prevStack = (prevState[MODAL_STACK_KEY] as string[] | undefined) ?? [];
    window.history.pushState(
      { ...prevState, [MODAL_STACK_KEY]: [...prevStack, id] },
      "",
      window.location.href,
    );

    const onPopState = (event: PopStateEvent) => {
      // Blocking ESC/outside-click while a mutation is in flight should
      // block a back-gesture too - the browser's own navigation can't
      // actually be cancelled from here, but at least the sheet doesn't
      // vanish out from under an in-flight action.
      if (preventClose) return;
      const state = event.state as Record<string, unknown> | null;
      const stack = state?.[MODAL_STACK_KEY] as string[] | undefined;
      if (wasPoppedPast(stack, id)) {
        poppedByGestureRef.current = true;
        onOpenChange(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // onOpenChange/preventClose are read via closure for the lifetime of
    // this one "open" session rather than tracked as deps - they aren't
    // expected to change identity while a single sheet stays open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open || typeof window === "undefined") return;
    if (!idRef.current) return;
    const wasGesture = poppedByGestureRef.current;
    idRef.current = null;
    poppedByGestureRef.current = false;
    // A gesture (or the browser's own back button) already removed the
    // entry this modal pushed - nothing left to consume. A "normal" close
    // (X button, backdrop click, confirm action, or the caller resetting
    // `open` some other way) still has that entry sitting on top and needs
    // an explicit back() so it doesn't linger as a phantom stop a later,
    // real back-press would otherwise have to burn through first.
    if (!wasGesture) window.history.back();
  }, [open]);
}
