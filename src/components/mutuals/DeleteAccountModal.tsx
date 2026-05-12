import { X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function DeleteAccountModal({
  open, onClose, onConfirm,
}: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card p-6 animate-rise">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold leading-tight">Delete your account?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This permanently deletes your profile, posts, and messages. This can't be undone.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={() => {
              onClose();
              toast.success("Account deleted.", { description: "We're sorry to see you go." });
              onConfirm();
            }}
            className="w-full rounded-2xl bg-destructive py-3.5 text-sm font-semibold text-destructive-foreground"
          >
            Delete my account
          </button>
          <button onClick={onClose} className="w-full rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
