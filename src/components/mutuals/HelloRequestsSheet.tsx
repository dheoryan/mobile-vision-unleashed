import { useState } from "react";
import { HandIcon } from "@phosphor-icons/react/dist/csr/Hand";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { toast } from "sonner";
import { AnimatedModal } from "@/components/ui/animated-modal";
import {
  useAnswerHello,
  useCancelHello,
  useIncomingHellos,
  useOutgoingHellos,
} from "@/lib/social-store";
import { timeAgoLabel } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { HelloWithProfile } from "@/lib/social.functions";

type HelloTab = "requests" | "sent";

/**
 * The dedicated home for Hello activity - split from a single stacked list
 * because "requests waiting on you" and "requests you're waiting on" are
 * different jobs, and a growing list of either shouldn't crowd out the
 * other. Reachable from Chats' own header icon, not just a notification tap.
 */
export function HelloRequestsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<HelloTab>("requests");
  const incoming = useIncomingHellos();
  const outgoing = useOutgoingHellos();
  const incomingCount = incoming.data?.length ?? 0;
  const outgoingCount = outgoing.data?.length ?? 0;

  return (
    <AnimatedModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="Hellos"
      side="right"
      contentClassName="flex h-full max-w-sm flex-col"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="label-mono text-muted-foreground">Chats</p>
          <h3 className="font-display text-lg font-bold">Hellos</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex shrink-0 gap-2 border-b border-border px-4 py-3">
        <TabButton
          active={tab === "requests"}
          onClick={() => setTab("requests")}
          count={incomingCount}
        >
          Requests
        </TabButton>
        <TabButton active={tab === "sent"} onClick={() => setTab("sent")} count={outgoingCount}>
          Sent
        </TabButton>
      </div>

      <div className="scroll-panel min-h-0 flex-1 overflow-y-auto px-5 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {tab === "requests" ? (
          <RequestsTab loading={incoming.isLoading} rows={incoming.data ?? []} />
        ) : (
          <SentTab loading={outgoing.isLoading} rows={outgoing.data ?? []} />
        )}
      </div>
    </AnimatedModal>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? "bg-meutuals-gradient text-white"
          : "border border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {count > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
            active ? "bg-white/20 text-white" : "bg-primary/15 text-primary",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
        <HandIcon className="h-6 w-6" weight="fill" />
      </span>
      <p className="mt-4 max-w-[26ch] text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function RequestsTab({ loading, rows }: { loading: boolean; rows: HelloWithProfile[] }) {
  const answer = useAnswerHello();

  if (loading) return <p className="text-center text-xs text-muted-foreground">Loading…</p>;
  if (!rows.length) {
    return (
      <EmptyState label="No Hello requests right now. When someone says hello, they'll show up here." />
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((h) => {
        const name = h.other?.display_name?.trim() || "Someone";
        const avatar = h.other?.avatar_url || h.other?.avatar_emoji || "👋";
        const isImg = avatar.startsWith("http") || avatar.startsWith("data:");
        const busy = answer.isPending && answer.variables?.hello_id === h.id;
        return (
          <li key={h.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-lg">
                {isImg ? (
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  avatar
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{name}</p>
                {h.other?.handle && (
                  <p className="truncate text-[11px] text-muted-foreground">@{h.other.handle}</p>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm text-foreground">{h.message}</p>
            <div className="mt-3 flex gap-2">
              <button
                disabled={busy}
                onClick={() =>
                  answer.mutate(
                    { hello_id: h.id, status: "accepted" },
                    {
                      onSuccess: () => toast.success(`You can now message ${name}`),
                      onError: (e) => toast.error((e as Error).message),
                    },
                  )
                }
                className="flex-1 rounded-full bg-primary py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
              >
                Accept
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  answer.mutate(
                    { hello_id: h.id, status: "declined" },
                    {
                      onSuccess: () =>
                        toast("Hello declined.", { description: "They can try again in 30 days." }),
                      onError: (e) => toast.error((e as Error).message),
                    },
                  )
                }
                className="flex-1 rounded-full border border-border py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
              >
                Decline
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SentTab({ loading, rows }: { loading: boolean; rows: HelloWithProfile[] }) {
  const cancel = useCancelHello();

  if (loading) return <p className="text-center text-xs text-muted-foreground">Loading…</p>;
  if (!rows.length) {
    return <EmptyState label="You haven't sent any Hellos that are still waiting on a reply." />;
  }

  return (
    <ul className="space-y-2">
      {rows.map((h) => {
        const name = h.other?.display_name?.trim() || "Someone";
        const avatar = h.other?.avatar_url || h.other?.avatar_emoji || "👋";
        const isImg = avatar.startsWith("http") || avatar.startsWith("data:");
        const busy = cancel.isPending && cancel.variables?.hello_id === h.id;
        // A Hello has no expiry and nobody nudges the recipient, so a
        // pending one can otherwise look identical whether it's been an
        // hour or a month - the honest elapsed time plus a "still waiting"
        // note past two weeks is the fix, not inventing an auto-expiry.
        const daysPending = Math.floor(
          (Date.now() - new Date(h.created_at).getTime()) / 86_400_000,
        );
        const stale = daysPending >= 14;
        return (
          <li key={h.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-lg">
                {isImg ? (
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  avatar
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  Sent {timeAgoLabel(h.created_at)} · no response yet
                </p>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{h.message}</p>
            {stale && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Still no reply after {daysPending} days. You can cancel and try again anytime.
              </p>
            )}
            <button
              disabled={busy}
              onClick={() =>
                cancel.mutate(
                  { hello_id: h.id },
                  {
                    onSuccess: () =>
                      toast(`Hello to ${name} cancelled`, {
                        description: "You can send them another right away.",
                      }),
                    onError: (e) => toast.error((e as Error).message),
                  },
                )
              }
              className="mt-3 w-full rounded-full border border-border py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            >
              {busy ? "Cancelling…" : "Cancel"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
