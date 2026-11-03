import type { CSSProperties, ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { useModalBackGesture } from "@/hooks/use-modal-back-gesture";
import { useSheetSwipeToClose } from "@/hooks/use-sheet-swipe-to-close";

/**
 * Shared bottom-sheet-on-mobile / centered-dialog-on-desktop primitive used by
 * every modal in the app. Built on Radix's Dialog so we get real a11y for free
 * (focus trap, ESC to close, aria-modal, click-outside-to-dismiss) instead of
 * the hand-rolled `fixed inset-0` + backdrop-click divs this used to be.
 *
 * Animation is a plain CSS fade driven by Radix's own `data-state` attribute
 * (via tw-animate-css, already imported in styles.css). Radix waits for the
 * animation to finish before unmounting, so the exit fade works without any
 * JS animation library.
 *
 * `useModalBackGesture` gives every instance a real spot in browser history
 * so swiping back (or Android's system back) closes this sheet instead of
 * navigating whatever screen sits behind it - see that hook for why.
 */
export function AnimatedModal({
  open,
  onOpenChange,
  children,
  title,
  contentClassName = "",
  contentStyle,
  viewportStyle,
  center = false,
  side,
  preventClose = false,
  zIndex = 50,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Accessible name for the dialog. Rendered visually hidden — the visible heading inside `children` is still what users see. */
  title: string;
  contentClassName?: string;
  /** Inline style on the Content element, applied after contentClassName so
   *  it can override a CSS-driven size (e.g. a JS-measured
   *  window.visualViewport height on iOS, where dvh alone can't be trusted
   *  to track the on-screen keyboard in every browser/PWA mode). */
  contentStyle?: CSSProperties;
  /** Optional dimensions for the visual viewport. On iOS the software
   *  keyboard can shrink and offset that viewport without changing the
   *  layout viewport used by `position: fixed`. Keep this opt-in so ordinary
   *  dialogs retain their existing positioning. */
  viewportStyle?: CSSProperties;
  /** Always centered (no bottom-sheet-on-mobile behavior) — used for compact confirm-style dialogs. */
  center?: boolean;
  /** Slides in flush against the screen edge instead of rising from the
   *  bottom or centering - for a list you're browsing alongside whatever's
   *  behind it (e.g. picking someone to message), not a thing that takes
   *  over the screen's attention the way a sheet or confirm dialog does.
   *  Takes precedence over `center` when both are given. */
  side?: "right";
  /** Block outside-click / Escape from closing (e.g. while a mutation is in flight). */
  preventClose?: boolean;
  zIndex?: number;
}) {
  const block = (e: Event) => {
    if (preventClose) e.preventDefault();
  };

  useModalBackGesture(open, onOpenChange, preventClose);

  // Only the bottom-sheet-on-mobile shape gets a drag handle - "swipe down
  // to close" doesn't read the same way on a centered confirm dialog or a
  // side="right" panel that slides in from the edge.
  const swipeEnabled = !center && side !== "right";
  const { dragY, dragging, handleProps } = useSheetSwipeToClose(onOpenChange);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 bg-background/70 backdrop-blur-sm duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
          style={{ zIndex }}
        />
        <div
          className={cn(
            "pointer-events-none fixed inset-0 flex justify-center",
            side === "right"
              ? "items-stretch justify-end"
              : center
                ? "items-center px-4"
                : "items-end sm:items-center",
          )}
          style={{ ...viewportStyle, ...(viewportStyle ? { bottom: "auto" } : {}), zIndex }}
        >
          <DialogPrimitive.Content
            onEscapeKeyDown={block}
            onInteractOutside={block}
            onPointerDownOutside={block}
            // Radix renders this through a Portal - the DOM node sits
            // outside whatever rendered <AnimatedModal>, but React still
            // bubbles a click through the *component* tree it was authored
            // in. A caller whose own root has an onClick (PostCard's
            // "open this post" handler is the recurring example) would
            // otherwise see every tap inside any sheet built on this
            // primitive, with no way for the sheet itself to know it's
            // nested inside something clickable. Stopping it here once
            // fixes every current and future AnimatedModal instance.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              ...contentStyle,
              ...(swipeEnabled && dragY > 0 ? { transform: `translateY(${dragY}px)` } : {}),
            }}
            className={cn(
              "pointer-events-auto relative mx-auto w-full max-w-md border border-border bg-card duration-150",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
              side === "right"
                ? ""
                : center
                  ? "rounded-3xl shadow-2xl"
                  : "rounded-t-3xl sm:rounded-3xl",
              side === "right" &&
                "mx-0 h-full max-w-xs rounded-none border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
              // The live drag itself tracks the pointer with no transition
              // (any lag would read as unresponsive); releasing without
              // committing to a close snaps back over a short, reduced-
              // motion-respecting animation instead of jumping instantly.
              swipeEnabled &&
                !dragging &&
                "transition-transform duration-200 motion-reduce:transition-none",
              contentClassName,
            )}
          >
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              {title} dialog
            </DialogPrimitive.Description>
            {swipeEnabled && (
              // Decorative + a drag surface only - closing the sheet is
              // always still reachable via the close button, backdrop tap,
              // Escape, or the back-gesture handled above, so this being
              // unreachable by keyboard/screen reader loses nothing.
              <div
                {...handleProps}
                aria-hidden="true"
                className="flex w-full cursor-grab justify-center py-2.5 active:cursor-grabbing"
              >
                <span className="h-1 w-10 rounded-full bg-muted-foreground/35" />
              </div>
            )}
            {children}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
