import { useEffect, useState } from "react";
import { ArrowLeft, Send, X } from "lucide-react";
import { DMS, personById, tribeById, type DMThread } from "@/lib/mutuals-data";
import { TribeBadge } from "./Shared";
import { PlusBadge } from "./PlusBadge";
import { cn } from "@/lib/utils";

export function MessagesPanel({
  open, onClose, extraThreads = [], openWithUserId,
}: {
  open: boolean; onClose: () => void; extraThreads?: DMThread[]; openWithUserId?: string | null;
}) {
  const [openThread, setOpenThread] = useState<DMThread | null>(null);
  const threads = [...extraThreads, ...DMS];

  useEffect(() => {
    if (!open || !openWithUserId) return;
    const t = threads.find((th) => th.withUserId === openWithUserId);
    if (t) setOpenThread(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, openWithUserId]);

  useEffect(() => { if (!open) setOpenThread(null); }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 mx-auto flex max-w-md flex-col bg-background shadow-2xl animate-rise">
        {!openThread ? (
          <Inbox threads={threads} onOpen={setOpenThread} onClose={onClose} />
        ) : (
          <Thread thread={openThread} onBack={() => setOpenThread(null)} />
        )}
      </div>
    </div>
  );
}

function Inbox({ threads, onOpen, onClose }: { threads: DMThread[]; onOpen: (t: DMThread) => void; onClose: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="font-display text-xl font-bold">Messages</h2>
        <button aria-label="Close" onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
      </header>
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No messages yet. Send a Hello from a Venture to start a conversation.</p>
        ) : (
          <ul className="divide-y divide-border">
            {threads.map((t) => {
              const u = personById(t.withUserId);
              const tribe = tribeById(u.tribeId);
              return (
                <li key={t.id}>
                  <button onClick={() => onOpen(t)} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-card">
                    <span className="relative">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full text-xl" style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 28%, transparent)` }}>
                        {u.avatar}
                      </span>
                      {u.plus && <PlusBadge />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{u.name}</p>
                        <TribeBadge name={tribe.name} color={tribe.colorVar} />
                      </div>
                      <p className={cn("truncate text-xs", t.unread ? "text-foreground" : "text-muted-foreground")}>{t.preview}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] text-muted-foreground">{t.time}</span>
                      {t.unread && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Thread({ thread, onBack }: { thread: DMThread; onBack: () => void }) {
  const u = personById(thread.withUserId);
  const tribe = tribeById(u.tribeId);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState(thread.messages);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    setMsgs((m) => [...m, { id: `me-${Date.now()}`, from: "me", text: t, time: "now" }]);
    setText("");
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onBack} className="rounded-full p-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></button>
        <span className="flex h-9 w-9 items-center justify-center rounded-full text-lg" style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 28%, transparent)` }}>
          {u.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{u.name}</p>
          <p className="text-[11px] text-muted-foreground">{tribe.name} · {u.city}</p>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {msgs.map((m) => {
          const mine = m.from === "me";
          return (
            <div key={m.id} className={cn("flex", mine && "justify-end")}>
              <div className={cn("max-w-[80%]")}>
                <div
                  className={cn(
                    "rounded-2xl px-3 py-2 text-sm",
                    mine ? "rounded-br-sm text-primary-foreground" : "rounded-bl-sm bg-card text-foreground"
                  )}
                  style={mine ? { backgroundColor: tribe.colorVar } : undefined}
                >
                  {m.text}
                </div>
                <p className={cn("mt-0.5 text-[10px] text-muted-foreground", mine && "text-right")}>{m.time}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Message"
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <button onClick={send} disabled={!text.trim()} className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
