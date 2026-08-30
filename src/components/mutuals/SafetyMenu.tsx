import { useState } from "react";
import { MoreHorizontal, X, Flag, Ban } from "lucide-react";
import { toast } from "sonner";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { useBlockUser } from "@/lib/blocked-store";
import { useReportContent } from "@/lib/social-store";
import { cn } from "@/lib/utils";

const REPORT_REASONS = [
  "Spam",
  "Harassment",
  "Inappropriate content",
  "Fake profile",
  "Underage user",
  "Other",
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type SafetyTargetKind = "user" | "post" | "comment";

export function SafetyMenu({
  targetName,
  targetUserId,
  targetPostId,
  targetCommentId,
  kind = "user",
  className = "",
  buttonClassName = "",
}: {
  targetName: string;
  /** Person id for "user" kind. Required to actually filter feeds when blocked. */
  targetUserId?: string;
  /** Post id when kind === "post". Required to file a post report. */
  targetPostId?: string;
  /** Comment id when kind === "comment". Required to file a comment report. */
  targetCommentId?: string;
  kind?: SafetyTargetKind;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const blockUser = useBlockUser();

  return (
    <>
      <div
        className={`relative ${className}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={`Safety options for ${targetName}`}
          aria-expanded={open}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            buttonClassName,
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-9 z-40 w-44 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <button
                onClick={() => {
                  setOpen(false);
                  setReportOpen(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary active:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <Flag className="h-3.5 w-3.5" /> Report {kind}
              </button>
              {targetUserId && (
                <button
                  onClick={() => {
                    setOpen(false);
                    if (!targetUserId || !UUID_RE.test(targetUserId)) {
                      toast.error("Can't block this account.");
                      return;
                    }
                    blockUser.mutate(targetUserId, {
                      onSuccess: () =>
                        toast.success(`${targetName} has been blocked.`, {
                          description: "Their posts and messages are now hidden.",
                        }),
                      onError: (e) => toast.error((e as Error).message),
                    });
                  }}
                  className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-secondary active:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-destructive"
                >
                  <Ban className="h-3.5 w-3.5" /> Block {targetName}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetName={targetName}
        kind={kind}
        targetId={
          kind === "post" ? targetPostId : kind === "comment" ? targetCommentId : targetUserId
        }
      />
    </>
  );
}

function ReportModal({
  open,
  onClose,
  targetName,
  kind,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  targetName: string;
  kind: SafetyTargetKind;
  targetId?: string;
}) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const reportContent = useReportContent();
  const submit = () => {
    if (!targetId) {
      toast.error("Can't submit a report for this item.");
      onClose();
      return;
    }
    reportContent.mutate(
      { target_kind: kind, target_id: targetId, reason, details: details || undefined },
      {
        onSuccess: () => {
          onClose();
          setDetails("");
          toast.success("Report submitted.", { description: "We'll review it shortly." });
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <AnimatedModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={`Report ${kind}`}
      preventClose={reportContent.isPending}
      contentClassName="p-6"
    >
      <div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full text-muted-foreground transition-colors hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-display text-xl font-bold">
          Report {kind === "user" ? `@${targetName}` : kind}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Reports are reviewed by the MEUTUALS team. They're confidential.
        </p>

        <label className="mt-4 block">
          <span className="label-mono text-muted-foreground">Reason</span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none"
          >
            {REPORT_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>

        <label className="mt-3 block">
          <span className="label-mono text-muted-foreground">Tell us more (optional)</span>
          <textarea
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 280))}
            placeholder="Add any context…"
            className="mt-1 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </label>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={submit}
            disabled={reportContent.isPending}
            className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            {reportContent.isPending ? "Submitting…" : "Submit report"}
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Cancel
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}
