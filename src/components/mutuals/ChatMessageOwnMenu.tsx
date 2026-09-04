import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { cn } from "@/lib/utils";

/**
 * Own-message "..." options sheet - same shape as CommentOwnMenu and
 * SafetyMenu (label-mono context line, title, X close, full-width rows with
 * icon/title/description/chevron), reused across DM/Tribe/Venture chat
 * instead of the small bare pencil/trash icons that used to sit inline in
 * the reaction tray.
 *
 * Controlled rather than self-triggering (unlike CommentOwnMenu): the
 * trigger is the existing tap-to-reveal reaction toolbar's own "..." button,
 * since chat bubbles don't have a persistent per-message header the way a
 * post or comment does to hang an always-visible icon off.
 */
export function ChatMessageOwnMenu({
  open,
  onOpenChange,
  canEdit,
  onEdit,
  onUnsend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  onEdit: () => void;
  onUnsend: () => void;
}) {
  return (
    <AnimatedModal
      open={open}
      onOpenChange={onOpenChange}
      title="Message options"
      contentClassName="overflow-hidden"
      zIndex={60}
    >
      <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
        <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/35" />
        <div className="flex items-center justify-between px-5 pb-3 pt-3">
          <div>
            <p className="label-mono text-primary">YOUR MESSAGE</p>
            <h2 className="mt-0.5 font-display text-xl font-bold">Message options</h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close message options"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="border-y border-border">
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onEdit();
              }}
              className="group flex min-h-[4.75rem] w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-secondary/55 active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <PencilSimpleIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Edit message</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">Change the text</span>
              </span>
              <CaretRightIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onUnsend();
            }}
            className={cn(
              "group flex min-h-[4.75rem] w-full items-center gap-3 px-5 py-3 text-left text-destructive transition-colors hover:bg-destructive/8 active:bg-destructive/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-destructive",
              canEdit && "border-t border-border",
            )}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/12 text-destructive">
              <TrashIcon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Unsend message</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Removes it for everyone in this conversation
              </span>
            </span>
            <CaretRightIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}
