import { AnimatedModal } from "@/components/ui/animated-modal";

/** Shared confirm step for unsending a chat message - same shape as
 *  PostCard's delete-post confirm, reused across DM/Tribe/Venture chat
 *  instead of tripling the dialog. `count` > 1 switches to the bulk-unsend
 *  copy used by multi-select; omitted or 1 keeps the original single-message
 *  wording every existing call site already expects. */
export function UnsendConfirm({
  open,
  onCancel,
  onConfirm,
  count = 1,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  count?: number;
}) {
  const title = count > 1 ? `Unsend ${count} messages?` : "Unsend this message?";
  return (
    <AnimatedModal
      open={open}
      onOpenChange={(next) => !next && onCancel()}
      title={title}
      center
      contentClassName="mx-4 max-w-sm p-5"
    >
      <h3 className="font-display text-base font-bold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {count > 1
          ? "They'll be removed for everyone in this conversation. This can't be undone."
          : "It will be removed for everyone in this conversation. This can't be undone."}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground"
        >
          Unsend
        </button>
      </div>
    </AnimatedModal>
  );
}
