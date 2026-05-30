import { Reply, X } from "lucide-react";

/**
 * Compact reply preview that appears above the composer input
 * when the user is replying to a message. Left accent bar uses the
 * provided color (tribe color / primary).
 */
export function ReplyPreview({
  name,
  snippet,
  accentColor,
  onCancel,
}: {
  name: string;
  snippet: string;
  accentColor: string;
  onCancel: () => void;
}) {
  return (
    <div
      className="mb-2 flex items-stretch gap-2 overflow-hidden rounded-xl border border-border/60 bg-card/80 pr-2 backdrop-blur-sm animate-rise"
      style={{
        boxShadow: `0 1px 0 0 color-mix(in oklab, ${accentColor} 18%, transparent) inset`,
      }}
    >
      <div
        className="w-1 shrink-0"
        style={{ backgroundColor: accentColor }}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 items-center gap-2 py-1.5">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: `color-mix(in oklab, ${accentColor} 22%, transparent)`,
            color: accentColor,
          }}
        >
          <Reply className="h-3 w-3" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p
            className="truncate text-[11px] font-semibold"
            style={{ color: accentColor }}
          >
            Replying to {name}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{snippet}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Cancel reply"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Parses a message body that may start with a quoted reply prefix
 * (e.g. "↪ Alice: original text\nactual reply"). Returns the quote
 * (if any) and the remaining body. Mirrors quotePrefix in MessagesPanel.
 */
export function parseQuotedMessage(content: string): {
  quote: { name: string; snippet: string } | null;
  body: string;
} {
  if (!content.startsWith("↪ ")) return { quote: null, body: content };
  const newlineIdx = content.indexOf("\n");
  if (newlineIdx === -1) return { quote: null, body: content };
  const header = content.slice(2, newlineIdx); // strip "↪ "
  const colonIdx = header.indexOf(":");
  if (colonIdx === -1) return { quote: null, body: content };
  const name = header.slice(0, colonIdx).trim();
  const snippet = header.slice(colonIdx + 1).trim();
  const body = content.slice(newlineIdx + 1);
  if (!name || !snippet) return { quote: null, body: content };
  return { quote: { name, snippet }, body };
}

/**
 * Styled inline quote block rendered inside a chat bubble for
 * a replied-to message. `mine` controls contrast against the
 * bubble background (own messages use a translucent dark overlay,
 * incoming use a tinted accent strip).
 */
export function QuotedBlock({
  name,
  snippet,
  mine,
  accentColor,
}: {
  name: string;
  snippet: string;
  mine: boolean;
  accentColor: string;
}) {
  return (
    <div
      className={
        "relative mb-1.5 flex items-stretch gap-2 overflow-hidden rounded-lg " +
        (mine
          ? "bg-white/20 text-white"
          : "bg-muted text-foreground")
      }
    >
      <div
        className="w-[3px] shrink-0 rounded-full"
        style={{ backgroundColor: mine ? "#ffffff" : accentColor }}
        aria-hidden
      />
      <div className="min-w-0 flex-1 py-1.5 pr-2.5">
        <p
          className="truncate text-[11px] font-semibold"
          style={mine ? { color: "#ffffff" } : { color: accentColor }}
        >
          {name}
        </p>
        <p
          className={
            "truncate text-[11px] " +
            (mine ? "text-white/85" : "text-muted-foreground")
          }
        >
          {snippet}
        </p>
      </div>
    </div>
  );
}
