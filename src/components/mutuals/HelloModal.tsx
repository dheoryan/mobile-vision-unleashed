import { useState } from "react";
import { X, Loader2, Hand } from "lucide-react";
import { toast } from "sonner";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { useSendHello } from "@/lib/social-store";

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
}: {
  open: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  hellosLeft?: number;
}) {
  const [message, setMessage] = useState("");
  const send = useSendHello();

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
