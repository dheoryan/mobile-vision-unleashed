import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";

/** Replaces the normal chat header while multi-select is active. The only
 *  bulk action is Unsend (see ChatMessageOwnMenu's "Select messages" row) -
 *  no bulk copy/forward, so this stays a plain count + cancel + one action
 *  rather than a general-purpose selection toolbar. */
export function ChatSelectionBar({
  count,
  onCancel,
  onUnsend,
}: {
  count: number;
  onCancel: () => void;
  onUnsend: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-background px-3 py-2.5">
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel selection"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground active:scale-90"
      >
        <XIcon className="h-5 w-5" />
      </button>
      <p className="flex-1 text-sm font-semibold">{count} selected</p>
      <button
        type="button"
        onClick={onUnsend}
        disabled={count === 0}
        aria-label="Unsend selected messages"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive/10 active:scale-90 disabled:opacity-40"
      >
        <TrashIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
