import { useState, useRef, useEffect } from "react";
import { Plus, Send, Smile, Image as ImageIcon } from "lucide-react";
import { TRIBES, POSTS, CHAT_BY_TRIBE, type TribeId, tribeById, personById } from "@/lib/mutuals-data";
import type { Profile } from "./Onboarding";
import { PostCard } from "./PostCard";
import { AppHeader, SectionTitle } from "./Shared";
import { cn } from "@/lib/utils";

export function TribeScreen({ profile, onOpenMessages, unread }: { profile: Profile; onOpenMessages: () => void; unread?: number }) {
  const [activeTribe, setActiveTribe] = useState<TribeId>(profile.tribeId);
  const [view, setView] = useState<"feed" | "chat">("feed");
  const tribe = tribeById(activeTribe);
  const tribePosts = POSTS.filter((p) => p.tribeId === activeTribe);

  return (
    <div className="bg-habitat min-h-screen pb-28">
      <AppHeader title={tribe.name} subtitle="Home base" accent={tribe.colorVar} onOpenMessages={onOpenMessages} unread={unread} />
      <main className="mx-auto max-w-md px-5 pt-3">
        <TribeStrip active={activeTribe} onChange={setActiveTribe} />
        <TribeBanner tribe={tribe} />

        <div className="mt-5 flex gap-2 rounded-full bg-card p-1">
          {(["feed", "chat"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex-1 rounded-full py-2 text-xs font-semibold capitalize transition-colors",
                view === v ? "text-primary-foreground" : "text-muted-foreground"
              )}
              style={view === v ? { backgroundColor: tribe.colorVar } : undefined}
            >
              {v === "feed" ? "Tribe Feed" : "Group Chat"}
            </button>
          ))}
        </div>

        {view === "feed" ? (
          <>
            <SectionTitle title="Tribe Feed" hint="Posts from your scene · chronological" />
            <div className="flex flex-col gap-3">
              {tribePosts.map((p) => <PostCard key={p.id} post={p} />)}
            </div>
          </>
        ) : (
          <GroupChat tribeId={activeTribe} />
        )}
      </main>

      {view === "feed" && (
        <button
          className="fixed bottom-24 right-5 z-30 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/40 transition-transform active:scale-95"
          style={{ backgroundColor: tribe.colorVar }}
          aria-label="New post"
        >
          <Plus className="h-4 w-4" /> Post
        </button>
      )}
    </div>
  );
}

function TribeStrip({ active, onChange }: { active: TribeId; onChange: (id: TribeId) => void }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-3">
        {TRIBES.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className="flex shrink-0 flex-col items-center gap-1.5 active:scale-95"
            >
              <span
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl text-2xl transition-all",
                  isActive ? "" : "opacity-60"
                )}
                style={{
                  backgroundColor: `color-mix(in oklab, ${t.colorVar} 22%, transparent)`,
                  boxShadow: isActive ? `0 0 0 2px ${t.colorVar}` : undefined,
                }}
              >
                {t.emoji}
              </span>
              <span className={cn("text-[11px] font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                {t.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TribeBanner({ tribe }: { tribe: ReturnType<typeof tribeById> }) {
  return (
    <section
      className="relative mt-5 overflow-hidden rounded-2xl border border-border p-5"
      style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${tribe.colorVar} 38%, var(--card)) 0%, var(--card) 75%)`,
      }}
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-40 blur-3xl" style={{ backgroundColor: tribe.colorVar }} />
      <div className="relative flex items-start gap-4">
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl"
          style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 30%, var(--card))` }}
        >
          {tribe.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <span className="label-mono inline-flex items-center gap-1.5 rounded-full bg-background/40 px-2 py-1 text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> You're home
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold leading-tight">{tribe.name}</h2>
            {tribe.hosted && (
              <span className="label-mono inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-primary" title={`Hosted by ${tribe.hostOrg}`}>
                ✓ HOSTED
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{tribe.scene}</p>
          {tribe.hosted && <p className="text-[11px] text-primary/80">Run by {tribe.hostOrg}</p>}
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="text-foreground">{tribe.online}</span> online · {tribe.members.toLocaleString()} members
          </p>
        </div>
      </div>
    </section>
  );
}

function GroupChat({ tribeId }: { tribeId: TribeId }) {
  const tribe = tribeById(tribeId);
  const seed = CHAT_BY_TRIBE[tribeId];
  const [messages, setMessages] = useState(seed);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMessages(CHAT_BY_TRIBE[tribeId]); }, [tribeId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    setMessages((m) => [...m, { id: `me-${Date.now()}`, userId: "me", text: t, time: "now" }]);
    setText("");
  };

  return (
    <div className="mt-4">
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto px-1 py-1">
          {messages.map((m) => {
            const mine = m.userId === "me";
            const author = mine ? null : personById(m.userId);
            return (
              <div key={m.id} className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
                {!mine && (
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-sm"
                    style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 28%, transparent)` }}
                  >
                    {author?.avatar}
                  </span>
                )}
                <div className={cn("max-w-[78%]")}>
                  {!mine && <p className="mb-0.5 text-[10px] text-muted-foreground">{author?.name}</p>}
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm",
                      mine ? "rounded-br-sm text-primary-foreground" : "rounded-bl-sm bg-secondary text-foreground"
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
          <div ref={endRef} />
        </div>

        <div className="mt-2 flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
          <button className="text-muted-foreground"><Smile className="h-4 w-4" /></button>
          <button className="text-muted-foreground"><ImageIcon className="h-4 w-4" /></button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={`Message ${tribe.name}`}
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={send}
            disabled={!text.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-full text-primary-foreground disabled:opacity-40"
            style={{ backgroundColor: tribe.colorVar }}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
