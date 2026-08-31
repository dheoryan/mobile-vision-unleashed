import { useMemo, useState } from "react";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { HandIcon } from "@phosphor-icons/react/dist/csr/Hand";
import { MagicWandIcon } from "@phosphor-icons/react/dist/csr/MagicWand";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { HandshakeIcon } from "@phosphor-icons/react/dist/csr/Handshake";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { toast } from "sonner";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { useSendHello } from "@/lib/social-store";
import { suggestedOpener, type MatchSignals } from "@/lib/explore-reasons";
import { cn } from "@/lib/utils";

/**
 * Compose a Hello — the message request you send someone you have no
 * relationship with yet.
 *
 * The constraints are stated before the user writes rather than after they
 * send: a monthly allowance for cold cross-Tribe contact (Tribemates and
 * active Venture co-members are exempt), and if it goes unanswered or is
 * declined, a 30-day wait before trying that person again. Both are enforced
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
  sameTribe,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  hellosLeft?: number;
  /** What Explore matched on, used to offer a first line. */
  signals?: MatchSignals;
  /** Same Tribe still needs a Hello (Moots is earned, not assumed by Tribe
   *  membership), but it's free either way - doesn't touch the monthly cap,
   *  so the copy and the disabled state below both need to know this,
   *  independent of `signals` (not every call site has match signals). */
  sameTribe?: boolean;
  /** Fires after a successful send, before onClose - for callers that need
   *  to react to the send itself (e.g. dropping this person from a list). */
  onSent?: () => void;
}) {
  const isFree = sameTribe ?? signals?.same_tribe ?? false;
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
          onSent?.();
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <AnimatedModal
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      title={`Say hello to ${recipientName}`}
      preventClose={send.isPending}
      contentClassName="p-6"
    >
      <button
        onClick={close}
        aria-label="Close"
        className="absolute right-4 top-4 rounded-full text-muted-foreground transition-colors hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <XIcon className="h-5 w-5" />
      </button>

      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-meutuals-gradient text-white">
        <HandIcon className="h-6 w-6" weight="fill" />
      </span>
      <h2 className="mt-4 font-display text-xl font-bold leading-tight">
        Say hello to {recipientName}
      </h2>

      {/* Three short, scannable facts instead of one dense sentence - same
          info (Tribe status, needs their okay, 30-day retry), just read at a
          glance instead of parsed. */}
      <div className="mt-3 space-y-2">
        {(isFree
          ? [
              { Icon: SparkleIcon, text: "Free — you're already Tribemates" },
              { Icon: HandshakeIcon, text: "Still needs their okay to message" },
            ]
          : [
              { Icon: UsersIcon, text: "You're not in the same Tribe yet" },
              { Icon: HandshakeIcon, text: "Needs their okay before you can message" },
            ]
        )
          .concat([{ Icon: ArrowClockwiseIcon, text: "No reply? Try again in 30 days" }])
          .map(({ Icon, text }) => (
            <div key={text} className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-3.5 w-3.5" />
              </span>
              {text}
            </div>
          ))}
      </div>

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
          className="mt-3 flex w-full items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <MagicWandIcon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary">
              Suggested opener
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              {opener}
            </span>
          </span>
          <ArrowRightIcon className="mt-1 h-3.5 w-3.5 shrink-0 text-primary/60" />
        </button>
      )}

      {/* isFree already says "Free — you're already Tribemates" up in the
          fact rows - repeating it here would just be the same sentence
          twice. This pill only earns its place when it's carrying
          information those rows don't: the remaining monthly quota. */}
      <div
        className={cn("mt-3 flex items-center gap-2", isFree ? "justify-end" : "justify-between")}
      >
        {!isFree && (
          <span className="inline-flex min-w-0 items-center rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <span className="truncate">
              {hellosLeft === undefined
                ? "Tribemates and active Venture co-members don't count against your monthly Hellos"
                : `${hellosLeft} ${hellosLeft === 1 ? "Hello" : "Hellos"} left this month`}
            </span>
          </span>
        )}
        <span className="shrink-0 text-[11px] text-muted-foreground">{message.length}/280</span>
      </div>

      <button
        onClick={submit}
        disabled={!message.trim() || send.isPending || (hellosLeft === 0 && !isFree)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-meutuals-gradient py-3.5 text-sm font-semibold text-white transition-[transform,filter] hover:brightness-110 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40"
      >
        {send.isPending ? (
          <>
            <SpinnerGapIcon className="h-4 w-4 animate-spin" /> Sending…
          </>
        ) : (
          "Send Hello"
        )}
      </button>
      {hellosLeft === 0 && !isFree && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          You've used this month's Hellos. They reset at the start of next month.
        </p>
      )}
    </AnimatedModal>
  );
}
