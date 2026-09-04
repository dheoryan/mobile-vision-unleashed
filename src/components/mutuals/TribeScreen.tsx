import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowBendUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowBendUpLeft";
import { AtIcon } from "@phosphor-icons/react/dist/csr/At";
import { CalendarPlusIcon } from "@phosphor-icons/react/dist/csr/CalendarPlus";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
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
import { ChatMessageOwnMenu } from "./ChatMessageOwnMenu";
import { UnsendConfirm } from "./UnsendConfirm";
import { CHAT_REACTIONS, isChatReaction } from "@/lib/chat";
import { ChatComposer } from "./ChatComposer";
import { useTribeMembers } from "@/lib/tribe-members-store";
import type { TribeMemberSummary } from "@/lib/tribe-members";
import { TribeMembersSheet } from "./TribeMembersSheet";
import { NotificationBell } from "./NotificationBell";
import { applyMention, collectMentionIds, mentionRangeAtCaret } from "@/lib/mentions";
import {
  chatBubbleShape,
  chatGroupPosition,
  chatGroupSpacing,
  endsChatGroup,
  startsChatGroup,
} from "@/lib/chat-grouping";
import { useVisualViewport, visualViewportStyle } from "@/hooks/use-visual-viewport";
import { useStickToBottomOnKeyboard } from "@/hooks/use-stick-to-bottom";

function SwipeReplyRow({
  children,
  mine,
  tribeColor,
  disabled,
  onReply,
  onLongPress,
  className,
}: {
  children: React.ReactNode;
  mine: boolean;
  tribeColor: string;
  disabled?: boolean;
  onReply: () => void;
  onLongPress?: () => void;
  className?: string;
}) {
  const { dragX, peekOpacity, ready, handlers } = useSwipeReply(onReply, disabled, onLongPress);
  return (
    <div className={cn("relative select-none", className)}>
      {dragX > 4 && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-start pl-2 text-muted-foreground"
          style={{ opacity: peekOpacity }}
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full transition-transform"
            style={{
              backgroundColor: `color-mix(in oklab, ${tribeColor} 28%, transparent)`,
              transform: `scale(${ready ? 1.12 : 0.9})`,
            }}
          >
            <ArrowBendUpLeftIcon className="h-3.5 w-3.5" />
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
}) {
  const { user } = useAuth();
  const initial =
    initialTribe && profile.tribeIds.includes(initialTribe) ? initialTribe : profile.tribeIds[0];
  const [activeTribe, setActiveTribe] = useState<TribeId>(initial);
  const [roomView, setRoomView] = useState<TribeRoomView>("chat");
  const [planOpen, setPlanOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const visualViewport = useVisualViewport(true);

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
  const newPlanButton = isJoined ? (
    <button
      type="button"
      onClick={() => setPlanOpen(true)}
      aria-label="New plan"
      className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <CalendarPlusIcon className="h-5 w-5" />
    </button>
  ) : null;

  return (
    <div
      className="flex min-h-0 flex-col overflow-hidden bg-habitat overscroll-none"
      style={visualViewportStyle(visualViewport)}
    >
      {onBack && (
        <header className="glass z-30 shrink-0 border-b border-border pt-[env(safe-area-inset-top)]">
          <div className="flex w-full items-center gap-3 px-4 py-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to Chats"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <CaretLeftIcon className="h-5 w-5" />
            </button>
            <TribeMark tribe={tribe} size="sm" className="h-9 w-9" decorative={false} />
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              className="min-h-11 min-w-0 flex-1 rounded-lg text-left transition-colors hover:text-foreground active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`View ${membersQuery.data?.total ?? members.length} Tribe members, ${onlineMemberIds.size} online`}
            >
              <h1 className="truncate font-display text-sm font-semibold leading-tight">
                {tribe.name}
              </h1>
              <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <UsersIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {onlineMemberIds.size} online · {membersQuery.data?.total ?? members.length}{" "}
                  members
                </span>
              </span>
            </button>
            <div className="flex shrink-0 items-center">
              {newPlanButton}
              <NotificationBell />
            </div>
          </div>
        </header>
      )}
      {!onBack && (
        <AppHeader
          title={tribe.name}
          subtitle="Chat"
          accent={tribe.colorVar}
          action={newPlanButton}
        />
      )}
      <main className="flex min-h-0 w-full flex-1 flex-col overflow-hidden pt-2">
        {!onBack && (
          <div className="shrink-0 px-2">
            <TribeRoomIdentity
              tribe={tribe}
              liveMembers={membersQuery.data?.total}
              liveOnline={onlineMemberIds.size}
              onOpenMembers={() => setMembersOpen(true)}
            />
          </div>
        )}

        <div
          className={cn(
            "flex min-h-0 flex-col px-2",
            roomView === "chat" ? "shrink-0" : "flex-1 overflow-hidden",
          )}
        >
          <TribeRoomLayer
            tribeId={activeTribe}
            tribeName={tribe.name}
            tribeColor={tribe.colorVar}
            city={profile.city}
            canParticipate={isJoined}
            view={roomView}
            onViewChange={setRoomView}
            planOpen={planOpen}
            onPlanOpenChange={setPlanOpen}
            onStartVenture={onStartVenture}
            onOpenVentures={onOpenVentures}
            onOpenChats={onOpenChats}
          />
        </div>

        {/* The shell never scrolls. Chat owns the remaining height and only its
            message pool scrolls; Pulse and Plans keep the page gutter while
            live chat uses only its own compact message/composer padding. */}
        <GroupChat
          tribeId={activeTribe}
          canChat={isJoined}
          members={members}
          hidden={roomView !== "chat"}
          keyboardOpen={visualViewport.keyboardOpen}
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
  return (
    <section className="mt-4 flex items-center gap-3 border-b border-border/70 pb-3">
      <TribeMark tribe={tribe} size="md" decorative={false} />
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-display text-xl font-bold leading-tight">{tribe.name}</h2>
        <RoomMemberStatus
          liveMembers={liveMembers}
          liveOnline={liveOnline}
          onOpenMembers={onOpenMembers}
        />
      </div>
    </section>
  );
}

function RoomMemberStatus({
  liveMembers,
  liveOnline,
  onOpenMembers,
}: {
  liveMembers?: number;
  liveOnline: number;
  onOpenMembers: () => void;
}) {
  const memberLabel = liveMembers === undefined ? null : liveMembers.toLocaleString();
  const onlineLabel = liveOnline.toLocaleString();

  return (
    <button
      type="button"
      onClick={onOpenMembers}
      className="-ml-2 mt-0.5 flex min-h-11 items-center gap-1.5 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`View ${memberLabel ?? "Tribe"} members, ${onlineLabel} online`}
    >
      <UsersIcon className="h-3.5 w-3.5" />
      <span>
        <span className="text-foreground">{onlineLabel}</span> online
      </span>
      {memberLabel !== null && <span>· {memberLabel} members</span>}
    </button>
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
  edited_at?: string | null;
  deleted_at?: string | null;
  reactions: Record<TribeRoomReaction, number>;
  my_reactions: TribeRoomReaction[];
  sender?: TribeMember;
  reply_to?: Pick<
    TribeMessage,
    "id" | "content" | "sender_id" | "attachment_type" | "sender" | "deleted_at"
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

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function GroupChat({
  tribeId,
  canChat,
  members,
  hidden = false,
  keyboardOpen = false,
}: {
  tribeId: TribeId;
  canChat: boolean;
  members: TribeMember[];
  hidden?: boolean;
  keyboardOpen?: boolean;
}) {
  const tribe = tribeById(tribeId);
  const { user } = useAuth();
  const [dbTribeId, setDbTribeId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TribeMessage[]>([]);
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<TribeMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmUnsendId, setConfirmUnsendId] = useState<string | null>(null);
  const [moreOptionsFor, setMoreOptionsFor] = useState<string | null>(null);
  const [reactionOpenFor, setReactionOpenFor] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
        "id, tribe_id, sender_id, content, attachment_url, attachment_type, reply_to_id, mentions, created_at, room_kind, edited_at, deleted_at",
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
      edited_at: row.edited_at ?? null,
      deleted_at: row.deleted_at ?? null,
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tribe_messages",
          filter: `tribe_id=eq.${dbTribeId}`,
        },
        (payload) => {
          // Edit/unsend - the only two things that ever UPDATE a chat row
          // here. Structured Room items live in this same table but this
          // screen only ever holds room_kind-null rows in state to begin
          // with, so there's nothing to match for those.
          const row = payload.new as TribeMessage;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === row.id
                ? {
                    ...message,
                    content: row.content,
                    attachment_url: row.attachment_url,
                    attachment_type: row.attachment_type,
                    edited_at: row.edited_at ?? null,
                    deleted_at: row.deleted_at ?? null,
                  }
                : message,
            ),
          );
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
  useStickToBottomOnKeyboard(listRef, endRef, keyboardOpen);

  const mentionRange = mentionRangeAtCaret(text, caret);
  const mentionSuggestions =
    mentionRange === null
      ? []
      : members
          .filter((m) => m.id !== user?.id)
          .filter((m) => Boolean(m.handle))
          .filter((m) => {
            const q = mentionRange.query.toLowerCase();
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
    if (!member.handle || !mentionRange) return;
    const next = applyMention(text, caret, mentionRange.start, member.handle);
    setText(next.text);
    setCaret(next.caret);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(next.caret, next.caret);
    });
  };

  const startEdit = (message: TribeMessage) => {
    setReplyTo(null);
    setEditingId(message.id);
    setText(message.content ?? "");
    setCaret(0);
    setReactionOpenFor(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // Direct-client updates, same as `send`'s direct-client insert above -
  // enforce_tribe_message_edit_fields (20260904010000) is the real gate,
  // this just patches local state and rolls back on error.
  const saveEdit = async (id: string, content: string) => {
    const previous = messages;
    const editedAt = new Date().toISOString();
    setMessages((current) =>
      current.map((item) => (item.id === id ? { ...item, content, edited_at: editedAt } : item)),
    );
    const { error } = await supabase.from("tribe_messages").update({ content }).eq("id", id);
    if (error) {
      setMessages(previous);
      toast.error(error.message);
    }
  };

  const unsendMessage = async (id: string) => {
    const previous = messages;
    setMessages((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              content: "",
              attachment_url: null,
              attachment_type: null,
              deleted_at: new Date().toISOString(),
            }
          : item,
      ),
    );
    // tribe_messages.deleted_at (20260904010000) isn't in the generated
    // Database types yet - same "migration is live, types.ts hasn't caught
    // up" situation as commentsTable in posts.functions.ts. `as any` here
    // rather than a table-wide helper since this is the only tribe_messages
    // write in this file that touches the unlanded column.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("tribe_messages") as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setMessages(previous);
      toast.error(error.message);
    }
  };

  const send = async () => {
    if (editingId) {
      const cleanContent = text.trim();
      if (!cleanContent) return;
      const id = editingId;
      setText("");
      setCaret(0);
      setEditingId(null);
      await saveEdit(id, cleanContent);
      return;
    }
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

      const mentionRegistry = new Map(
        members.flatMap((member) =>
          member.handle
            ? [[member.handle.replace(/^@/, "").toLowerCase(), member.id] as const]
            : [],
        ),
      );

      const payload = {
        tribe_id: dbTribeId,
        sender_id: user.id,
        content: cleanContent,
        attachment_url: attachmentUrl,
        attachment_type: attachmentUrl ? "image" : null,
        reply_to_id: replyTo?.id ?? null,
        mentions: collectMentionIds(cleanContent, mentionRegistry),
      };

      const { error } = await supabase.from("tribe_messages").insert(payload);

      if (error) throw error;
      setText("");
      setCaret(0);
      setReplyTo(null);
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
        <div
          ref={listRef}
          className="scroll-panel flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-2 py-4"
        >
          {loading && <MessageThreadSkeleton />}
          {!loading && messages.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No messages yet. Be the first voice in the room.
            </p>
          )}
          {messages.map((m, index) => {
            const isSystem = m.attachment_type === "system:tribe_join";
            const groupPosition = chatGroupPosition(
              messages,
              index,
              (message) => message.attachment_type === "system:tribe_join",
            );
            const groupStart = startsChatGroup(groupPosition);
            const groupEnd = endsChatGroup(groupPosition);
            const mine = m.sender_id === user?.id;
            const displayName = mine ? "You" : (m.sender?.display_name ?? "Member");
            const avatarUrl = m.sender?.avatar_url;

            if (isSystem) {
              return (
                <div key={m.id} className="my-3 flex items-center gap-3 px-4" role="status">
                  <span className="h-px flex-1 bg-border/70" aria-hidden="true" />
                  <p className="max-w-[72%] text-center text-[10px] leading-relaxed text-muted-foreground">
                    {m.content} · {formatTime(m.created_at)}
                  </p>
                  <span className="h-px flex-1 bg-border/70" aria-hidden="true" />
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
                onLongPress={!canChat || m.deleted_at ? undefined : () => setReactionOpenFor(m.id)}
                className={chatGroupSpacing(groupPosition)}
              >
                {!mine && groupStart && (
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center self-start overflow-hidden rounded-full text-sm"
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
                {!mine && !groupStart && <span aria-hidden="true" className="h-7 w-7 shrink-0" />}
                <div className="min-w-0 max-w-[78%]">
                  {!mine && groupStart && (
                    <p className="mb-1 px-1 text-[10px] font-medium text-muted-foreground">
                      {displayName}
                    </p>
                  )}
                  {m.deleted_at ? (
                    <div
                      className={cn(
                        "border px-3.5 py-2.5 text-sm italic text-muted-foreground",
                        chatBubbleShape(groupPosition, mine),
                        "border-border/80 bg-card/60",
                      )}
                    >
                      Message removed
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "space-y-2 border px-3.5 py-2.5 text-sm leading-relaxed",
                        chatBubbleShape(groupPosition, mine),
                        canChat && "cursor-pointer",
                        mine
                          ? "border-transparent text-primary-foreground"
                          : "border-border/80 bg-card/95 text-foreground",
                      )}
                      style={
                        mine
                          ? {
                              backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 76%, var(--color-card))`,
                            }
                          : undefined
                      }
                      onClick={(event) => {
                        if (!canChat || (event.target as HTMLElement).closest("a, button")) return;
                        if (reactionOpenFor === m.id) setReactionOpenFor(null);
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
                            m.reply_to.deleted_at
                              ? "Message removed"
                              : m.reply_to.content ||
                                (m.reply_to.attachment_type === "image" ? "Photo" : "Message")
                          }
                        />
                      )}
                      {m.attachment_url && m.attachment_type === "image" && (
                        <ChatAttachmentImage value={m.attachment_url} />
                      )}

                      {m.content?.trim() && (
                        <p className="whitespace-pre-wrap break-words">
                          {m.content}
                          {m.edited_at && (
                            <span className="ml-1.5 text-[10px] italic opacity-70">(edited)</span>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                  <ChatMessageActions
                    open={reactionOpenFor === m.id}
                    mine={mine}
                    senderName={displayName}
                    reactions={{
                      heart: m.reactions.heart,
                      laugh: m.reactions.laugh,
                      wow: m.reactions.wow,
                      sad: m.reactions.sad,
                      like: m.reactions.like,
                      support: m.reactions.support,
                    }}
                    myReactions={m.my_reactions.filter(isChatReaction)}
                    disabled={!canChat || Boolean(m.deleted_at)}
                    onToggleOpen={() =>
                      setReactionOpenFor((current) => (current === m.id ? null : m.id))
                    }
                    onReact={(reaction) => void reactToMessage(m, reaction)}
                    onReply={() => {
                      setReplyTo(m);
                      setReactionOpenFor(null);
                    }}
                    onMoreOptions={mine ? () => setMoreOptionsFor(m.id) : undefined}
                  />
                  <ChatMessageOwnMenu
                    open={moreOptionsFor === m.id}
                    onOpenChange={(next) => setMoreOptionsFor(next ? m.id : null)}
                    canEdit={!m.attachment_url}
                    onEdit={() => startEdit(m)}
                    onUnsend={() => setConfirmUnsendId(m.id)}
                  />
                  {groupEnd && (
                    <p
                      className={cn(
                        "mt-1 px-1 text-[10px] text-muted-foreground",
                        mine && "text-right",
                      )}
                    >
                      {formatTime(m.created_at)}
                    </p>
                  )}
                </div>
                {!mine && groupStart && (
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
          onCaretChange={setCaret}
          onSend={() => void send()}
          placeholder={editingId ? "Edit message…" : composerPlaceholder}
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
          editingSnippet={editingId ? "Update the text below, then send to save" : null}
          onCancelEdit={() => {
            setEditingId(null);
            setText("");
            setCaret(0);
          }}
          selectedImage={selectedImage}
          onSelectImage={(file) => selectImage(file)}
          onClearImage={clearAttachment}
          disabled={!canChat || !dbTribeId}
          sending={sending}
          keyboardOpen={keyboardOpen}
          outerClassName="!px-2"
          accessory={
            mentionSuggestions.length > 0 ? (
              <div className="absolute bottom-full left-8 right-8 z-20 mb-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
                <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  <AtIcon className="h-3 w-3" /> Mention members
                </div>
                {mentionSuggestions.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => addMention(member)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary active:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
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
                        @{member.handle?.replace(/^@/, "")}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null
          }
        />
      </div>
      <UnsendConfirm
        open={confirmUnsendId != null}
        onCancel={() => setConfirmUnsendId(null)}
        onConfirm={() => {
          if (!confirmUnsendId) return;
          const id = confirmUnsendId;
          setConfirmUnsendId(null);
          void unsendMessage(id);
        }}
      />
    </div>
  );
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
