import { useMemo, useState } from "react";
import { X, Loader2, Hand, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { useSendHello } from "@/lib/social-store";
import { suggestedOpener, type MatchSignals } from "@/lib/explore-reasons";

/**
 * Compose a Hello — the one message request you get with someone you have no
 * relationship with.
 *
 * The constraints are stated before the user writes rather than after they
 * send: one Hello per person ever, and a monthly allowance. Both are enforced
 * in the database, but a limit the user only discovers by hitting it reads as
 * a bug rather than a rule.
 */
export function HelloModal({
  open,
  onClose,
  recipientId,
  recipientName,
  hellosLeft,
  signals,
}: {
  open: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  hellosLeft?: number;
  /** What Explore matched on, used to offer a first line. */
  signals?: MatchSignals;
}) {
  const [message, setMessage] = useState("");
  const send = useSendHello();
  const opener = useMemo(
    () => (signals ? suggestedOpener(signals, recipientName) : null),
    [signals, recipientName],
  );

  const close = () => {
    if (send.isPending) return;
    setMessage("");
    onClose();
  };

  const submit = () => {
    const text = message.trim();
    if (!text) return;
    send.mutate(
      { recipient_id: recipientId, message: text },
      {
        onSuccess: () => {
          toast.success(`Hello sent to ${recipientName}`, {
            description: "You'll be able to message them if they accept.",
          });
          setMessage("");
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <AnimatedModal
      open={open}
      onOpenChange={(o) => { if (!o) close(); }}
      title={`Say hello to ${recipientName}`}
      preventClose={send.isPending}
      contentClassName="p-6"
    >
      <button onClick={close} aria-label="Close" className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">
        <X className="h-5 w-5" />
      </button>

      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Hand className="h-6 w-6" />
      </span>
      <h2 className="mt-4 font-display text-xl font-bold leading-tight">
        Say hello to {recipientName}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        You're not in the same Tribe, so this is a one-time request. If they accept,
        you can message each other normally.
      </p>

      <textarea
        autoFocus
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 280))}
        placeholder="Why do you want to connect? Keep it human."
        className="mt-4 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />

      {/* Offered, never prefilled. The blank box is where this flow loses
          people, but an opener the app writes for everyone is worth less than
          a clumsy one the user wrote. Tapping it drops the text in so they can
          edit it before sending. */}
      {opener && !message.trim() && (
        <button
          type="button"
          onClick={() => setMessage(opener)}
          className="mt-3 flex w-full items-start gap-2.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-left transition-colors hover:bg-primary/10"
        >
          <Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary">
              Use this opener
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{opener}</span>
          </span>
        </button>
      )}

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {hellosLeft === undefined
            ? "One Hello per person."
            : `${hellosLeft} ${hellosLeft === 1 ? "Hello" : "Hellos"} left this month · one per person`}
        </span>
        <span>{message.length}/280</span>
      </div>

      <button
        onClick={submit}
        disabled={!message.trim() || send.isPending || hellosLeft === 0}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
      >
        {send.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : "Send Hello"}
      </button>
      {hellosLeft === 0 && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          You've used this month's Hellos. They reset at the start of next month.
        </p>
      )}
    </AnimatedModal>
  );
}
