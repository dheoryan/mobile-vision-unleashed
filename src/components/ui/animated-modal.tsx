import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, type PanInfo } from "motion/react";

/**
 * Shared bottom-sheet-on-mobile / centered-dialog-on-desktop primitive used by
 * every modal in the app. Built on Radix's Dialog so we get real a11y for free
 * (focus trap, ESC to close, aria-modal, click-outside-to-dismiss) instead of
 * the hand-rolled `fixed inset-0` + backdrop-click divs this used to be.
 *
 * Motion drives the actual enter/exit — Radix only owns behavior, not visuals,
 * so `forceMount` + `AnimatePresence` keeps the panel mounted long enough to
 * play its exit animation instead of vanishing instantly on close.
 */
export function AnimatedModal({
  open,
  onOpenChange,
  children,
  title,
  contentClassName = "",
  center = false,
  drag = true,
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
  /** Allow drag-down-to-dismiss on the bottom-sheet variant. */
  drag?: boolean;
  /** Block outside-click / Escape from closing (e.g. while a mutation is in flight). */
  preventClose?: boolean;
  zIndex?: number;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 bg-background/70 backdrop-blur-sm"
                style={{ zIndex }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              />
            </DialogPrimitive.Overlay>
            <div
              className={`pointer-events-none fixed inset-0 flex justify-center ${
                center ? "items-center px-4" : "items-end sm:items-center"
              }`}
              style={{ zIndex }}
            >
              <DialogPrimitive.Content
                asChild
                forceMount
                onEscapeKeyDown={(e) => { if (preventClose) e.preventDefault(); }}
                onInteractOutside={(e) => { if (preventClose) e.preventDefault(); }}
                onPointerDownOutside={(e) => { if (preventClose) e.preventDefault(); }}
              >
                <motion.div
                  className={`pointer-events-auto relative mx-auto w-full max-w-md border border-border bg-card ${
                    center ? "rounded-3xl shadow-2xl" : "rounded-t-3xl sm:rounded-3xl"
                  } ${contentClassName}`}
                  initial={{ opacity: 0, y: center ? 16 : 48, scale: center ? 0.96 : 1 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: center ? 16 : 48, scale: center ? 0.96 : 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  drag={drag && !center ? "y" : false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.55 }}
                  onDragEnd={(_e, info: PanInfo) => {
                    if (!preventClose && (info.offset.y > 120 || info.velocity.y > 600)) {
                      onOpenChange(false);
                    }
                  }}
                >
                  {!center && drag && (
                    <div className="mx-auto mb-1 mt-2 h-1 w-9 shrink-0 rounded-full bg-border sm:hidden" />
                  )}
                  <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
                  {children}
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
