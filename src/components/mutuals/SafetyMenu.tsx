import { useState } from "react";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { DotsThreeIcon } from "@phosphor-icons/react/dist/csr/DotsThree";
import { EyeSlashIcon } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { FlagIcon } from "@phosphor-icons/react/dist/csr/Flag";
import { ProhibitIcon } from "@phosphor-icons/react/dist/csr/Prohibit";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
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
  onHideComment,
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
  /** Post-owner-only moderation action. Omit outside comment rows the viewer owns. */
  onHideComment?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const blockUser = useBlockUser();
  const kindLabel = kind.charAt(0).toUpperCase() + kind.slice(1);

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
            "flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            buttonClassName,
          )}
        >
          <DotsThreeIcon className="h-4 w-4" />
        </button>
      </div>

      <AnimatedModal
        open={open}
        onOpenChange={setOpen}
        title={`${kindLabel} options`}
        contentClassName="overflow-hidden"
        zIndex={60}
      >
        <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/35" />
          <div className="flex items-center justify-between px-5 pb-3 pt-3">
            <div>
              <p className="label-mono text-primary">KEEP IT SAFE</p>
              <h2 className="mt-0.5 font-display text-xl font-bold">{kindLabel} options</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={`Close ${kind} options`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="border-y border-border">
            {onHideComment && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onHideComment();
                }}
                className="group flex min-h-[4.75rem] w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-secondary/55 active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <EyeSlashIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Hide comment</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Remove it from your post; restore it later
                  </span>
                </span>
                <CaretRightIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setReportOpen(true);
              }}
              className={cn(
                "group flex min-h-[4.75rem] w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-secondary/55 active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                onHideComment && "border-t border-border",
              )}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <FlagIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Report {kind}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Send this to the MEUTUALS safety team
                </span>
              </span>
              <CaretRightIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>

            {targetUserId && (
              <button
                type="button"
                disabled={blockUser.isPending}
                onClick={() => {
                  setOpen(false);
                  if (!UUID_RE.test(targetUserId)) {
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
                className="group flex min-h-[4.75rem] w-full items-center gap-3 border-t border-border px-5 py-3 text-left text-destructive transition-colors hover:bg-destructive/8 active:bg-destructive/12 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-destructive"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/12 text-destructive">
                  <ProhibitIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">Block {targetName}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Hide their posts and messages
                  </span>
                </span>
                <CaretRightIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </div>
      </AnimatedModal>

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
      zIndex={70}
    >
      <div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full text-muted-foreground transition-colors hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <XIcon className="h-5 w-5" />
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
