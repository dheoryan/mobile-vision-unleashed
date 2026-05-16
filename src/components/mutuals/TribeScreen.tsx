import { useEffect, useRef, useState } from "react";
import { Send, Smile, Image as ImageIcon } from "lucide-react";
import { TRIBES, type TribeId, tribeById } from "@/lib/mutuals-data";
import type { Profile } from "./Onboarding";
import { AppHeader } from "./Shared";
import { AddTribeSheet } from "./AddTribeSheet";
import { useTribeMemberCounts } from "@/lib/posts-store";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { isPlusEffective, MONETIZATION_ENABLED } from "@/lib/feature-flags";
import { toast } from "sonner";

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
  const joinedTribes = TRIBES.filter((t) => profile.tribeIds.includes(t.id));
  const initial = initialTribe && profile.tribeIds.includes(initialTribe) ? initialTribe : profile.tribeIds[0];
  const [activeTribe, setActiveTribe] = useState<TribeId>(initial);
  const [addTribeOpen, setAddTribeOpen] = useState(false);

  useEffect(() => {
    if (!profile.tribeIds.includes(activeTribe)) setActiveTribe(profile.tribeIds[0]);
  }, [profile.tribeIds, activeTribe]);

  useEffect(() => {
    if (initialTribe && profile.tribeIds.includes(initialTribe)) setActiveTribe(initialTribe);
  }, [initialTribe, profile.tribeIds]);

  const tribe = tribeById(activeTribe);
  const isJoined = profile.tribeIds.includes(activeTribe);
  const countsQuery = useTribeMemberCounts(profile.tribeIds);
  const liveMembers = countsQuery.data?.[activeTribe];
  const liveOnline = useTribeOnlineCount(activeTribe, isJoined);

  return (
    <div className="bg-habitat min-h-screen pb-28">
      <AppHeader title={tribe.name} subtitle="Chat" accent={tribe.colorVar} onOpenMessages={onOpenMessages} unread={unread} />
      <main className="mx-auto max-w-md px-5 pt-3">
        {/* Tribe strip — Plus users with multi-tribe */}
        {isPlus && (
          <TribeStrip
            joined={joinedTribes}
            active={activeTribe}
            onChange={setActiveTribe}
            canAdd={profile.tribeIds.length < 3}
            onAdd={() => setAddTribeOpen(true)}
          />
        )}

        <TribeBanner tribe={tribe} liveMembers={liveMembers} liveOnline={liveOnline} />

        {/* Group Chat — full screen, no toggle */}
        <GroupChat tribeId={activeTribe} canChat={isJoined} />
      </main>

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
              +
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">Add Tribe</span>
          </button>
        )}
      </div>
    </div>
  );
}

function useTribeOnlineCount(tribeId: TribeId, enabled: boolean) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled || !user?.id) {
      setCount(0);
      return;
    }

    const channel = supabase.channel(`tribe-online:${tribeId}`, {
      config: { presence: { key: user.id } },
    });

    const syncCount = () => {
      const state = channel.presenceState<{ user_id?: string }>();
      const users = new Set<string>();
      Object.values(state).forEach((entries) => {
        entries.forEach((entry) => {
          if (entry.user_id) users.add(entry.user_id);
        });
      });
      setCount(users.size);
    };

    channel
      .on("presence", { event: "sync" }, syncCount)
      .on("presence", { event: "join" }, syncCount)
      .on("presence", { event: "leave" }, syncCount)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ user_id: user.id, tribe_id: tribeId, online_at: new Date().toISOString() });
        }
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [enabled, tribeId, user?.id]);

  return count;
}

function TribeBanner({ tribe, liveMembers, liveOnline }: { tribe: ReturnType<typeof tribeById>; liveMembers?: number; liveOnline: number }) {
  const memberLabel = (liveMembers ?? tribe.members).toLocaleString();
  const onlineLabel = liveOnline.toLocaleString();
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
          </div>
          <p className="text-sm text-muted-foreground">{tribe.scene}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="text-foreground">{onlineLabel}</span> online · {memberLabel} members
          </p>
        </div>
      </div>
    </section>
  );
}

type TribeMessage = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { display_name: string; avatar_url: string | null };
};

function GroupChat({ tribeId, canChat }: { tribeId: TribeId; canChat: boolean }) {
  const tribe = tribeById(tribeId);
  const { user } = useAuth();
  const [messages, setMessages] = useState<TribeMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  // Fetch existing messages
  useEffect(() => {
    setLoading(true);
    setMessages([]);

    supabase
      .from("tribe_messages")
      .select("id, sender_id, content, created_at, profiles:sender_id(display_name, avatar_url)")
      .eq("tribe_id", tribeId)
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data, error }) => {
        if (error) {
          toast.error("Couldn't load messages");
          return;
        }
        const mapped = (data ?? []).map((row: any) => ({
          id: row.id,
          sender_id: row.sender_id,
          content: row.content,
          created_at: row.created_at,
          sender: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
        }));
        setMessages(mapped);
        setLoading(false);
      });
  }, [tribeId]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`tribe-chat:${tribeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tribe_messages", filter: `tribe_id=eq.${tribeId}` },
        async (payload) => {
          const row = payload.new as TribeMessage;
          // Fetch sender profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("id", row.sender_id)
            .single();
          setMessages((prev) => [
            ...prev,
            { ...row, sender: profile ?? undefined },
          ]);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tribeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!canChat || !user) return;
    const t = text.trim();
    if (!t) return;
    setText("");

    const { error } = await supabase.from("tribe_messages").insert({
      tribe_id: tribeId,
      sender_id: user.id,
      content: t,
    });

    if (error) {
      toast.error("Failed to send message");
      setText(t);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="mt-4">
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto px-1 py-1">
          {loading && (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          )}
          {!loading && messages.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No messages yet. Say hello! 👋
            </p>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === user?.id;
            const displayName = mine ? "You" : (m.sender?.display_name ?? "Member");
            const avatarUrl = m.sender?.avatar_url;

            return (
              <div key={m.id} className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
                {!mine && (
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm"
                    style={{ backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 28%, transparent)` }}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      displayName[0]?.toUpperCase()
                    )}
                  </span>
                )}
                <div className={cn("max-w-[78%]")}>
                  {!mine && <p className="mb-0.5 text-[10px] text-muted-foreground">{displayName}</p>}
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm",
                      mine ? "rounded-br-sm text-primary-foreground" : "rounded-bl-sm bg-secondary text-foreground"
                    )}
                    style={mine ? { backgroundColor: tribe.colorVar } : undefined}
                  >
                    {m.content}
                  </div>
                  <p className={cn("mt-0.5 text-[10px] text-muted-foreground", mine && "text-right")}>
                    {formatTime(m.created_at)}
                  </p>
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
