import { useEffect, useRef, type RefObject } from "react";

const NEAR_BOTTOM_PX = 80;

/**
 * Keeps a chat's scroll position where the user left it across a keyboard
 * open/close. The keyboard resizes the scrollable list without moving its
 * scrollTop, so someone already at the bottom drifts away from it purely
 * because the container got shorter - and someone who had deliberately
 * scrolled up to read older messages should NOT get yanked back to the
 * bottom just because they tapped the composer. Only re-pin to the bottom
 * sentinel if the user was already at/near it right before the keyboard
 * toggled; otherwise leave their position untouched. Matches WhatsApp.
 *
 * A fresh message arriving is each screen's own concern (it always scrolls
 * to bottom today) - this hook only reacts to `keyboardOpen` changing.
 */
export function useStickToBottomOnKeyboard(
  listRef: RefObject<HTMLElement | null>,
  endRef: RefObject<HTMLElement | null>,
  keyboardOpen: boolean,
) {
  const wasAtBottomRef = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const track = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      wasAtBottomRef.current = distance <= NEAR_BOTTOM_PX;
    };
    track();
    el.addEventListener("scroll", track, { passive: true });
    return () => el.removeEventListener("scroll", track);
  }, [listRef]);

  useEffect(() => {
    if (wasAtBottomRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboardOpen]);
}
