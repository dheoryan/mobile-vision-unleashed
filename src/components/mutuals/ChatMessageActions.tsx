import { Reply } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatReaction, ChatReactionCounts } from "@/lib/chat";

const ACTIONS = [
  { id: "heart" as const, label: "Love", emoji: "❤️" },
  { id: "laugh" as const, label: "Funny", emoji: "😂" },
  { id: "support" as const, label: "Support", emoji: "🤝" },
];

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
}: ChatMessageActionsProps) {
  return (
    <>
      {open && !disabled && (
        <div
          className={cn(
            "mt-1 flex w-fit items-center gap-0.5 rounded-full border border-border/80 bg-popover p-0.5 shadow-xl",
            mine && "ml-auto",
          )}
          role="toolbar"
          aria-label={`Actions for ${senderName}'s message`}
        >
          {ACTIONS.map(({ id, label, emoji }) => (
            <button
              key={id}
              type="button"
              onClick={() => onReact(id)}
              aria-label={label}
              aria-pressed={myReactions.includes(id)}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                myReactions.includes(id) && "bg-secondary text-foreground",
              )}
            >
              <span aria-hidden className="text-[19px] leading-none">
                {emoji}
              </span>
            </button>
          ))}
          <span aria-hidden className="mx-0.5 h-6 w-px bg-border" />
          <button
            type="button"
            onClick={onReply}
            aria-label="Reply to message"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Reply className="h-4 w-4" />
          </button>
        </div>
      )}

      {ACTIONS.some(({ id }) => reactions[id] > 0) && (
        <div className={cn("relative z-10 -mt-2 flex flex-wrap gap-1 px-1", mine && "justify-end")}>
          {ACTIONS.filter(({ id }) => reactions[id] > 0).map(({ id, label, emoji }) => (
            <button
              key={id}
              type="button"
              onClick={() => !disabled && onReact(id)}
              aria-label={`${label}, ${reactions[id]}`}
              aria-pressed={myReactions.includes(id)}
              disabled={disabled}
              className={cn(
                "inline-flex min-h-7 items-center gap-1 rounded-full border border-border/80 bg-card px-2 text-[10px] text-muted-foreground shadow-sm disabled:cursor-default",
                myReactions.includes(id) && "border-primary/60 text-foreground",
              )}
            >
              <span aria-hidden className="text-sm leading-none">
                {emoji}
              </span>
              {reactions[id]}
            </button>
          ))}
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
