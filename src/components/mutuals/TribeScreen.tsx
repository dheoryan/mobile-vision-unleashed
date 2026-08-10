import { useCallback, useEffect, useRef, useState } from "react";
import { AtSign, Image as ImageIcon, Reply, Send, Smile, X } from "lucide-react";
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
import { uploadTribeChatImage, signTribeChatUrl } from "@/lib/uploads";
import { useSwipeReply } from "@/hooks/use-swipe-reply";

function SwipeReplyRow({
  children,
  mine,
  tribeColor,
  disabled,
  onReply,
}: {
  children: React.ReactNode;
  mine: boolean;
  tribeColor: string;
  disabled?: boolean;
  onReply: () => void;
}) {
  const { dragX, peekOpacity, handlers } = useSwipeReply(onReply, disabled);
  return (
    <div className="relative select-none">
      {dragX > 4 && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-start pl-2 text-muted-foreground"
          style={{ opacity: peekOpacity }}
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: `color-mix(in oklab, ${tribeColor} 28%, transparent)` }}
          >
            <Reply className="h-3.5 w-3.5" />
          </span>
        </div>
      )}
      <div
        {...handlers}
        className={cn("group flex items-end gap-2 touch-pan-y", mine && "flex-row-reverse")}
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

const isLocalSupabaseRealtimeDisabled =
  import.meta.env.VITE_SUPABASE_URL?.includes("127.0.0.1") ||
  import.meta.env.VITE_SUPABASE_URL?.includes("localhost");

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
  const initial =
    initialTribe && profile.tribeIds.includes(initialTribe) ? initialTribe : profile.tribeIds[0];
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
      <AppHeader
        title={tribe.name}
        subtitle="Chat"
        accent={tribe.colorVar}
        onOpenMessages={onOpenMessages}
        unread={unread}
      />
      <main className="mx-auto max-w-md px-5 pt-3">
        {/* Tribe strip - Plus users with multi-tribe */}
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

        {/* Group Chat - full screen, no toggle */}
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
  joined,
  active,
  onChange,
  canAdd,
  onAdd,
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
                  isActive ? "" : "opacity-60",
                )}
                style={{
                  backgroundColor: `color-mix(in oklab, ${t.colorVar} 22%, transparent)`,
                  boxShadow: isActive ? `0 0 0 2px ${t.colorVar}` : undefined,
                }}
              >
                {t.emoji}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
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

    if (isLocalSupabaseRealtimeDisabled) {
      setCount(0);
      console.warn("[tribe presence] disabled in local dev");
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
          void channel.track({
            user_id: user.id,
            tribe_id: tribeId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [enabled, tribeId, user?.id]);

  return count;
}

function TribeBanner({
  tribe,
  liveMembers,
  liveOnline,
}: {
  tribe: ReturnType<typeof tribeById>;
  liveMembers?: number;
  liveOnline: number;
}) {
  const memberLabel = (liveMembers ?? tribe.members).toLocaleString();
  const onlineLabel = liveOnline.toLocaleString();
  return (
    <section
      className="relative mt-5 overflow-hidden rounded-2xl border border-border p-5"
      style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${tribe.colorVar} 38%, var(--card)) 0%, var(--card) 75%)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-40 blur-3xl"
        style={{ backgroundColor: tribe.colorVar }}
      />
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

type TribeMember = {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_emoji?: string | null;
  avatar_url: string | null;
};

type TribeMessage = {
  id: string;
  tribe_id: string;
  sender_id: string;
  content: string | null;
  created_at: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  reply_to_id?: string | null;
  mentions?: string[] | null;
  sender?: TribeMember;
  reply_to?: Pick<
    TribeMessage,
    "id" | "content" | "sender_id" | "attachment_type" | "sender"
  > | null;
};

const QUICK_EMOJIS = [
  "😀",
  "😂",
  "😍",
  "🔥",
  "✨",
  "👏",
  "🙏",
  "😭",
  "🥹",
  "😎",
  "🎵",
  "☕",
  "🌙",
  "🐾",
  "💬",
  "✅",
];

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function GroupChat({ tribeId, canChat }: { tribeId: TribeId; canChat: boolean }) {
  const tribe = tribeById(tribeId);
  const { user } = useAuth();
  const [dbTribeId, setDbTribeId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TribeMessage[]>([]);
  const [members, setMembers] = useState<TribeMember[]>([]);
  const [text, setText] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<TribeMember[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<TribeMessage | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    const resolveDbTribeId = async () => {
      setMessages([]);
      setReplyTo(null);

      if (!tribeId) {
        setDbTribeId(null);
        return;
      }

      if (isUuid(tribeId)) {
        setDbTribeId(tribeId);
        return;
      }

      setDbTribeId(null);
      const { data, error } = await supabase
        .from("tribes")
        .select("id, name")
        .eq("name", tribe.name)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data?.id) {
        console.error("Failed to resolve DB tribe id", error);
        toast.error("Tribe is not ready yet. Please try again.");
        setDbTribeId(null);
        return;
      }

      setDbTribeId(data.id);
    };

    void resolveDbTribeId();

    return () => {
      cancelled = true;
    };
  }, [tribeId, tribe.name]);

  useEffect(() => {
    if (!selectedImage) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedImage);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedImage]);

  // Fetch tribe members for sender names, avatars, and @mentions.
  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, display_name, handle, avatar_emoji, avatar_url")
      .contains("tribe_ids", [tribeId])
      .order("display_name", { ascending: true })
      .limit(100)
      .then(({ data }) => {
        setMembers((data ?? []) as TribeMember[]);
      });
  }, [tribeId]);

  const loadMessages = useCallback(async () => {
    setMessages([]);
    setReplyTo(null);

    if (!dbTribeId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("tribe_messages")
      .select(
        "id, tribe_id, sender_id, content, attachment_url, attachment_type, reply_to_id, mentions, created_at",
      )
      .eq("tribe_id", dbTribeId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      toast.error("Couldn't load messages");
      setLoading(false);
      return;
    }

    const rows = data ?? [];
    const senderIds = [...new Set(rows.map((r: any) => r.sender_id))];
    let profileMap: Record<string, TribeMember> = {};
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_emoji, avatar_url")
        .in("id", senderIds);
      (profiles ?? []).forEach((p: any) => {
        profileMap[p.id] = p;
      });
    }

    const mapped: TribeMessage[] = Array.from(
      new Map(rows.map((row: any) => [row.id, row])).values(),
    ).map((row: any) => ({
      id: row.id,
      tribe_id: row.tribe_id,
      sender_id: row.sender_id,
      content: row.content,
      created_at: row.created_at,
      attachment_url: row.attachment_url,
      attachment_type: row.attachment_type,
      reply_to_id: row.reply_to_id,
      mentions: row.mentions ?? [],
      sender: profileMap[row.sender_id],
    }));
    const byId = new Map(mapped.map((m) => [m.id, m]));
    setMessages(
      mapped.map((m) => ({
        ...m,
        reply_to: m.reply_to_id ? (byId.get(m.reply_to_id) ?? null) : null,
      })),
    );
    setLoading(false);
  }, [dbTribeId]);

  // Fetch existing messages from the dedicated Tribe chat table.
  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!dbTribeId) return;
    if (isLocalSupabaseRealtimeDisabled) {
      console.warn("[tribe realtime] disabled in local dev");
      return;
    }

    const channel = supabase
      .channel(`tribe-chat:${dbTribeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tribe_messages",
          filter: `tribe_id=eq.${dbTribeId}`,
        },
        async (payload) => {
          const row = payload.new as TribeMessage;
          // Fetch sender profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, display_name, handle, avatar_emoji, avatar_url")
            .eq("id", row.sender_id)
            .single();
          setMessages((prev) => {
            if (prev.some((message) => message.id === row.id)) return prev;

            return [
              ...prev,
              {
                ...row,
                sender: (profile as TribeMember | null) ?? undefined,
                reply_to: row.reply_to_id
                  ? (prev.find((m) => m.id === row.reply_to_id) ?? null)
                  : null,
              },
            ];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dbTribeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const mentionQuery = getMentionQuery(text);
  const mentionSuggestions =
    mentionQuery === null
      ? []
      : members
          .filter((m) => m.id !== user?.id)
          .filter((m) => {
            const q = mentionQuery.toLowerCase();
            return (
              m.display_name.toLowerCase().includes(q) || (m.handle ?? "").toLowerCase().includes(q)
            );
          })
          .slice(0, 5);

  const clearAttachment = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addEmoji = (emoji: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`;
    setText(next);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const pos = start + emoji.length;
      inputRef.current?.setSelectionRange(pos, pos);
    });
  };

  const addMention = (member: TribeMember) => {
    const label = mentionLabel(member);
    const next = text.replace(/(^|\s)@([a-zA-Z0-9_.-]{0,40})$/, `$1${label} `);
    setText(next);
    setSelectedMentions((prev) =>
      prev.some((m) => m.id === member.id) ? prev : [...prev, member],
    );
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const send = async () => {
    if (!canChat || !user || sending) return;
    if (!dbTribeId) {
      toast.error("Tribe is not ready yet. Please try again.");
      return;
    }
    const cleanContent = text.trim();
    if (!cleanContent && !selectedImage) return;

    setSending(true);
    try {
      let attachmentUrl: string | null = null;
      if (selectedImage) {
        attachmentUrl = await uploadTribeChatImage(dbTribeId, user.id, selectedImage);
      }

      const mentionIds = new Set(selectedMentions.map((m) => m.id));
      for (const member of members) {
        if (member.id === user.id) continue;
        const label = mentionLabel(member).toLowerCase();
        if (cleanContent.toLowerCase().includes(label)) mentionIds.add(member.id);
      }

      const payload = {
        tribe_id: dbTribeId,
        sender_id: user.id,
        content: cleanContent,
        attachment_url: attachmentUrl,
        attachment_type: attachmentUrl ? "image" : null,
        reply_to_id: replyTo?.id ?? null,
        mentions: [...mentionIds],
      };

      const { error } = await supabase.from("tribe_messages").insert(payload);

      if (error) throw error;
      setText("");
      setReplyTo(null);
      setSelectedMentions([]);
      clearAttachment();
      await loadMessages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const chatDisabled = !canChat || !dbTribeId || sending;
  const composerPlaceholder = !canChat
    ? "Join this Tribe to chat"
    : dbTribeId
      ? `Message ${tribe.name}`
      : "Tribe is not ready yet";

  return (
    <div className="mt-4">
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto px-1 py-1">
          {loading && <p className="py-6 text-center text-xs text-muted-foreground">Loading...</p>}
          {!loading && messages.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No messages yet. Say hello! 👋
            </p>
          )}
          {messages.map((m) => {
            const isSystem = m.attachment_type === "system:tribe_join";
            const mine = m.sender_id === user?.id;
            const displayName = mine ? "You" : (m.sender?.display_name ?? "Member");
            const avatarUrl = m.sender?.avatar_url;

            if (isSystem) {
              return (
                <div key={m.id} className="flex justify-center py-1">
                  <div className="max-w-[82%] rounded-full border border-border bg-secondary/70 px-3 py-1.5 text-center text-[11px] leading-snug text-muted-foreground">
                    <span>{m.content}</span>
                    <span className="ml-1 opacity-70">{formatTime(m.created_at)}</span>
                  </div>
                </div>
              );
            }

            return (
              <SwipeReplyRow
                key={m.id}
                tribeColor={tribe.colorVar}
                mine={mine}
                disabled={!canChat}
                onReply={() => setReplyTo(m)}
              >
                {!mine && (
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 28%, transparent)`,
                    }}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      displayName[0]?.toUpperCase()
                    )}
                  </span>
                )}
                <div className="max-w-[78%]">
                  {!mine && (
                    <p className="mb-0.5 text-[10px] text-muted-foreground">{displayName}</p>
                  )}
                  <div
                    className={cn(
                      "space-y-2 rounded-2xl px-3 py-2 text-sm",
                      mine
                        ? "rounded-br-sm text-primary-foreground"
                        : "rounded-bl-sm bg-secondary text-foreground",
                    )}
                    style={mine ? { backgroundColor: tribe.colorVar } : undefined}
                  >
                    {m.reply_to && (
                      <div
                        className={cn(
                          "rounded-xl border-l-2 bg-background/25 px-2 py-1 text-[11px] leading-snug",
                          mine
                            ? "border-black/30 text-primary-foreground/80"
                            : "border-primary/50 text-muted-foreground",
                        )}
                      >
                        <p className="font-medium">
                          {m.reply_to.sender_id === user?.id
                            ? "You"
                            : (m.reply_to.sender?.display_name ?? "Member")}
                        </p>
                        <p className="line-clamp-2">
                          {m.reply_to.content ||
                            (m.reply_to.attachment_type === "image" ? "Photo" : "Message")}
                        </p>
                      </div>
                    )}
                    {m.attachment_url && m.attachment_type === "image" && (
                      <ChatAttachmentImage value={m.attachment_url} />
                    )}

                    {m.content?.trim() && (
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    )}
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground",
                      mine && "justify-end",
                    )}
                  >
                    <span>{formatTime(m.created_at)}</span>
                    {canChat && (
                      <button
                        type="button"
                        onClick={() => setReplyTo(m)}
                        className="inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                      >
                        <Reply className="h-3 w-3" /> Reply
                      </button>
                    )}
                  </div>
                </div>
              </SwipeReplyRow>
            );
          })}
          <div ref={endRef} />
        </div>

        <div className="relative mt-2">
          {emojiOpen && (
            <div className="absolute bottom-full left-0 z-20 mb-2 grid w-60 grid-cols-8 gap-1 rounded-2xl border border-border bg-popover p-2 shadow-xl">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => addEmoji(emoji)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-base hover:bg-secondary"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {mentionSuggestions.length > 0 && (
            <div className="absolute bottom-full left-8 right-8 z-20 mb-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <AtSign className="h-3 w-3" /> Mention members
              </div>
              {mentionSuggestions.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => addMention(member)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-secondary"
                >
                  <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (member.avatar_emoji ?? member.display_name[0])
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {member.display_name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {mentionLabel(member)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {(replyTo || selectedImage) && (
            <div className="mb-2 space-y-2 rounded-2xl border border-border bg-background/80 p-2">
              {replyTo && (
                <div className="flex items-start gap-2">
                  <Reply className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="font-medium text-foreground">
                      Replying to{" "}
                      {replyTo.sender_id === user?.id
                        ? "yourself"
                        : (replyTo.sender?.display_name ?? "Member")}
                    </p>
                    <p className="truncate text-muted-foreground">
                      {replyTo.content ||
                        (replyTo.attachment_type === "image" ? "Photo" : "Message")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {selectedImage && imagePreviewUrl && (
                <div className="flex items-center gap-3">
                  <img
                    src={imagePreviewUrl}
                    alt="Selected attachment"
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="truncate font-medium text-foreground">{selectedImage.name}</p>
                    <p className="text-muted-foreground">Ready to send</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearAttachment}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
              disabled={chatDisabled}
              onClick={() => setEmojiOpen((v) => !v)}
              aria-label="Add emoji"
            >
              <Smile className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
              disabled={chatDisabled}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach image"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!file.type.startsWith("image/")) {
                  toast.error("Please choose an image file");
                  return;
                }
                setSelectedImage(file);
              }}
            />
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setEmojiOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={composerPlaceholder}
              disabled={chatDisabled}
              className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
            />
            <button
              onClick={() => void send()}
              disabled={chatDisabled || (!text.trim() && !selectedImage)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-primary-foreground disabled:opacity-40"
              style={{ backgroundColor: tribe.colorVar }}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getMentionQuery(value: string) {
  const match = /(?:^|\s)@([a-zA-Z0-9_.-]{0,40})$/.exec(value);
  return match ? match[1] : null;
}

function mentionLabel(member: TribeMember) {
  if (member.handle) return `@${member.handle.replace(/^@/, "")}`;
  return `@${member.display_name.replace(/\s+/g, "")}`;
}
