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
    const id = idRef.current;
    const wasGesture = poppedByGestureRef.current;
    idRef.current = null;
    poppedByGestureRef.current = false;
    if (wasGesture) return; // a gesture already updated history - nothing to clean up.

    // A "normal" close (X button, backdrop click, confirm/submit action)
    // still has the entry this modal pushed sitting on top. This used to
    // call history.back() to consume it - which is a real navigation, and
    // real navigations go wherever the browser's actual history says to,
    // not necessarily back to "the same screen, just without my modal
    // marker." Any app action that doesn't push its own history entry for
    // every state change (e.g. switching bottom-nav tabs here is a plain
    // setState, not a push) leaves stale-but-still-current history data
    // sitting underneath - back() had no way to know that, and could
    // silently snap the app to whatever screen that stale entry actually
    // described. That's exactly what made confirming a post delete or a
    // quote-post submit look like it "errored": the action itself
    // succeeded, but the confirm click also triggered a real back
    // navigation to an unrelated older screen.
    //
    // Editing the *current* entry's own state to drop just this modal's id
    // achieves the same "don't leave a phantom stop behind" goal without
    // navigating anywhere - no popstate fires, nothing else on screen
    // reacts, and a later real back-press just finds one entry that now
    // looks identical to the current screen instead of a phantom stop.
    const state = (window.history.state ?? {}) as Record<string, unknown>;
    const stack = (state[MODAL_STACK_KEY] as string[] | undefined) ?? [];
    if (!stack.includes(id)) return;
    window.history.replaceState(
      { ...state, [MODAL_STACK_KEY]: stack.filter((stackId) => stackId !== id) },
      "",
      window.location.href,
    );
  }, [open]);
}
