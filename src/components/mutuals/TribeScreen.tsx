import { useEffect, useRef, useState } from "react";
import { Plus, Send, Smile, Image as ImageIcon, Lock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { TRIBES, CHAT_BY_TRIBE, type TribeId, tribeById, personById } from "@/lib/mutuals-data";
import type { Profile } from "./Onboarding";
import { PostCard } from "./PostCard";
import { AppHeader, SectionTitle } from "./Shared";
import { ComposerModal } from "./ComposerModal";
import { AddTribeSheet } from "./AddTribeSheet";
import { useFeedPosts, useTribeMemberCounts } from "@/lib/posts-store";
import { useBlocked } from "@/lib/blocked-store";
import { cn } from "@/lib/utils";
import { isPlusEffective, MONETIZATION_ENABLED } from "@/lib/feature-flags";

export function TribeScreen({
  profile,
  setProfile,
  onOpenMessages,
  unread,
  initialTribe,
}: {
  profile: Profile;
  setProfile?: (updater: (p: Profile | null) => Profile | null) => void;
  onOpenMessages: () => void;
  unread?: number;
  initialTribe?: TribeId;
}) {
  const isPlus = isPlusEffective(profile.plan);
  const showUpgrade = MONETIZATION_ENABLED && profile.plan !== "plus";
  const joinedTribes = TRIBES.filter((t) => profile.tribeIds.includes(t.id));
  const initial = initialTribe && profile.tribeIds.includes(initialTribe) ? initialTribe : profile.tribeIds[0];
  const [activeTribe, setActiveTribe] = useState<TribeId>(initial);
  const [view, setView] = useState<"feed" | "chat">("feed");
  const [composerOpen, setComposerOpen] = useState(false);
  const [addTribeOpen, setAddTribeOpen] = useState(false);

  // If profile.tribeIds changes (e.g. user joined a new tribe), keep activeTribe valid.
  useEffect(() => {
    if (!profile.tribeIds.includes(activeTribe)) setActiveTribe(profile.tribeIds[0]);
  }, [profile.tribeIds, activeTribe]);

  // Honor a freshly-requested initial tribe (e.g. tap from Discover).
  useEffect(() => {
    if (initialTribe && profile.tribeIds.includes(initialTribe)) setActiveTribe(initialTribe);
  }, [initialTribe, profile.tribeIds]);

  const tribe = tribeById(activeTribe);
  const feedQuery = useFeedPosts(activeTribe);
  const blocked = useBlocked();
  const tribePosts = (feedQuery.data ?? []).filter((p) => !blocked.has(p.author_id));
  const isJoined = profile.tribeIds.includes(activeTribe);

  return (
    <div className="bg-habitat min-h-screen pb-28">
      <AppHeader title={tribe.name} subtitle="Home base" accent={tribe.colorVar} onOpenMessages={onOpenMessages} unread={unread} />
      <main className="mx-auto max-w-md px-5 pt-3">
        {/* Tribe strip — only Plus users with multi-tribe see it. Free users hide it. */}
        {isPlus && (
          <TribeStrip
            joined={joinedTribes}
            active={activeTribe}
            onChange={setActiveTribe}
            canAdd={profile.tribeIds.length < 3}
            onAdd={() => setAddTribeOpen(true)}
          />
        )}

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

            {/* Free users: subtle multi-tribe upsell card */}
            {showUpgrade && (
              <Link
                to="/upgrade"
                className="mt-5 block rounded-2xl border border-dashed border-border bg-card p-4 transition-colors hover:bg-secondary"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400">
                    <Lock className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Join more Tribes</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      MUTUALS+ lets you join up to 3 Tribes and expand your social world.
                    </p>
                  </div>
                </div>
                <span className="mt-3 block w-full rounded-xl bg-amber-400/15 py-2 text-center text-xs font-semibold text-amber-300">
                  Upgrade to MUTUALS+
                </span>
              </Link>
            )}
          </>
        ) : (
          <GroupChat tribeId={activeTribe} canChat={isJoined} />
        )}
      </main>

      {view === "feed" && isJoined && (
        <button
          onClick={() => setComposerOpen(true)}
          className="fixed bottom-24 right-5 z-30 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/40 transition-transform active:scale-95"
          style={{ backgroundColor: tribe.colorVar }}
          aria-label="New post"
        >
          <Plus className="h-4 w-4" /> Post
        </button>
      )}

      <ComposerModal open={composerOpen} onClose={() => setComposerOpen(false)} tribeId={activeTribe} />
      <AddTribeSheet
        open={addTribeOpen}
        onClose={() => setAddTribeOpen(false)}
        profile={profile}
        setProfile={setProfile}
        onJoined={(id) => setActiveTribe(id)}
      />
    </div>
  );
}

function TribeStrip({
  joined, active, onChange, canAdd, onAdd,
}: {
  joined: ReturnType<typeof tribeById>[];
  active: TribeId;
  onChange: (id: TribeId) => void;
  canAdd: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-3">
        {joined.map((t) => {
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

        {canAdd && (
          <button
            onClick={onAdd}
            className="flex shrink-0 flex-col items-center gap-1.5 active:scale-95"
            aria-label="Add tribe"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-amber-400/60 text-amber-300">
              <Plus className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">Add Tribe</span>
          </button>
        )}
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

function GroupChat({ tribeId, canChat }: { tribeId: TribeId; canChat: boolean }) {
  const tribe = tribeById(tribeId);
  const seed = CHAT_BY_TRIBE[tribeId];
  const [messages, setMessages] = useState(seed);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMessages(CHAT_BY_TRIBE[tribeId]); }, [tribeId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = () => {
    if (!canChat) return;
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
          <button className="text-muted-foreground" disabled={!canChat}><Smile className="h-4 w-4" /></button>
          <button className="text-muted-foreground" disabled={!canChat}><ImageIcon className="h-4 w-4" /></button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={canChat ? `Message ${tribe.name}` : "Join this Tribe to chat"}
            disabled={!canChat}
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
          />
          <button
            onClick={send}
            disabled={!canChat || !text.trim()}
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
