import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

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
 */
export function AnimatedModal({
  open,
  onOpenChange,
  children,
  title,
  contentClassName = "",
  center = false,
  preventClose = false,
  zIndex = 50,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Accessible name for the dialog. Rendered visually hidden — the visible heading inside `children` is still what users see. */
  title: string;
  contentClassName?: string;
  /** Always centered (no bottom-sheet-on-mobile behavior) — used for compact confirm-style dialogs. */
  center?: boolean;
  /** Block outside-click / Escape from closing (e.g. while a mutation is in flight). */
  preventClose?: boolean;
  zIndex?: number;
}) {
  const block = (e: Event) => { if (preventClose) e.preventDefault(); };

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
            center ? "items-center px-4" : "items-end sm:items-center",
          )}
          style={{ zIndex }}
        >
          <DialogPrimitive.Content
            onEscapeKeyDown={block}
            onInteractOutside={block}
            onPointerDownOutside={block}
            className={cn(
              "pointer-events-auto relative mx-auto w-full max-w-md border border-border bg-card duration-150",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
              center ? "rounded-3xl shadow-2xl" : "rounded-t-3xl sm:rounded-3xl",
              contentClassName,
            )}
          >
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            {children}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
