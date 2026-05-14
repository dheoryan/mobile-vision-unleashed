import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, X } from "lucide-react";
import {
  markThreadRead,
  useProfileById,
  useSendMessage,
  useThreadMessages,
  useThreads,
  type DMThreadSummary,
} from "@/lib/messages-store";
import { useAuth } from "@/lib/auth-context";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { TribeBadge } from "./Shared";
import { PlusBadge } from "./PlusBadge";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

export function MessagesPanel({
  open,
  onClose,
  openWithUserId,
}: {
  open: boolean;
  onClose: () => void;
  openWithUserId?: string | null;
}) {
  const [threadId, setThreadId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setThreadId(null);
      return;
    }
    if (openWithUserId) setThreadId(openWithUserId);
  }, [open, openWithUserId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 mx-auto flex max-w-md flex-col bg-background shadow-2xl animate-rise">
        {!threadId ? (
          <Inbox onOpen={(id) => setThreadId(id)} onClose={onClose} />
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

function Inbox({ onOpen, onClose }: { onOpen: (id: string) => void; onClose: () => void }) {
  const { data: threads, isLoading } = useThreads();

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
        ) : !threads || threads.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No messages yet. Send a Hello from a Venture to start a conversation.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {threads.map((t) => (
              <ThreadRow key={t.other_id} t={t} onOpen={() => onOpen(t.other_id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ThreadRow({ t, onOpen }: { t: DMThreadSummary; onOpen: () => void }) {
  const { user } = useAuth();
  const tribe = tribeOf(t.other?.tribe_ids);
  const isMine = t.last_message.sender_id === user?.id;
  return (
    <li>
      <button onClick={onOpen} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-card">
        <span className="relative">
          <Avatar value={avatarOf(t.other)} tribeColor={tribe.colorVar} />
          {t.other?.plan === "plus" && <PlusBadge />}
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
          {!isMine && t.unread_count > 0 && (
            <span className="h-2 w-2 rounded-full bg-primary" />
          )}
        </div>
      </button>
    </li>
  );
}

function Thread({ otherId, onBack }: { otherId: string; onBack: () => void }) {
  const { user } = useAuth();
  const { data: other } = useProfileById(otherId);
  const { data: msgs, isLoading } = useThreadMessages(otherId);
  const send = useSendMessage(otherId);
  const [text, setText] = useState("");
  const tribe = tribeOf(other?.tribe_ids);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!msgs?.length) return;
    const last = msgs[msgs.length - 1];
    markThreadRead(otherId, last.created_at);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs, otherId]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    send.mutate(t);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onBack} className="rounded-full p-2 text-muted-foreground hover:text-foreground">
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
            return (
              <div key={m.id} className={cn("flex", mine && "justify-end")}>
                <div className={cn("max-w-[80%]", pending && "opacity-60")}>
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm",
                      mine ? "rounded-br-sm text-primary-foreground" : "rounded-bl-sm bg-card text-foreground",
                    )}
                    style={mine ? { backgroundColor: tribe.colorVar } : undefined}
                  >
                    {m.content}
                  </div>
                  <p className={cn("mt-0.5 text-[10px] text-muted-foreground", mine && "text-right")}>
                    {pending ? "sending…" : `${timeAgo(m.created_at)} ago`}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Message"
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
