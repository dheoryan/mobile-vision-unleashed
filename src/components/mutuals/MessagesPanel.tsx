import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Handshake,
  Loader2,
  MessageCircle,
  Reply,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import {
  useMarkThreadRead,
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
import { timeAgo, timeAgoLabel } from "@/lib/time";
import { cn } from "@/lib/utils";
import { showPlusBadge } from "@/lib/feature-flags";
import { requestPushPrompt } from "@/lib/push-prompt-events";
import { toast } from "sonner";
import { useSwipeReply } from "@/hooks/use-swipe-reply";
import { QuotedBlock, parseQuotedMessage } from "./ReplyPreview";
import { FeatureIllustration } from "./FeatureIllustration";
import {
  useAnswerHello,
  useContactStatus,
  useIncomingHellos,
  useSendHello,
} from "@/lib/social-store";
import messagesArt from "@/assets/app-illustrations/messages.webp";
import { SafetyMenu } from "./SafetyMenu";
import { ConversationListSkeleton, MessageThreadSkeleton } from "./Skeleton";
import { ChatComposer, type ChatReplyTarget } from "./ChatComposer";
import { ChatMessageActions } from "./ChatMessageActions";
import { ChatAttachment } from "./ChatAttachment";
import { useOptimisticChatReactions } from "@/lib/chat-store";
import { removeChatAttachment, uploadChatImage } from "@/lib/uploads";
import type { ChatReaction } from "@/lib/chat";

type ReplyTarget = ChatReplyTarget;

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
      <div className="absolute inset-0 mx-auto flex max-w-md flex-col bg-background shadow-2xl">
        {ventureThread ? (
          <VenturePartyThread venture={ventureThread} onBack={onClose} />
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
          <Thread otherId={threadId} onBack={onClose} />
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
      const isHost = venture.host_id === user?.id;
      const isAcceptedMember = venture.my_application?.status === "accepted";

      // Completed rooms remain available as read-only memories. That is where
      // the post-Venture participant recap and Moot actions live.
      if (isHost || isAcceptedMember) {
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
      <div className="scroll-panel flex-1 overflow-y-auto">
        <IncomingHellos />
        {isLoading ? (
          <div className="px-3 py-2">
            <ConversationListSkeleton />
          </div>
        ) : !hasDirectThreads && !hasPartyThreads ? (
          /* Top-level empty inbox only. Inside an open conversation the
             composer stays the visual priority — no artwork there. */
          <div className="p-10 text-center">
            <FeatureIllustration src={messagesArt} />
            <p className="mt-4 text-sm text-muted-foreground">
              No messages yet. Active Venture party chats will appear here after you host or join
              one.
            </p>
          </div>
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
  const isComplete = venture.status === "closed" || !!venture.closed_at || !!venture.ended_at;
  const preview = last
    ? `${isMine ? "You" : lastSenderName}: ${last.content || (last.attachment_type === "image" ? "Photo" : "Message")}`
    : isComplete
      ? "Venture complete · reconnect with your party"
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
              {isComplete ? "Memory" : "Party"}
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
            <TribeBadge tribe={tribe} />
          </div>
          <p
            className={cn(
              "truncate text-xs",
              t.unread_count && !isMine ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {isMine ? "You: " : ""}
            {t.last_message.content ||
              (t.last_message.attachment_type === "image" ? "Photo" : "Message")}
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

function useVentureComplete(venture: VentureParty) {
  const lifecycleComplete =
    venture.status === "closed" || !!venture.closed_at || !!venture.ended_at;
  const [scheduledComplete, setScheduledComplete] = useState(false);

  useEffect(() => {
    if (lifecycleComplete || !venture.ends_at) {
      setScheduledComplete(false);
      return;
    }

    const end = Date.parse(venture.ends_at);
    if (!Number.isFinite(end)) return;
    let timer: number | undefined;
    const schedule = () => {
      const delay = end - Date.now();
      if (delay <= 0) {
        setScheduledComplete(true);
        return;
      }
      timer = window.setTimeout(schedule, Math.min(delay + 250, 2_147_000_000));
    };
    schedule();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [lifecycleComplete, venture.ends_at]);

  return lifecycleComplete || scheduledComplete;
}

function VentureMootPerson({
  person,
  ventureTitle,
}: {
  person: VentureProfileLite;
  ventureTitle: string;
}) {
  const tribe = tribeOf(person.tribe_ids);
  const contact = useContactStatus(person.id);
  const send = useSendHello();
  const answer = useAnswerHello();
  const status = contact.data?.hello_status ?? null;
  const accepting = answer.isPending && answer.variables?.hello_id === contact.data?.hello_id;
  const requesting = send.isPending && send.variables?.recipient_id === person.id;
  const busy = accepting || requesting;

  const requestMoot = () => {
    const safeTitle = ventureTitle.trim().slice(0, 100) || "our Venture";
    send.mutate(
      {
        recipient_id: person.id,
        message: `We completed “${safeTitle}” together. Want to stay connected as Moots?`,
      },
      {
        onSuccess: () => toast.success(`Moot request sent to ${displayVentureName(person)}.`),
        onError: (error) => toast.error((error as Error).message),
      },
    );
  };

  const acceptMoot = () => {
    if (!contact.data?.hello_id) return;
    answer.mutate(
      { hello_id: contact.data.hello_id, status: "accepted" },
      {
        onSuccess: () => toast.success(`${displayVentureName(person)} is now your Moot.`),
        onError: (error) => toast.error((error as Error).message),
      },
    );
  };

  let action: React.ReactNode;
  if (contact.isLoading) {
    action = <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  } else if (status === "accepted") {
    action = (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
        <Check className="h-3.5 w-3.5" /> Moots
      </span>
    );
  } else if (status === "pending" && contact.data?.awaiting_my_answer) {
    action = (
      <button
        type="button"
        onClick={acceptMoot}
        disabled={busy}
        className="inline-flex min-h-8 items-center gap-1 rounded-full bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {accepting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Handshake className="h-3.5 w-3.5" />
        )}
        Accept
      </button>
    );
  } else if (status === "pending") {
    action = <span className="text-[11px] font-semibold text-primary">Requested</span>;
  } else if (status === "declined") {
    action = <span className="text-[11px] text-muted-foreground">Unavailable</span>;
  } else {
    const noRequestsLeft = contact.data?.hellos_left_this_month === 0;
    action = (
      <button
        type="button"
        onClick={requestMoot}
        disabled={busy || noRequestsLeft}
        title={noRequestsLeft ? "Your Hello allowance resets next month." : undefined}
        className="inline-flex min-h-8 items-center gap-1 rounded-full border border-primary/50 px-3 text-[11px] font-semibold text-primary disabled:opacity-40"
      >
        {requesting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <UserPlus className="h-3.5 w-3.5" />
        )}
        Add as Moot
      </button>
    );
  }

  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-background/45 p-2.5">
      <Avatar value={avatarOf(person)} size={9} tribeColor={tribe.colorVar} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{displayVentureName(person)}</p>
        <p className="truncate text-[10px] text-muted-foreground">{tribe.name}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  );
}

function VentureMootRecap({ venture }: { venture: VentureParty }) {
  const { user } = useAuth();
  const participants = useMemo(() => {
    const map = new Map<string, VentureProfileLite>();
    if (venture.host) map.set(venture.host.id, venture.host);
    for (const application of venture.applications) {
      if (application.status === "accepted" && application.applicant) {
        map.set(application.applicant.id, application.applicant);
      }
    }
    return Array.from(map.values()).filter((person) => person.id !== user?.id);
  }, [user?.id, venture.applications, venture.host]);

  return (
    <section className="my-4 rounded-2xl border border-primary/35 bg-primary/[0.07] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <UsersRound className="h-4 w-4" />
        </span>
        <div>
          <p className="label-mono text-primary">Venture complete</p>
          <h3 className="mt-1 font-display text-lg font-bold">Keep the good people.</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            You finished this Venture together. Moot requests are mutual—nobody is added until they
            accept.
          </p>
        </div>
      </div>

      {participants.length ? (
        <ul className="mt-4 space-y-2">
          {participants.map((person) => (
            <VentureMootPerson key={person.id} person={person} ventureTitle={venture.title} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          No other completed participants to reconnect with.
        </p>
      )}
    </section>
  );
}

function VenturePartyThread({ venture, onBack }: { venture: VentureParty; onBack: () => void }) {
  const { user } = useAuth();
  const { data: msgs, isLoading } = useVentureMessages(venture.id, true);
  const send = useSendVentureMessage(venture.id);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [actionOpenFor, setActionOpenFor] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isComplete = useVentureComplete(venture);
  const chatReactions = useOptimisticChatReactions("venture");

  useEffect(() => {
    if (!msgs?.length) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs, isComplete]);

  const submit = async () => {
    const body = text.trim();
    if ((!body && !selectedImage) || !user?.id || uploading) return;
    setUploading(true);
    let uploadedPath: string | null = null;
    try {
      uploadedPath = selectedImage
        ? await uploadChatImage(user.id, "venture", venture.id, selectedImage)
        : null;
      await send.mutateAsync({
        content: body || null,
        attachment_url: uploadedPath,
        attachment_type: uploadedPath ? "image" : null,
        reply_to_id: replyTo?.id ?? null,
      });
      setText("");
      setReplyTo(null);
      setSelectedImage(null);
      requestPushPrompt("venture");
    } catch (error) {
      if (uploadedPath) void removeChatAttachment(uploadedPath).catch(() => undefined);
      toast.error(error instanceof Error ? error.message : "Couldn't send message");
    } finally {
      setUploading(false);
    }
  };

  const startReply = (m: VentureMessage) => {
    const mine = m.sender_id === user?.id;
    setReplyTo({
      id: m.id,
      name: mine ? "yourself" : displayVentureName(m.sender),
      snippet: m.content || (m.attachment_type === "image" ? "Photo" : "Message"),
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
            {isComplete ? "Venture memory" : "Party chat"} · {memberCount}/{venture.max_slots} slots
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="scroll-panel flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <MessageThreadSkeleton />
        ) : !msgs?.length ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No messages yet.
          </p>
        ) : (
          msgs.map((m: VentureMessage) => {
            const mine = m.sender_id === user?.id;
            const pending = m.id.startsWith("tmp-");
            const senderName = mine ? "You" : displayVentureName(m.sender);
            const reactionState = chatReactions.stateFor(m);
            return (
              <MessageSwipeRow
                key={m.id}
                mine={mine}
                accentColor="var(--color-primary)"
                disabled={pending || isComplete}
                onReply={() => startReply(m)}
              >
                <div className={cn("flex max-w-[88%] items-start gap-1", pending && "opacity-60")}>
                  {(() => {
                    const legacy = parseQuotedMessage(m.content ?? "");
                    const quote = m.reply_to
                      ? {
                          name:
                            m.reply_to.sender_id === user?.id
                              ? "You"
                              : displayVentureName(m.reply_to.sender),
                          snippet:
                            m.reply_to.content ||
                            (m.reply_to.attachment_type === "image" ? "Photo" : "Message"),
                        }
                      : legacy.quote;
                    const messageBody = m.reply_to ? (m.content ?? "") : legacy.body;
                    return (
                      <div className="min-w-0">
                        <div
                          className={cn(
                            "space-y-2 rounded-xl px-3 py-2 text-sm shadow-sm",
                            !pending && "cursor-pointer",
                            mine
                              ? "rounded-br-sm bg-primary text-white"
                              : "rounded-bl-sm bg-card text-foreground",
                          )}
                          onClick={(event) => {
                            if (pending || (event.target as HTMLElement).closest("a, button"))
                              return;
                            setActionOpenFor((current) => (current === m.id ? null : m.id));
                          }}
                        >
                          {!mine && (
                            <p className="text-[10px] font-semibold opacity-70">{senderName}</p>
                          )}
                          {quote && (
                            <QuotedBlock
                              name={quote.name}
                              snippet={quote.snippet}
                              mine={mine}
                              accentColor="var(--color-primary)"
                            />
                          )}
                          {m.attachment_url && m.attachment_type === "image" && (
                            <ChatAttachment value={m.attachment_url} />
                          )}
                          {messageBody && (
                            <p className="whitespace-pre-wrap leading-relaxed">{messageBody}</p>
                          )}
                        </div>
                        <ChatMessageActions
                          open={actionOpenFor === m.id}
                          mine={mine}
                          senderName={senderName}
                          reactions={reactionState.reactions}
                          myReactions={reactionState.my_reactions}
                          disabled={pending || isComplete}
                          onToggleOpen={() =>
                            setActionOpenFor((current) => (current === m.id ? null : m.id))
                          }
                          onReact={(reaction: ChatReaction) => {
                            setActionOpenFor(null);
                            void chatReactions
                              .toggle(m, reaction)
                              .catch((error) =>
                                toast.error(
                                  error instanceof Error ? error.message : "Couldn't save reaction",
                                ),
                              );
                          }}
                          onReply={() => {
                            startReply(m);
                            setActionOpenFor(null);
                          }}
                        />
                        <p
                          className={cn(
                            "mt-1 text-[10px] text-muted-foreground",
                            mine && "text-right",
                          )}
                        >
                          {pending ? "sending…" : shortTime(m.created_at)}
                        </p>
                      </div>
                    );
                  })()}
                  {!mine && !pending && (
                    <SafetyMenu
                      targetName={displayVentureName(m.sender)}
                      targetUserId={m.sender_id}
                      className="-mt-1 shrink-0"
                    />
                  )}
                </div>
              </MessageSwipeRow>
            );
          })
        )}
        {isComplete && <VentureMootRecap venture={venture} />}
      </div>

      <div className={cn("shrink-0", isComplete && "p-3")}>
        {isComplete ? (
          <div className="rounded-xl border border-border bg-card px-4 py-3 text-center">
            <p className="text-xs font-semibold">This party chat is now a memory.</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Add someone as a Moot above to keep talking one-to-one.
            </p>
          </div>
        ) : (
          <ChatComposer
            inputRef={inputRef}
            value={text}
            onChange={setText}
            onSend={() => void submit()}
            placeholder={replyTo ? "Write a reply…" : "Message the party"}
            accentColor="var(--color-primary)"
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            selectedImage={selectedImage}
            onSelectImage={setSelectedImage}
            onClearImage={() => setSelectedImage(null)}
            disabled={isComplete}
            sending={uploading || send.isPending}
          />
        )}
      </div>
    </div>
  );
}

function Thread({ otherId, onBack }: { otherId: string; onBack: () => void }) {
  const { user } = useAuth();
  const { data: other } = useProfileById(otherId);
  const { data: msgs, isLoading } = useThreadMessages(otherId);
  const send = useSendMessage(otherId);
  const markRead = useMarkThreadRead(otherId);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [actionOpenFor, setActionOpenFor] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const tribe = tribeOf(other?.tribe_ids);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatReactions = useOptimisticChatReactions("dm");
  const unreadIncomingIds = (msgs ?? [])
    .filter((message) => message.sender_id !== user?.id && !message.read_at)
    .map((message) => message.id)
    .join("|");
  const lastMessageId = msgs?.[msgs.length - 1]?.id;

  useEffect(() => {
    if (unreadIncomingIds) markRead.mutate();
    // The unread id signature changes only when the server returns a new set.
    // The mutation object itself is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadIncomingIds, otherId]);

  useEffect(() => {
    if (!lastMessageId) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lastMessageId, otherId]);

  const submit = async () => {
    const body = text.trim();
    if ((!body && !selectedImage) || !user?.id || uploading) return;
    setUploading(true);
    let uploadedPath: string | null = null;
    try {
      uploadedPath = selectedImage
        ? await uploadChatImage(user.id, "dm", otherId, selectedImage)
        : null;
      await send.mutateAsync({
        content: body || null,
        attachment_url: uploadedPath,
        attachment_type: uploadedPath ? "image" : null,
        reply_to_id: replyTo?.id ?? null,
      });
      setText("");
      setReplyTo(null);
      setSelectedImage(null);
      requestPushPrompt("dm");
    } catch (error) {
      if (uploadedPath) void removeChatAttachment(uploadedPath).catch(() => undefined);
      toast.error(error instanceof Error ? error.message : "Couldn't send message");
    } finally {
      setUploading(false);
    }
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
        <SafetyMenu
          targetName={other?.display_name?.trim() || other?.handle || "this user"}
          targetUserId={otherId}
          className="shrink-0"
        />
      </header>

      <div ref={scrollRef} className="scroll-panel flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <MessageThreadSkeleton />
        ) : !msgs?.length ? (
          <p className="py-10 text-center text-xs text-muted-foreground">Say hi 👋</p>
        ) : (
          msgs.map((m) => {
            const mine = m.sender_id === user?.id;
            const pending = m.id.startsWith("tmp-");
            const senderName = mine ? "yourself" : other?.display_name?.trim() || "Them";
            const actionName = mine ? "You" : other?.display_name?.trim() || "Them";
            const reactionState = chatReactions.stateFor(m);
            return (
              <MessageSwipeRow
                key={m.id}
                mine={mine}
                accentColor={tribe.colorVar}
                disabled={pending}
                onReply={() => {
                  setReplyTo({
                    id: m.id,
                    name: senderName,
                    snippet: m.content || (m.attachment_type === "image" ? "Photo" : "Message"),
                  });
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
              >
                <div className={cn("max-w-[80%]", pending && "opacity-60")}>
                  {(() => {
                    const legacy = parseQuotedMessage(m.content ?? "");
                    const quote = m.reply_to
                      ? {
                          name: m.reply_to.sender_id === user?.id ? "You" : actionName,
                          snippet:
                            m.reply_to.content ||
                            (m.reply_to.attachment_type === "image" ? "Photo" : "Message"),
                        }
                      : legacy.quote;
                    const messageBody = m.reply_to ? (m.content ?? "") : legacy.body;
                    return (
                      <div
                        className={cn(
                          "space-y-2 rounded-xl px-3 py-2 text-sm shadow-sm",
                          !pending && "cursor-pointer",
                          mine
                            ? "rounded-br-sm text-white"
                            : "rounded-bl-sm bg-card text-foreground",
                        )}
                        style={mine ? { backgroundColor: tribe.colorVar } : undefined}
                        onClick={(event) => {
                          if (pending || (event.target as HTMLElement).closest("a, button")) return;
                          setActionOpenFor((current) => (current === m.id ? null : m.id));
                        }}
                      >
                        {quote && (
                          <QuotedBlock
                            name={quote.name}
                            snippet={quote.snippet}
                            mine={mine}
                            accentColor={tribe.colorVar}
                          />
                        )}
                        {m.attachment_url && m.attachment_type === "image" && (
                          <ChatAttachment value={m.attachment_url} />
                        )}
                        {messageBody && (
                          <p className="whitespace-pre-wrap break-words">{messageBody}</p>
                        )}
                      </div>
                    );
                  })()}
                  <ChatMessageActions
                    open={actionOpenFor === m.id}
                    mine={mine}
                    senderName={actionName}
                    reactions={reactionState.reactions}
                    myReactions={reactionState.my_reactions}
                    disabled={pending}
                    onToggleOpen={() =>
                      setActionOpenFor((current) => (current === m.id ? null : m.id))
                    }
                    onReact={(reaction: ChatReaction) => {
                      setActionOpenFor(null);
                      void chatReactions
                        .toggle(m, reaction)
                        .catch((error) =>
                          toast.error(
                            error instanceof Error ? error.message : "Couldn't save reaction",
                          ),
                        );
                    }}
                    onReply={() => {
                      setReplyTo({
                        id: m.id,
                        name: senderName,
                        snippet: m.content || (m.attachment_type === "image" ? "Photo" : "Message"),
                      });
                      setActionOpenFor(null);
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                  />
                  <p
                    className={cn("mt-0.5 text-[10px] text-muted-foreground", mine && "text-right")}
                  >
                    {pending ? "sending…" : timeAgoLabel(m.created_at)}
                  </p>
                </div>
              </MessageSwipeRow>
            );
          })
        )}
      </div>

      <ChatComposer
        inputRef={inputRef}
        value={text}
        onChange={setText}
        onSend={() => void submit()}
        placeholder={replyTo ? "Write a reply…" : "Message"}
        accentColor={tribe.colorVar}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        selectedImage={selectedImage}
        onSelectImage={setSelectedImage}
        onClearImage={() => setSelectedImage(null)}
        sending={uploading || send.isPending}
      />
    </div>
  );
}

/**
 * Hellos waiting on an answer, pinned above the inbox.
 *
 * A request that arrives with no obvious place to answer it is the same as no
 * request at all, so this sits at the top of Messages rather than behind a
 * separate screen. Accepting opens a normal thread; declining is final, which
 * is stated before the user taps.
 */
function IncomingHellos() {
  const hellos = useIncomingHellos();
  const answer = useAnswerHello();
  const rows = hellos.data ?? [];

  if (!rows.length) return null;

  return (
    <section className="border-b border-border bg-primary/5">
      <p className="label-mono px-5 pb-2 pt-4 text-muted-foreground">
        {rows.length === 1 ? "1 Hello" : `${rows.length} Hellos`} waiting
      </p>
      <ul className="space-y-2 px-5 pb-4">
        {rows.map((h) => {
          const name = h.other?.display_name?.trim() || "Someone";
          const avatar = h.other?.avatar_url || h.other?.avatar_emoji || "👋";
          const isImg = avatar.startsWith("http") || avatar.startsWith("data:");
          const busy = answer.isPending && answer.variables?.hello_id === h.id;
          return (
            <li key={h.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-lg">
                  {isImg ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    avatar
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  {h.other?.handle && (
                    <p className="truncate text-[11px] text-muted-foreground">@{h.other.handle}</p>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-foreground">{h.message}</p>
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busy}
                  onClick={() =>
                    answer.mutate(
                      { hello_id: h.id, status: "accepted" },
                      {
                        onSuccess: () => toast.success(`You can now message ${name}`),
                        onError: (e) => toast.error((e as Error).message),
                      },
                    )
                  }
                  className="flex-1 rounded-full bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                >
                  Accept
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    answer.mutate(
                      { hello_id: h.id, status: "declined" },
                      {
                        onSuccess: () =>
                          toast("Hello declined.", { description: "They can't send another." }),
                        onError: (e) => toast.error((e as Error).message),
                      },
                    )
                  }
                  className="flex-1 rounded-full border border-border py-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
                >
                  Decline
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
