import { useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDeleteAccount } from "@/lib/account-store";
import { AnimatedModal } from "@/components/ui/animated-modal";

export function DeleteAccountModal({
  open,
  onClose,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const deleteAccount = useDeleteAccount();
  const [confirming, setConfirming] = useState(false);

  const handleClose = () => {
    if (deleteAccount.isPending) return;
    setConfirming(false);
    onClose();
  };

  return (
    <AnimatedModal
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
      title="Delete your account"
      preventClose={deleteAccount.isPending}
      contentClassName="p-6"
    >
      <div className="relative">
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute right-0 top-0 rounded-full text-muted-foreground transition-colors hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold leading-tight">Delete your account?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This permanently deletes your profile, posts, messages, and Ventures. This can't be
          undone.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="w-full rounded-2xl bg-destructive py-3.5 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              Delete my account
            </button>
          ) : (
            <button
              disabled={deleteAccount.isPending}
              onClick={() => {
                deleteAccount.mutate(undefined, {
                  onSuccess: () => {
                    toast.success("Account deleted.", {
                      description: "We're sorry to see you go.",
                    });
                    onDeleted();
                  },
                  onError: (e) => {
                    toast.error((e as Error).message || "Couldn't delete your account. Try again.");
                    setConfirming(false);
                  },
                });
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive py-3.5 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:opacity-60"
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
            className="w-full rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}
