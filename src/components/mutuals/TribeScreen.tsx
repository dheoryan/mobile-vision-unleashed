import { useCallback, useEffect, useRef, useState } from "react";
import { AtSign, ChevronLeft, Reply, UsersRound } from "lucide-react";
import { type TribeId, tribeById } from "@/lib/mutuals-data";
import type { Profile } from "./Onboarding";
import { AppHeader } from "./Shared";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { uploadTribeChatImage, signTribeChatUrl } from "@/lib/uploads";
import { useSwipeReply } from "@/hooks/use-swipe-reply";
import { SafetyMenu } from "./SafetyMenu";
import { TribeMark } from "./TribeMark";
import { QuotedBlock } from "./ReplyPreview";
import { MessageThreadSkeleton } from "./Skeleton";
import { TribeRoomLayer, type TribeRoomView } from "./TribeRoomLayer";
import {
  emptyTribeRoomReactions,
  type TribeRoomReaction,
  type TribeVentureDraft,
} from "@/lib/tribe-room";
import { useToggleTribeRoomReaction } from "@/lib/tribe-room-store";
import { ChatMessageActions } from "./ChatMessageActions";
import type { ChatReaction } from "@/lib/chat";
import { ChatComposer } from "./ChatComposer";
import { useTribeMembers } from "@/lib/tribe-members-store";
import type { TribeMemberSummary } from "@/lib/tribe-members";
import { TribeMembersSheet } from "./TribeMembersSheet";

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
  initialTribe,
  onBack,
  onStartVenture,
  onOpenVentures,
  onOpenChats,
  onOpenMemberProfile,
  onOpenMemberThread,
}: {
  profile: Profile;
  setProfile?: (updater: (p: Profile | null) => Profile | null) => void;
  initialTribe?: TribeId;
  /** Present when the room was pushed from Chats rather than mounted as a tab.
   *  Without it there is no way out, because the bottom nav is not rendered
   *  over a room you are inside. */
  onBack?: () => void;
  onStartVenture?: (draft: TribeVentureDraft) => void;
  onOpenVentures?: () => void;
  onOpenChats?: () => void;
  onOpenMemberProfile?: (handle: string) => void;
  onOpenMemberThread?: (userId: string) => void;
}) {
  const { user } = useAuth();
  const initial =
    initialTribe && profile.tribeIds.includes(initialTribe) ? initialTribe : profile.tribeIds[0];
  const [activeTribe, setActiveTribe] = useState<TribeId>(initial);
  const [roomView, setRoomView] = useState<TribeRoomView>("chat");
  const [membersOpen, setMembersOpen] = useState(false);

  useEffect(() => {
    if (!profile.tribeIds.includes(activeTribe)) setActiveTribe(profile.tribeIds[0]);
  }, [profile.tribeIds, activeTribe]);

  useEffect(() => {
    if (initialTribe && profile.tribeIds.includes(initialTribe)) setActiveTribe(initialTribe);
  }, [initialTribe, profile.tribeIds]);

  const tribe = tribeById(activeTribe);
  const isJoined = profile.tribeIds.includes(activeTribe);
  const membersQuery = useTribeMembers(activeTribe, isJoined);
  const onlineMemberIds = useTribePresence(activeTribe, isJoined);
  const members = membersQuery.data?.members ?? [];

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-habitat overscroll-none">
      {onBack && (
        <div className="glass z-30 shrink-0 border-b border-border pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex min-h-12 max-w-md items-center gap-2 px-3 py-1">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Chats"
              className="flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Chats
            </button>
            <span className="flex items-center gap-1.5 truncate">
              <TribeMark tribe={tribe} size="xs" />
              <span className="truncate font-display text-sm font-semibold">{tribe.name}</span>
            </span>
          </div>
        </div>
      )}
      {!onBack && <AppHeader title={tribe.name} subtitle="Chat" accent={tribe.colorVar} />}
      <main className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-hidden px-5 pb-[env(safe-area-inset-bottom)] pt-2">
        <TribeRoomIdentity
          tribe={tribe}
          liveMembers={membersQuery.data?.total}
          liveOnline={onlineMemberIds.size}
          onOpenMembers={() => setMembersOpen(true)}
        />

        <TribeRoomLayer
          tribeId={activeTribe}
          tribeName={tribe.name}
          tribeColor={tribe.colorVar}
          city={profile.city}
          canParticipate={isJoined}
          view={roomView}
          onViewChange={setRoomView}
          onStartVenture={onStartVenture}
          onOpenVentures={onOpenVentures}
          onOpenChats={onOpenChats}
        />

        {/* The shell never scrolls. Chat owns the remaining height and only its
            message pool scrolls; Pulse and Plans are focused sibling views. */}
        <GroupChat
          tribeId={activeTribe}
          canChat={isJoined}
          members={members}
          hidden={roomView !== "chat"}
        />
      </main>
      <TribeMembersSheet
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        tribe={tribe}
        members={members}
        total={membersQuery.data?.total ?? members.length}
        hasMore={membersQuery.data?.has_more ?? false}
        onlineIds={onlineMemberIds}
        currentUserId={user?.id}
        loading={membersQuery.isLoading}
        error={membersQuery.isError}
        onRetry={() => void membersQuery.refetch()}
        onOpenProfile={onOpenMemberProfile}
        onMessage={onOpenMemberThread}
      />
    </div>
  );
}

function useTribePresence(tribeId: TribeId, enabled: boolean) {
  const { user } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!enabled || !user?.id) {
      setOnlineIds(new Set());
      return;
    }

    if (isLocalSupabaseRealtimeDisabled) {
      setOnlineIds(new Set());
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
      setOnlineIds(users);
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

  return onlineIds;
}

function TribeRoomIdentity({
  tribe,
  liveMembers,
  liveOnline,
  onOpenMembers,
}: {
  tribe: ReturnType<typeof tribeById>;
  liveMembers?: number;
  liveOnline: number;
  onOpenMembers: () => void;
}) {
  const memberLabel = liveMembers === undefined ? null : liveMembers.toLocaleString();
  const onlineLabel = liveOnline.toLocaleString();
  return (
    <section className="mt-4 flex items-center gap-3 border-b border-border/70 pb-3">
      <TribeMark tribe={tribe} size="md" decorative={false} />
      <div className="min-w-0 flex-1">
        <p className="label-mono flex items-center gap-1.5 text-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> You're home
        </p>
        <h2 className="truncate font-display text-xl font-bold leading-tight">{tribe.name}</h2>
        <button
          type="button"
          onClick={onOpenMembers}
          className="-ml-2 mt-0.5 flex min-h-11 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground hover:bg-secondary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`View ${memberLabel ?? "Tribe"} members, ${onlineLabel} online`}
        >
          <UsersRound className="h-3.5 w-3.5" />
          <span>
            <span className="text-foreground">{onlineLabel}</span> online
          </span>
          {memberLabel !== null && <span>· {memberLabel} members</span>}
        </button>
      </div>
    </section>
  );
}

type TribeMember = TribeMemberSummary;

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
  room_kind?: string | null;
  reactions: Record<TribeRoomReaction, number>;
  my_reactions: TribeRoomReaction[];
  sender?: TribeMember;
  reply_to?: Pick<
    TribeMessage,
    "id" | "content" | "sender_id" | "attachment_type" | "sender"
  > | null;
};

type TribeMessageRow = Omit<TribeMessage, "sender" | "reply_to">;

function isTribeRoomSchemaUnavailable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    ["PGRST204", "42703"].includes(error.code ?? "") ||
    (error.message ?? "").toLowerCase().includes("room_kind")
  );
}

const CHAT_REACTIONS = ["heart", "laugh", "support"] as const;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function GroupChat({
  tribeId,
  canChat,
  members,
  hidden = false,
}: {
  tribeId: TribeId;
  canChat: boolean;
  members: TribeMember[];
  hidden?: boolean;
}) {
  const tribe = tribeById(tribeId);
  const { user } = useAuth();
  const [dbTribeId, setDbTribeId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TribeMessage[]>([]);
  const [text, setText] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<TribeMember[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<TribeMessage | null>(null);
  const [reactionOpenFor, setReactionOpenFor] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleReaction = useToggleTribeRoomReaction(tribeId);

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

  const loadMessages = useCallback(async () => {
    setMessages([]);
    setReplyTo(null);

    if (!dbTribeId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const enhanced = await supabase
      .from("tribe_messages")
      .select(
        "id, tribe_id, sender_id, content, attachment_url, attachment_type, reply_to_id, mentions, created_at, room_kind",
      )
      .eq("tribe_id", dbTribeId)
      .is("room_kind", null)
      .order("created_at", { ascending: false })
      .limit(100);

    let data = enhanced.data as TribeMessageRow[] | null;
    let error = enhanced.error;
    if (isTribeRoomSchemaUnavailable(error)) {
      const legacy = await supabase
        .from("tribe_messages")
        .select(
          "id, tribe_id, sender_id, content, attachment_url, attachment_type, reply_to_id, mentions, created_at",
        )
        .eq("tribe_id", dbTribeId)
        .order("created_at", { ascending: false })
        .limit(100);
      data = legacy.data as TribeMessageRow[] | null;
      error = legacy.error;
    }

    if (error) {
      toast.error("Couldn't load messages");
      setLoading(false);
      return;
    }

    const rows = [...(data ?? [])].reverse();
    const senderIds = [...new Set(rows.map((row) => row.sender_id))];
    const profileMap: Record<string, TribeMember> = {};
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_emoji, avatar_url")
        .in("id", senderIds);
      (profiles ?? []).forEach((profile) => {
        profileMap[profile.id] = profile;
      });
    }

    const reactionCounts = new Map<string, Record<TribeRoomReaction, number>>();
    const myReactions = new Map<string, TribeRoomReaction[]>();
    const messageIds = rows.map((row) => row.id);
    if (messageIds.length > 0) {
      const { data: reactionRows } = await supabase
        .from("tribe_room_reactions")
        .select("message_id, user_id, reaction")
        .in("message_id", messageIds);
      for (const reaction of (reactionRows ?? []) as Array<{
        message_id: string;
        user_id: string;
        reaction: TribeRoomReaction;
      }>) {
        if (!CHAT_REACTIONS.some((item) => item === reaction.reaction)) continue;
        const counts = reactionCounts.get(reaction.message_id) ?? emptyTribeRoomReactions();
        counts[reaction.reaction] += 1;
        reactionCounts.set(reaction.message_id, counts);
        if (reaction.user_id === user?.id) {
          myReactions.set(reaction.message_id, [
            ...(myReactions.get(reaction.message_id) ?? []),
            reaction.reaction,
          ]);
        }
      }
    }

    const mapped: TribeMessage[] = Array.from(
      new Map(rows.map((row) => [row.id, row])).values(),
    ).map((row) => ({
      id: row.id,
      tribe_id: row.tribe_id,
      sender_id: row.sender_id,
      content: row.content,
      created_at: row.created_at,
      attachment_url: row.attachment_url,
      attachment_type: row.attachment_type,
      reply_to_id: row.reply_to_id,
      mentions: row.mentions ?? [],
      room_kind: row.room_kind,
      reactions: reactionCounts.get(row.id) ?? emptyTribeRoomReactions(),
      my_reactions: myReactions.get(row.id) ?? [],
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
  }, [dbTribeId, user?.id]);

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
          if (row.room_kind) return;
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
                reactions: emptyTribeRoomReactions(),
                my_reactions: [],
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
  };

  const selectImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setSelectedImage(file);
  };

  const reactToMessage = async (message: TribeMessage, reaction: TribeRoomReaction) => {
    if (!canChat || toggleReaction.isPending) return;
    const wasActive = message.my_reactions.includes(reaction);
    setReactionOpenFor(null);
    setMessages((current) =>
      current.map((item) =>
        item.id !== message.id
          ? item
          : {
              ...item,
              my_reactions: wasActive
                ? item.my_reactions.filter((value) => value !== reaction)
                : [...item.my_reactions, reaction],
              reactions: {
                ...item.reactions,
                [reaction]: Math.max(0, item.reactions[reaction] + (wasActive ? -1 : 1)),
              },
            },
      ),
    );
    try {
      await toggleReaction.mutateAsync({ message_id: message.id, reaction });
    } catch (error) {
      setMessages((current) => current.map((item) => (item.id === message.id ? message : item)));
      toast.error(error instanceof Error ? error.message : "Couldn't save reaction");
    }
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

  const composerPlaceholder = !canChat
    ? "Join this Tribe to chat"
    : dbTribeId
      ? `Message ${tribe.name}`
      : "Tribe is not ready yet";

  return (
    <div
      className={cn(
        "relative min-h-0 flex-1 overflow-hidden bg-background",
        hidden ? "hidden" : "flex flex-col",
      )}
    >
      <img
        src={tribe.art}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-contain object-center opacity-[0.07] grayscale"
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-background/60" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="scroll-panel flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-3 py-4">
          {loading && <MessageThreadSkeleton />}
          {!loading && messages.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No messages yet. Be the first voice in the room.
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
                <div className="max-w-[74%]">
                  {!mine && (
                    <p className="mb-0.5 text-[10px] text-muted-foreground">{displayName}</p>
                  )}
                  <div
                    className={cn(
                      "space-y-2 rounded-xl px-3 py-2 text-sm",
                      canChat && "cursor-pointer",
                      mine
                        ? "rounded-br-sm text-primary-foreground"
                        : "rounded-bl-sm border border-border bg-secondary text-foreground",
                    )}
                    style={mine ? { backgroundColor: tribe.colorVar } : undefined}
                    onClick={(event) => {
                      if (!canChat || (event.target as HTMLElement).closest("a, button")) return;
                      setReactionOpenFor((current) => (current === m.id ? null : m.id));
                    }}
                  >
                    {/* Tribe chat had its OWN quote renderer — a filled,
                        rounded box nested inside an already-rounded bubble,
                        painting bg-background/25 over the Tribe colour. Two
                        implementations of the same thing is why fixing the DM
                        one left this one untouched. Both now use QuotedBlock. */}
                    {m.reply_to && (
                      <QuotedBlock
                        mine={mine}
                        accentColor={tribe.colorVar}
                        name={
                          m.reply_to.sender_id === user?.id
                            ? "You"
                            : (m.reply_to.sender?.display_name ?? "Member")
                        }
                        snippet={
                          m.reply_to.content ||
                          (m.reply_to.attachment_type === "image" ? "Photo" : "Message")
                        }
                      />
                    )}
                    {m.attachment_url && m.attachment_type === "image" && (
                      <ChatAttachmentImage value={m.attachment_url} />
                    )}

                    {m.content?.trim() && (
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    )}
                  </div>
                  <ChatMessageActions
                    open={reactionOpenFor === m.id}
                    mine={mine}
                    senderName={displayName}
                    reactions={{
                      heart: m.reactions.heart,
                      laugh: m.reactions.laugh,
                      support: m.reactions.support,
                    }}
                    myReactions={m.my_reactions.filter(
                      (reaction): reaction is ChatReaction =>
                        reaction === "heart" || reaction === "laugh" || reaction === "support",
                    )}
                    disabled={!canChat}
                    onToggleOpen={() =>
                      setReactionOpenFor((current) => (current === m.id ? null : m.id))
                    }
                    onReact={(reaction) => void reactToMessage(m, reaction)}
                    onReply={() => {
                      setReplyTo(m);
                      setReactionOpenFor(null);
                    }}
                  />
                  <div
                    className={cn(
                      "mt-1 flex items-center text-[10px] text-muted-foreground",
                      mine && "justify-end",
                    )}
                  >
                    <span>{formatTime(m.created_at)}</span>
                  </div>
                </div>
                {!mine && (
                  <SafetyMenu
                    targetName={displayName}
                    targetUserId={m.sender_id}
                    className="self-start -mt-1 shrink-0"
                  />
                )}
              </SwipeReplyRow>
            );
          })}
          <div ref={endRef} />
        </div>

        <ChatComposer
          inputRef={inputRef}
          value={text}
          onChange={setText}
          onSend={() => void send()}
          placeholder={composerPlaceholder}
          accentColor={tribe.colorVar}
          replyTo={
            replyTo
              ? {
                  id: replyTo.id,
                  name:
                    replyTo.sender_id === user?.id
                      ? "yourself"
                      : (replyTo.sender?.display_name ?? "Member"),
                  snippet:
                    replyTo.content || (replyTo.attachment_type === "image" ? "Photo" : "Message"),
                }
              : null
          }
          onCancelReply={() => setReplyTo(null)}
          selectedImage={selectedImage}
          onSelectImage={(file) => selectImage(file)}
          onClearImage={clearAttachment}
          disabled={!canChat || !dbTribeId}
          sending={sending}
          accessory={
            mentionSuggestions.length > 0 ? (
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
                        <img
                          src={member.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
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
            ) : null
          }
        />
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

function ChatAttachmentImage({ value }: { value: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    signTribeChatUrl(value).then((signed) => {
      if (active) setUrl(signed);
    });
    return () => {
      active = false;
    };
  }, [value]);

  if (!url) {
    return <div className="h-40 w-full animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-xl border border-white/10"
    >
      <img src={url} alt="Chat attachment" className="max-h-64 w-full object-cover" />
    </a>
  );
}
