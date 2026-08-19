import { useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDeleteAccount } from "@/lib/account-store";

export function DeleteAccountModal({
  open, onClose, onDeleted,
}: { open: boolean; onClose: () => void; onDeleted: () => void }) {
  const deleteAccount = useDeleteAccount();
  const [confirming, setConfirming] = useState(false);

  if (!open) return null;

  const handleClose = () => {
    if (deleteAccount.isPending) return;
    setConfirming(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative mx-auto w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card p-6 animate-rise">
        <button onClick={handleClose} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold leading-tight">Delete your account?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This permanently deletes your profile, posts, messages, and Ventures. This can't be undone.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="w-full rounded-2xl bg-destructive py-3.5 text-sm font-semibold text-destructive-foreground"
            >
              Delete my account
            </button>
          ) : (
            <button
              disabled={deleteAccount.isPending}
              onClick={() => {
                deleteAccount.mutate(undefined, {
                  onSuccess: () => {
                    toast.success("Account deleted.", { description: "We're sorry to see you go." });
                    onDeleted();
                  },
                  onError: (e) => {
                    toast.error((e as Error).message || "Couldn't delete your account. Try again.");
                    setConfirming(false);
                  },
                });
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive py-3.5 text-sm font-semibold text-destructive-foreground disabled:opacity-60"
            >
              {deleteAccount.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                </>
              ) : (
                "Yes, permanently delete"
              )}
            </button>
          )}
          <button
            onClick={handleClose}
            disabled={deleteAccount.isPending}
            className="w-full rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
