import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { ClockIcon } from "@phosphor-icons/react/dist/csr/Clock";
import { EyeSlashIcon } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { ShieldWarningIcon } from "@phosphor-icons/react/dist/csr/ShieldWarning";
import { UserMinusIcon } from "@phosphor-icons/react/dist/csr/UserMinus";
import { toast } from "sonner";
import {
  decideModerationReport,
  getModerationAccess,
  listModerationReports,
  type ModerationDecision,
  type ModerationReport,
  type ModerationStatus,
} from "@/lib/moderation.functions";
import { timeAgoLabel } from "@/lib/time";

export const Route = createFileRoute("/admin/reports")({
  component: ModerationQueuePage,
  head: () => ({ meta: [{ title: "Moderation queue — MEUTUALS — Your tribe is waiting" }] }),
});

function ModerationQueuePage() {
  const [status, setStatus] = useState<ModerationStatus | "all">("pending");
  const accessFn = useServerFn(getModerationAccess);
  const listFn = useServerFn(listModerationReports);
  const access = useQuery({
    queryKey: ["moderation-access"],
    queryFn: () => accessFn(),
    retry: false,
  });
  const reports = useQuery({
    queryKey: ["moderation-reports", status],
    queryFn: () => listFn({ data: { status } }),
    enabled: access.data?.moderator === true,
    refetchInterval: 60_000,
  });

  if (access.isLoading) return <PageMessage icon={<SpinnerGapIcon className="h-6 w-6 animate-spin" />} text="Checking access…" />;
  if (!access.data?.moderator) return <PageMessage icon={<ShieldWarningIcon className="h-7 w-7" />} text="Moderator access required." />;

  return (
    <div className="min-h-screen bg-habitat pb-12">
      <header className="glass sticky top-0 z-20 border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="h-4 w-4" /> App
          </Link>
          <div className="ml-auto text-right">
            <p className="label-mono text-muted-foreground">Trust & safety</p>
            <h1 className="font-display text-lg font-bold">Moderation queue</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pt-5">
        <div className="flex flex-wrap gap-2">
          {(["pending", "resolved", "dismissed", "all"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                status === value ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {reports.isLoading ? (
            <PageMessage icon={<SpinnerGapIcon className="h-6 w-6 animate-spin" />} text="Loading reports…" inline />
          ) : reports.isError ? (
            <div className="rounded-2xl border border-destructive/30 bg-card p-5 text-sm">
              Couldn't load the queue. <button onClick={() => reports.refetch()} className="font-semibold underline">Retry</button>
            </div>
          ) : !reports.data?.length ? (
            <PageMessage icon={<CheckCircleIcon className="h-7 w-7 text-emerald-400" />} text={`No ${status === "all" ? "" : status + " "}reports.`} inline />
          ) : (
            reports.data.map((report) => <ReportCard key={report.id} report={report} />)
          )}
        </div>
      </main>
    </div>
  );
}

function ReportCard({ report }: { report: ModerationReport }) {
  const decideFn = useServerFn(decideModerationReport);
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const decide = useMutation({
    mutationFn: (decision: ModerationDecision) =>
      decideFn({ data: { report_id: report.id, decision, notes } }),
    onSuccess: () => {
      toast.success("Moderation decision recorded");
      qc.invalidateQueries({ queryKey: ["moderation-reports"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const overdue = report.status === "pending" && Date.parse(report.due_at) < Date.now();
  const canHide = report.target_kind === "post" || report.target_kind === "comment";
  const canSuspend = report.target_kind === "user";

  return (
    <article className={`rounded-2xl border bg-card p-4 ${overdue ? "border-destructive/60" : "border-border"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="label-mono rounded-full bg-secondary px-2 py-1 text-muted-foreground">{report.target_kind}</span>
            <span className="text-sm font-semibold">{report.target_label}</span>
          </div>
          <p className="mt-2 text-sm"><span className="font-semibold">{report.reason}</span>{report.details ? ` — ${report.details}` : ""}</p>
          {report.target_preview && <p className="mt-2 rounded-xl bg-background/60 p-3 text-xs text-muted-foreground">{report.target_preview}</p>}
        </div>
        <div className={`inline-flex items-center gap-1 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
          <ClockIcon className="h-3.5 w-3.5" />
          {report.status === "pending" ? `Due ${new Date(report.due_at).toLocaleString()}` : report.status}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Reported {timeAgoLabel(report.created_at)} by {report.reporter?.display_name || "Deleted account"}
      </p>

      {report.status === "pending" ? (
        <>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value.slice(0, 1000))}
            placeholder="Internal review notes"
            rows={2}
            className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton disabled={decide.isPending} onClick={() => decide.mutate("dismiss")} label="Dismiss" />
            {canHide && <ActionButton disabled={decide.isPending} onClick={() => decide.mutate("hide_content")} label="Hide content" icon={<EyeSlashIcon className="h-3.5 w-3.5" />} />}
            {canSuspend && <ActionButton destructive disabled={decide.isPending} onClick={() => decide.mutate("suspend_user")} label="Suspend user" icon={<UserMinusIcon className="h-3.5 w-3.5" />} />}
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Action: {report.action ?? report.status}{report.moderator_notes ? ` — ${report.moderator_notes}` : ""}</p>
      )}
    </article>
  );
}

function ActionButton({ label, icon, onClick, disabled, destructive = false }: { label: string; icon?: React.ReactNode; onClick: () => void; disabled: boolean; destructive?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50 ${destructive ? "bg-destructive text-destructive-foreground" : "bg-secondary text-foreground"}`}>
      {icon}{label}
    </button>
  );
}

function PageMessage({ icon, text, inline = false }: { icon: React.ReactNode; text: string; inline?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-sm text-muted-foreground ${inline ? "rounded-2xl border border-dashed border-border p-8" : "min-h-screen bg-habitat"}`}>
      {icon}<span>{text}</span>
    </div>
  );
}
