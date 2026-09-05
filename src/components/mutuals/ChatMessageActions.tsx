import { ArrowBendUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowBendUpLeft";
import { DotsThreeIcon } from "@phosphor-icons/react/dist/csr/DotsThree";
import { cn } from "@/lib/utils";
import {
  CHAT_REACTIONS,
  CHAT_REACTION_META,
  type ChatReaction,
  type ChatReactionCounts,
} from "@/lib/chat";

interface ChatMessageActionsProps {
  open: boolean;
  mine: boolean;
  senderName: string;
  reactions: ChatReactionCounts;
  myReactions: ChatReaction[];
  disabled?: boolean;
  onToggleOpen: () => void;
  onReact: (reaction: ChatReaction) => void;
  onReply: () => void;
  /** Own-message-only - opens the full "Message options" sheet (Edit/
   *  Unsend), same modal pattern as CommentOwnMenu/SafetyMenu rather than
   *  bare icons living in this toolbar directly. Omit for someone else's
   *  message. */
  onMoreOptions?: () => void;
}

/** Shared reaction tray and durable count chips for all chat message bubbles. */
export function ChatMessageActions({
  open,
  mine,
  senderName,
  reactions,
  myReactions,
  disabled = false,
  onToggleOpen,
  onReact,
  onReply,
  onMoreOptions,
}: ChatMessageActionsProps) {
  return (
    <>
      {open && !disabled && (
        <div
          className={cn(
            // 6 reactions + reply + "..." at the old h-11 (44px) touch
            // targets added up to ~368px - wider than this tray's own
            // max-w cap on an ordinary phone screen, so the "..." at the
            // end was only reachable by scrolling the tray sideways. This
            // app doesn't do horizontal scroll anywhere else, so instead
            // of leaning on overflow-x-auto to hide that, everything here
            // is sized to actually fit one row (8 buttons at h-9/36px is
            // ~300px including dividers and padding, comfortably under
            // the cap on any real phone width).
            "mt-1 flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-0.5 rounded-full border border-border/80 bg-popover p-0.5 shadow-xl",
            mine && "ml-auto",
          )}
          role="toolbar"
          aria-label={`Actions for ${senderName}'s message`}
        >
          {CHAT_REACTIONS.map((id) => {
            const { label, emoji } = CHAT_REACTION_META[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => onReact(id)}
                aria-label={label}
                aria-pressed={myReactions.includes(id)}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:scale-90 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  myReactions.includes(id) && "bg-secondary text-foreground",
                )}
              >
                <span aria-hidden className="text-base leading-none">
                  {emoji}
                </span>
              </button>
            );
          })}
          <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />
          <button
            type="button"
            onClick={onReply}
            aria-label="Reply to message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:scale-90 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowBendUpLeftIcon className="h-3.5 w-3.5" />
          </button>
          {mine && onMoreOptions && (
            <>
              <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />
              <button
                type="button"
                onClick={onMoreOptions}
                aria-label="Message options"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:scale-90 hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <DotsThreeIcon className="h-3.5 w-3.5" weight="bold" />
              </button>
            </>
          )}
        </div>
      )}

      {CHAT_REACTIONS.some((id) => reactions[id] > 0) && (
        <div className={cn("relative z-10 -mt-2 flex flex-wrap gap-1 px-1", mine && "justify-end")}>
          {CHAT_REACTIONS.filter((id) => reactions[id] > 0).map((id) => {
            const { label, emoji } = CHAT_REACTION_META[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => !disabled && onReact(id)}
                aria-label={`${label}, ${reactions[id]}`}
                aria-pressed={myReactions.includes(id)}
                disabled={disabled}
                className={cn(
                  "inline-flex min-h-7 items-center gap-1 rounded-full border border-border/80 bg-card px-2 text-xs text-muted-foreground shadow-sm transition-transform active:scale-95 disabled:cursor-default disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  myReactions.includes(id) && "border-primary/60 text-foreground",
                )}
              >
                <span aria-hidden className="text-sm leading-none">
                  {emoji}
                </span>
                {reactions[id]}
              </button>
            );
          })}
        </div>
      )}

      {!disabled && (
        <button
          type="button"
          onClick={onToggleOpen}
          className="sr-only rounded px-1 focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={`Open actions for ${senderName}'s message`}
          aria-expanded={open}
        >
          Message actions
        </button>
      )}
    </>
  );
}
