import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, Reply, Send, X } from "lucide-react";
import {
  markThreadRead,
  useProfileById,
  useSendMessage,
  useThreadMessages,
  useThreads,
  type DMThreadSummary,
} from "@/lib/messages-store";
import {
  useMyHostedVentures,
  useMyJoinedVentures,
  useSendVentureMessage,
  useVentureMessages,
  type VentureMessage,
  type VentureParty,
  type VentureProfileLite,
} from "@/lib/ventures-store";
import { useAuth } from "@/lib/auth-context";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { TribeBadge } from "./Shared";
import { PlusBadge } from "./PlusBadge";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { showPlusBadge } from "@/lib/feature-flags";
import { requestPushPrompt } from "@/lib/push-prompt-events";
import { toast } from "sonner";
import { useSwipeReply } from "@/hooks/use-swipe-reply";
import { ReplyPreview, QuotedBlock, parseQuotedMessage } from "./ReplyPreview";

type ReplyTarget = { id: string; name: string; snippet: string };

function quotePrefix(reply: ReplyTarget) {
  const snippet = reply.snippet.length > 80 ? reply.snippet.slice(0, 77) + "…" : reply.snippet;
  return `↪ ${reply.name}: ${snippet}\n`;
}

function MessageSwipeRow({
  children,
  mine,
  accentColor,
  disabled,
  onReply,
}: {
  children: React.ReactNode;
  mine: boolean;
  accentColor: string;
  disabled?: boolean;
  onReply: () => void;
}) {
  const { dragX, peekOpacity, handlers } = useSwipeReply(onReply, disabled);
  return (
    <div className="relative select-none">
      {dragX > 4 && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-start pl-1 text-muted-foreground"
          style={{ opacity: peekOpacity }}
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: `color-mix(in oklab, ${accentColor} 28%, transparent)` }}
          >
            <Reply className="h-3.5 w-3.5" />
          </span>
        </div>
      )}
      <div
        {...handlers}
        className={cn("flex touch-pan-y", mine ? "justify-end" : "justify-start")}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragX === 0 ? "transform 180ms ease-out" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function MessagesPanel({
  open,
  onClose,
  openWithUserId,
  openWithVenture,
}: {
  open: boolean;
  onClose: () => void;
  openWithUserId?: string | null;
  openWithVenture?: VentureParty | null;
}) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [ventureThread, setVentureThread] = useState<VentureParty | null>(null);

  useEffect(() => {
    if (!open) {
      setThreadId(null);
      setVentureThread(null);
      return;
    }

    if (openWithVenture) {
      setThreadId(null);
      setVentureThread(openWithVenture);
      return;
    }

    setVentureThread(null);
    if (openWithUserId) setThreadId(openWithUserId);
  }, [open, openWithUserId, openWithVenture]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 mx-auto flex max-w-md flex-col bg-background shadow-2xl animate-rise">
        {ventureThread ? (
          <VenturePartyThread venture={ventureThread} onBack={() => setVentureThread(null)} />
        ) : !threadId ? (
          <Inbox
            onOpen={(id) => setThreadId(id)}
            onOpenVenture={(venture) => {
              setThreadId(null);
              setVentureThread(venture);
            }}
            onClose={onClose}
          />
        ) : (
          <Thread otherId={threadId} onBack={() => setThreadId(null)} />
        )}
      </div>
    </div>
  );
}

function tribeOf(ids?: string[] | null) {
  const id = (ids?.[0] as TribeId | undefined) ?? "wolf";
  try {
    return tribeById(id);
  } catch {
    return tribeById("wolf");
  }
}

function avatarOf(p: { avatar_url: string | null; avatar_emoji: string } | null | undefined) {
  return p?.avatar_url || p?.avatar_emoji || "👤";
}

function Avatar({
  value,
  size = 12,
  tribeColor,
}: {
  value: string;
  size?: number;
  tribeColor: string;
}) {
  const isImg = value.startsWith("http") || value.startsWith("data:");
  const dim = `h-${size} w-${size}`;
  return (
    <span
      className={cn("flex items-center justify-center overflow-hidden rounded-full text-xl", dim)}
      style={{ backgroundColor: `color-mix(in oklab, ${tribeColor} 28%, transparent)` }}
    >
      {isImg ? <img src={value} alt="" className="h-full w-full object-cover" /> : value}
    </span>
  );
}

function Inbox({
  onOpen,
  onOpenVenture,
  onClose,
}: {
  onOpen: (id: string) => void;
  onOpenVenture: (venture: VentureParty) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { data: threads, isLoading: directMessagesLoading } = useThreads();
  const { data: hostedVentures, isLoading: hostedVenturesLoading } = useMyHostedVentures();
  const { data: joinedVentures, isLoading: joinedVenturesLoading } = useMyJoinedVentures();

  const partyThreads = useMemo(() => {
    const map = new Map<string, VentureParty>();
    const all = [...(hostedVentures ?? []), ...(joinedVentures ?? [])];

    for (const venture of all) {
      const isActive = venture.status !== "closed" && !venture.closed_at && !venture.ended_at;
      const isHost = venture.host_id === user?.id;
      const isAcceptedMember = venture.my_application?.status === "accepted";

      if (isActive && (isHost || isAcceptedMember)) {
        map.set(venture.id, venture);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
    );
  }, [hostedVentures, joinedVentures, user?.id]);

  const isLoading = directMessagesLoading || hostedVenturesLoading || joinedVenturesLoading;
  const hasDirectThreads = !!threads?.length;
  const hasPartyThreads = partyThreads.length > 0;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="font-display text-xl font-bold">Messages</h2>
        <button
          aria-label="Close"
          onClick={onClose}
          className="rounded-full p-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="p-10 text-center text-xs text-muted-foreground">Loading…</p>
        ) : !hasDirectThreads && !hasPartyThreads ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No messages yet. Active Venture party chats will appear here after you host or join one.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {hasPartyThreads && (
              <section>
                <p className="label-mono px-5 pb-2 pt-4 text-muted-foreground">Party chats</p>
                <ul>
                  {partyThreads.map((venture) => (
                    <VentureThreadRow
                      key={venture.id}
                      venture={venture}
                      onOpen={() => onOpenVenture(venture)}
                    />
                  ))}
                </ul>
              </section>
            )}

            {hasDirectThreads && (
              <section>
                <p className="label-mono px-5 pb-2 pt-4 text-muted-foreground">Direct messages</p>
                <ul className="divide-y divide-border">
                  {threads.map((t) => (
                    <ThreadRow key={t.other_id} t={t} onOpen={() => onOpen(t.other_id)} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function VentureThreadRow({ venture, onOpen }: { venture: VentureParty; onOpen: () => void }) {
  const { user } = useAuth();
  const { data: msgs } = useVentureMessages(venture.id, true);
  const last = msgs?.[msgs.length - 1];
  const isMine = last?.sender_id === user?.id;
  const lastSenderName = displayVentureName(last?.sender);
  const preview = last
    ? `${isMine ? "You" : lastSenderName}: ${last.content}`
    : `${Math.max(venture.filled_slots, 1)}/${venture.max_slots} slots · No messages yet`;

  return (
    <li>
      <button
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-card"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{venture.title}</p>
            <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-primary">
              Party
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">{preview}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] text-muted-foreground">
            {last ? timeAgo(last.created_at) : timeAgo(venture.created_at)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {Math.max(venture.filled_slots, 1)}/{venture.max_slots}
          </span>
        </div>
      </button>
    </li>
  );
}

function ThreadRow({ t, onOpen }: { t: DMThreadSummary; onOpen: () => void }) {
  const { user } = useAuth();
  const tribe = tribeOf(t.other?.tribe_ids);
  const isMine = t.last_message.sender_id === user?.id;
  return (
    <li>
      <button
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-card"
      >
        <span className="relative">
          <Avatar value={avatarOf(t.other)} tribeColor={tribe.colorVar} />
          {showPlusBadge(t.other?.plan) && <PlusBadge />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">
              {t.other?.display_name?.trim() || "Someone"}
            </p>
            <TribeBadge name={tribe.name} color={tribe.colorVar} />
          </div>
          <p
            className={cn(
              "truncate text-xs",
              t.unread_count && !isMine ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {isMine ? "You: " : ""}
            {t.last_message.content}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] text-muted-foreground">
            {timeAgo(t.last_message.created_at)}
          </span>
          {!isMine && t.unread_count > 0 && <span className="h-2 w-2 rounded-full bg-primary" />}
        </div>
      </button>
    </li>
  );
}

function displayVentureName(profile: VentureProfileLite | null | undefined) {
  return profile?.display_name?.trim() || profile?.handle || "Someone";
}

function shortTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function VenturePartyThread({ venture, onBack }: { venture: VentureParty; onBack: () => void }) {
  const { user } = useAuth();
  const { data: msgs, isLoading } = useVentureMessages(venture.id, true);
  const send = useSendVentureMessage(venture.id);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!msgs?.length) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs]);

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    const content = replyTo ? quotePrefix(replyTo) + body : body;
    send.mutate(content, {
      onSuccess: () => {
        setText("");
        setReplyTo(null);
        requestPushPrompt("venture");
      },
      onError: (err) => toast.error((err as Error).message),
    });
  };

  const startReply = (m: VentureMessage) => {
    const mine = m.sender_id === user?.id;
    setReplyTo({
      id: m.id,
      name: mine ? "yourself" : displayVentureName(m.sender),
      snippet: m.content,
    });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const memberCount = Math.max(venture.filled_slots, 1);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          onClick={onBack}
          className="rounded-full p-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
          <MessageCircle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{venture.title}</p>
          <p className="text-[11px] text-muted-foreground">
            Party chat · {memberCount}/{venture.max_slots} slots
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <p className="py-10 text-center text-xs text-muted-foreground">Loading party chat…</p>
        ) : !msgs?.length ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No messages yet.
          </p>
        ) : (
          msgs.map((m: VentureMessage) => {
            const mine = m.sender_id === user?.id;
            const pending = m.id.startsWith("tmp-");
            return (
              <MessageSwipeRow
                key={m.id}
                mine={mine}
                accentColor="var(--color-primary)"
                disabled={pending}
                onReply={() => startReply(m)}
              >
                <div className={cn("max-w-[82%]", pending && "opacity-60")}>
                  {(() => {
                    const { quote, body } = parseQuotedMessage(m.content);
                    return (
                      <div
                        className={cn(
                          "rounded-2xl px-3 py-2 text-sm",
                          mine
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm bg-card text-foreground",
                        )}
                      >
                        {!mine && (
                          <p className="mb-0.5 text-[10px] font-semibold opacity-70">
                            {displayVentureName(m.sender)}
                          </p>
                        )}
                        {quote && (
                          <QuotedBlock
                            name={quote.name}
                            snippet={quote.snippet}
                            mine={mine}
                            accentColor="var(--color-primary)"
                          />
                        )}
                        <p className="whitespace-pre-wrap leading-relaxed">{body}</p>
                        <p
                          className={cn(
                            "mt-1 text-[10px]",
                            mine ? "text-primary-foreground/70" : "text-muted-foreground",
                          )}
                        >
                          {pending ? "sending…" : shortTime(m.created_at)}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </MessageSwipeRow>
            );
          })
        )}
      </div>

      <div className="border-t border-border p-3">
        {replyTo && (
          <ReplyPreview
            name={replyTo.name}
            snippet={replyTo.snippet}
            accentColor="var(--color-primary)"
            onCancel={() => setReplyTo(null)}
          />
        )}
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={replyTo ? "Write a reply…" : "Message the party"}
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={!text.trim() || send.isPending}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            aria-label="Send party message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Thread({ otherId, onBack }: { otherId: string; onBack: () => void }) {
  const { user } = useAuth();
  const { data: other } = useProfileById(otherId);
  const { data: msgs, isLoading } = useThreadMessages(otherId);
  const send = useSendMessage(otherId);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const tribe = tribeOf(other?.tribe_ids);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!msgs?.length) return;
    const last = msgs[msgs.length - 1];
    markThreadRead(otherId, last.created_at);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs, otherId]);

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    const content = replyTo ? quotePrefix(replyTo) + body : body;
    setText("");
    setReplyTo(null);
    send.mutate(content, {
      onSuccess: () => requestPushPrompt("dm"),
    });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          onClick={onBack}
          className="rounded-full p-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar value={avatarOf(other)} size={9} tribeColor={tribe.colorVar} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {other?.display_name?.trim() || "Someone"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {tribe.name}
            {other?.city ? ` · ${other.city}` : ""}
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <p className="py-10 text-center text-xs text-muted-foreground">Loading…</p>
        ) : !msgs?.length ? (
          <p className="py-10 text-center text-xs text-muted-foreground">Say hi 👋</p>
        ) : (
          msgs.map((m) => {
            const mine = m.sender_id === user?.id;
            const pending = m.id.startsWith("tmp-");
            const senderName = mine
              ? "yourself"
              : other?.display_name?.trim() || "Them";
            return (
              <MessageSwipeRow
                key={m.id}
                mine={mine}
                accentColor={tribe.colorVar}
                disabled={pending}
                onReply={() => {
                  setReplyTo({ id: m.id, name: senderName, snippet: m.content });
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
              >
                <div className={cn("max-w-[80%]", pending && "opacity-60")}>
                  {(() => {
                    const { quote, body } = parseQuotedMessage(m.content);
                    return (
                      <div
                        className={cn(
                          "rounded-2xl px-3 py-2 text-sm shadow-sm",
                          mine
                            ? "rounded-br-sm text-white"
                            : "rounded-bl-sm bg-card text-foreground",
                        )}
                        style={mine ? { backgroundColor: tribe.colorVar } : undefined}
                      >
                        {quote && (
                          <QuotedBlock
                            name={quote.name}
                            snippet={quote.snippet}
                            mine={mine}
                            accentColor={tribe.colorVar}
                          />
                        )}
                        <p className="whitespace-pre-wrap break-words">{body}</p>
                      </div>
                    );
                  })()}
                  <p
                    className={cn("mt-0.5 text-[10px] text-muted-foreground", mine && "text-right")}
                  >
                    {pending ? "sending…" : `${timeAgo(m.created_at)} ago`}
                  </p>
                </div>
              </MessageSwipeRow>
            );
          })
        )}
      </div>

      <div className="border-t border-border p-3">
        {replyTo && (
          <ReplyPreview
            name={replyTo.name}
            snippet={replyTo.snippet}
            accentColor={tribe.colorVar}
            onCancel={() => setReplyTo(null)}
          />
        )}
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={replyTo ? "Write a reply…" : "Message"}
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={!text.trim() || send.isPending}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
