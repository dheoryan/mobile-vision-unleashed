import { useState } from "react";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { DotsThreeIcon } from "@phosphor-icons/react/dist/csr/DotsThree";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { cn } from "@/lib/utils";

/**
 * Own-post "..." options sheet - same shape as CommentOwnMenu (which this
 * mirrors line for line) so a post's own menu no longer looks and behaves
 * differently from a comment's, or from Timeline vs. Profile's post
 * history - both render through this same PostCard, so fixing it here
 * fixes both at once.
 */
export function PostOwnMenu({
  onEdit,
  saved,
  onToggleSave,
  onDelete,
}: {
  onEdit: () => void;
  saved: boolean;
  onToggleSave: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className="relative -mr-2 -mt-1"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Post options"
          aria-expanded={open}
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <DotsThreeIcon className="h-4 w-4" />
        </button>
      </div>

      <AnimatedModal
        open={open}
        onOpenChange={setOpen}
        title="Post options"
        contentClassName="overflow-hidden"
        zIndex={60}
      >
        <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/35" />
          <div className="flex items-center justify-between px-5 pb-3 pt-3">
            <div>
              <p className="label-mono text-primary">YOUR POST</p>
              <h2 className="mt-0.5 font-display text-xl font-bold">Post options</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close post options"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="border-y border-border">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className="group flex min-h-[4.75rem] w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-secondary/55 active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <PencilSimpleIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Edit post</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Change the text or photos
                </span>
              </span>
              <CaretRightIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onToggleSave();
              }}
              className="group flex min-h-[4.75rem] w-full items-center gap-3 border-t border-border px-5 py-3 text-left transition-colors hover:bg-secondary/55 active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                  saved ? "bg-amber-400/15 text-amber-400" : "bg-primary/12 text-primary",
                )}
              >
                <BookmarkSimpleIcon className="h-5 w-5" weight={saved ? "fill" : "regular"} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {saved ? "Unsave post" : "Save post"}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {saved ? "Remove it from your saved posts" : "Keep it in your saved posts"}
                </span>
              </span>
              <CaretRightIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="group flex min-h-[4.75rem] w-full items-center gap-3 border-t border-border px-5 py-3 text-left text-destructive transition-colors hover:bg-destructive/8 active:bg-destructive/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-destructive"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/12 text-destructive">
                <TrashIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Delete post</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  This can't be undone
                </span>
              </span>
              <CaretRightIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </AnimatedModal>
    </>
  );
}
