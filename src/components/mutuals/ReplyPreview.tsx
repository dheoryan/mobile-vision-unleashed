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
 * The quoted message shown inside a chat bubble.
 *
 * Previously this was a filled, rounded box nested inside an already-rounded
 * bubble — a card inside a card. On an owned message it painted `white/20`
 * over the accent fill, which muddied the colour, and the two stacked corner
 * radii made every reply look like a broken attachment.
 *
 * Now it is a rule and two lines of text: a hairline bar, the author, and one
 * line of what they said, at reduced weight. Nothing is filled, nothing is
 * rounded, and the quote reads as a margin note on the reply rather than as a
 * separate object competing with it. The single divider under it does the
 * separating that the box used to do, for a fraction of the visual cost.
 *
 * `mine` switches contrast: on an owned bubble everything is drawn in the
 * foreground colour at low alpha via `currentColor`, so it works whatever the
 * accent behind it happens to be.
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
    <div className="mb-2 flex items-stretch gap-2">
      <span
        aria-hidden
        className={"w-[2px] shrink-0 rounded-full " + (mine ? "bg-current opacity-45" : "")}
        style={mine ? undefined : { backgroundColor: accentColor }}
      />
      <div className="min-w-0 flex-1 leading-tight">
        <p
          className={"truncate text-[10px] font-bold uppercase tracking-wide " + (mine ? "opacity-75" : "")}
          style={mine ? undefined : { color: accentColor }}
        >
          {name}
        </p>
        {/* One line, truncated. A two-line clamp made the quote compete with
            the reply for height, which is what made it read as a second
            message rather than as context for the first. */}
        <p className={"truncate text-[11px] " + (mine ? "opacity-65" : "text-muted-foreground")}>
          {snippet}
        </p>
      </div>
    </div>
  );
}
