import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HandIcon } from "@phosphor-icons/react/dist/csr/Hand";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { ChatCircleDotsIcon } from "@phosphor-icons/react/dist/csr/ChatCircleDots";
import { AppHeader } from "./Shared";
import { TribeMark } from "./TribeMark";
import { readableAccentColor, TRIBES, tribeById, type TribeId } from "@/lib/mutuals-data";
import type { Profile } from "./Onboarding";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useThreads } from "@/lib/messages-store";
import type { DMThreadSummary } from "@/lib/messages.functions";
import { useIncomingHellos, useMyMoots } from "@/lib/social-store";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { useMyJoinedVentures, useMyHostedVentures } from "@/lib/ventures-store";
import type { VentureParty } from "@/lib/ventures.functions";
import { useBlocked } from "@/lib/blocked-store";
import { timeAgoLabel } from "@/lib/time";
import { cn } from "@/lib/utils";
import { timingLabel } from "@/lib/venture-time";
import { ConversationListSkeleton } from "./Skeleton";

type Filter = "all" | "tribe" | "ventures" | "direct";

type UnifiedChatItem =
  | {
      kind: "tribe";
      key: string;
      lastAt: string;
      unreadCount: number;
    }
  | {
      kind: "venture";
      key: string;
      lastAt: string;
      unreadCount: 0;
      venture: VentureParty;
      memory: boolean;
    }
  | {
      kind: "direct";
      key: string;
      lastAt: string;
      unreadCount: number;
      thread: DMThreadSummary;
    };

/**
 * Unread state, and the one thing this screen deliberately cannot do yet.
 *
 * `messages` carries `read_at`, so DM threads have a real unread count. Tribe
 * rooms now have a per-user pointer too. Venture rooms still do not, so this
 * intentionally returns no fabricated badge for them.
 *
 * That is fine today and it is why this indirection exists rather than a
 * scattering of `undefined`s: adding a `conversation_reads` table later turns
 * this one function into a lookup, and nothing else on the screen changes.
 * Shipping the badge is a product decision (an unread dot is an attention
 * signal, and this app already has notifications doing that job), so it is
 * deliberately not being made here.
 */
function unreadFor(_kind: "venture", _conversationId: string): number | null {
  return null;
}

type TribeSummary = {
  dbTribeId: string;
  lastContent: string | null;
  lastSenderName: string | null;
  lastAt: string | null;
  lastDeleted: boolean;
  memberCount: number | null;
  unreadCount: number;
};

/** One query for the tribe row: resolve the tribe, take its newest message. */
function useTribeChatSummary(tribeName: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["chats", "tribe-summary", tribeName, user?.id ?? null],
    enabled: !!user && !!tribeName,
    staleTime: 10_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<TribeSummary | null> => {
      const { data: tribeRow } = await supabase
        .from("tribes")
        .select("id")
        .eq("name", tribeName as string)
        .maybeSingle();
      if (!tribeRow?.id) return null;

      // Match the actual Tribe Chat screen, which only ever shows plain
      // messages (room_kind is null) - a structured Room item (a Tribevia
      // answer, a shared plan, ...) can be the newest tribe_messages row
      // overall without ever appearing there, which previously surfaced it
      // as this preview's "last message" even though tapping in couldn't
      // find it.
      // tribe_messages.deleted_at (20260904010000) isn't in the generated
      // Database types yet, same lag as elsewhere - `as any` on this one
      // query keeps that from breaking every other typed tribe_messages
      // read in the file.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rows } = await (supabase.from("tribe_messages") as any)
        .select("content, created_at, sender_id, deleted_at")
        .eq("tribe_id", tribeRow.id)
        .is("room_kind", null)
        .order("created_at", { ascending: false })
        .limit(1);

      const last = rows?.[0] ?? null;
      let senderName: string | null = null;
      if (last?.sender_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", last.sender_id)
          .maybeSingle();
        senderName = p?.display_name?.trim() || null;
      }

      const { count } = await supabase
        .from("tribe_members")
        .select("id", { count: "exact", head: true })
        .eq("tribe_id", tribeRow.id);

      const { data: readPointer } = await supabase
        .from("tribe_room_reads")
        .select("last_read_at")
        .eq("tribe_id", tribeRow.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      let unreadCount = 0;
      if (readPointer?.last_read_at) {
        // Same room_kind gap as the preview above: without it, a new Room
        // item (a Tribevia answer, a shared plan) inflates the badge on
        // this row even though opening it (the flat chat) won't show that
        // item at all.
        const { count: unread } = await supabase
          .from("tribe_messages")
          .select("id", { count: "exact", head: true })
          .eq("tribe_id", tribeRow.id)
          .is("room_kind", null)
          .neq("sender_id", user!.id)
          .gt("created_at", readPointer.last_read_at);
        unreadCount = unread ?? 0;
      }

      return {
        dbTribeId: tribeRow.id,
        lastContent: last?.deleted_at ? null : (last?.content ?? null),
        lastSenderName: senderName,
        lastAt: last?.created_at ?? null,
        lastDeleted: Boolean(last?.deleted_at),
        memberCount: count ?? null,
        unreadCount,
      };
    },
  });
}

/** Newest message per Venture, in one query rather than one per row. */
function useVentureChatPreviews(ventureIds: string[]) {
  const { user } = useAuth();
  const key = ventureIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["chats", "venture-previews", key, user?.id ?? null],
    enabled: !!user && ventureIds.length > 0,
    staleTime: 10_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      // venture_messages.deleted_at (20260904010000) isn't in the generated
      // Database types yet, same lag as elsewhere - `as any` on this one
      // query keeps that from breaking every other typed venture_messages
      // read in the file.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from("venture_messages") as any)
        .select("venture_id, content, attachment_type, created_at, sender_id, deleted_at")
        .in("venture_id", ventureIds)
        .order("created_at", { ascending: false })
        .limit(200);
      const newest = new Map<string, { content: string; created_at: string }>();
      for (const row of (data ?? []) as Array<{
        venture_id: string;
        content: string | null;
        attachment_type: string | null;
        created_at: string;
        deleted_at: string | null;
      }>) {
        if (!newest.has(row.venture_id)) {
          newest.set(row.venture_id, {
            content: row.deleted_at
              ? "Message removed"
              : row.content || (row.attachment_type === "image" ? "Photo" : "Message"),
            created_at: row.created_at,
          });
        }
      }
      return newest;
    },
  });
}

function Row({
  leading,
  title,
  subtitle,
  meta,
  hint,
  context,
  accented,
  unread,
  onClick,
}: {
  leading: React.ReactNode;
  title: string;
  subtitle: string;
  meta?: string | null;
  hint?: string | null;
  context?: string;
  accented?: boolean;
  unread?: number | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left transition-colors active:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        unread
          ? "border-primary/40 bg-card shadow-[0_8px_24px_rgba(0,0,0,0.14)]"
          : accented
            ? "border-primary/30 bg-card"
            : "border-transparent hover:border-border",
      )}
    >
      {!!unread && (
        <span
          aria-hidden
          className="bg-meutuals-gradient absolute inset-y-2 left-0 w-0.5 rounded-r-full"
        />
      )}
      <span className="shrink-0">{leading}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("truncate text-sm", unread ? "font-bold" : "font-semibold")}>
              {title}
            </span>
            {context && (
              <span className="label-mono shrink-0 rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                {context}
              </span>
            )}
          </span>
          {meta && (
            <span
              className={cn(
                "label-mono shrink-0",
                unread ? "font-bold text-primary" : "text-muted-foreground",
              )}
            >
              {meta}
            </span>
          )}
        </span>
        <span
          className={cn(
            "mt-0.5 block truncate text-xs",
            unread ? "font-medium text-foreground/85" : "text-muted-foreground",
          )}
        >
          {subtitle}
        </span>
        {hint && <span className="label-mono mt-1 block text-accent-readable">{hint}</span>}
      </span>
      {!!unread && (
        <span className="bg-meutuals-gradient flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 font-mono text-xs font-bold leading-none text-white">
          {unread}
        </span>
      )}
    </button>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="label-mono px-1 pb-2 pt-4 text-muted-foreground">{children}</p>;
}

export function ChatsScreen({
  profile,
  onOpenTribeChat,
  onOpenVentureChat,
  onOpenThread,
  onOpenHelloRequests,
  initialVentureId,
  onInitialVentureConsumed,
}: {
  profile: Profile;
  onOpenTribeChat: () => void;
  onOpenVentureChat: (venture: VentureParty) => void;
  onOpenThread: (userId: string) => void;
  onOpenHelloRequests: () => void;
  initialVentureId?: string | null;
  onInitialVentureConsumed?: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [mootsPickerOpen, setMootsPickerOpen] = useState(false);
  const blocked = useBlocked();
  const incomingHellos = useIncomingHellos();
  const helloRequestCount = incomingHellos.data?.length ?? 0;

  const tribe = profile.tribeIds.length ? tribeById(profile.tribeIds[0]) : null;
  const tribeQuery = useTribeChatSummary(tribe?.name ?? null);
  const joinedQuery = useMyJoinedVentures();
  const hostedQuery = useMyHostedVentures();
  const threadsQuery = useThreads();

  // A Venture you can talk in is one you host, or one you were accepted into.
  // Applying does not open the party chat, and it should not put a room in
  // this list that the database would refuse to show you.
  const ventureChats = useMemo(() => {
    const hosted = hostedQuery.data ?? [];
    const accepted = (joinedQuery.data ?? []).filter(
      (v) => (v.my_application?.status as string) === "accepted",
    );
    const seen = new Set<string>();
    return [...hosted, ...accepted].filter((v) => {
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
  }, [hostedQuery.data, joinedQuery.data]);

  useEffect(() => {
    if (!initialVentureId || joinedQuery.isLoading || hostedQuery.isLoading) return;
    const venture = ventureChats.find((candidate) => candidate.id === initialVentureId);
    onInitialVentureConsumed?.();
    if (!venture) return;
    setFilter("ventures");
    onOpenVentureChat(venture);
  }, [
    hostedQuery.isLoading,
    initialVentureId,
    joinedQuery.isLoading,
    onInitialVentureConsumed,
    onOpenVentureChat,
    ventureChats,
  ]);

  const previewsQuery = useVentureChatPreviews(ventureChats.map((v) => v.id));

  const threads = useMemo(
    () => (threadsQuery.data ?? []).filter((t) => !blocked.has(t.other_id)),
    [threadsQuery.data, blocked],
  );

  const sortedVentures = useMemo(() => {
    const previews = previewsQuery.data;
    return ventureChats.slice().sort((a, b) => {
      const at = previews?.get(a.id)?.created_at ?? a.created_at;
      const bt = previews?.get(b.id)?.created_at ?? b.created_at;
      return at < bt ? 1 : -1;
    });
  }, [ventureChats, previewsQuery.data]);
  const activeVentures = sortedVentures.filter(
    (venture) => venture.status !== "closed" && !venture.closed_at && !venture.ended_at,
  );
  const ventureMemories = sortedVentures.filter(
    (venture) => venture.status === "closed" || !!venture.closed_at || !!venture.ended_at,
  );

  const allChats = useMemo<UnifiedChatItem[]>(() => {
    const items: UnifiedChatItem[] = [];

    if (tribe) {
      items.push({
        kind: "tribe",
        key: `tribe-${tribe.id}`,
        lastAt: tribeQuery.data?.lastAt ?? "",
        unreadCount: tribeQuery.data?.unreadCount ?? 0,
      });
    }

    for (const venture of sortedVentures) {
      const preview = previewsQuery.data?.get(venture.id);
      items.push({
        kind: "venture",
        key: `venture-${venture.id}`,
        lastAt: preview?.created_at ?? venture.created_at,
        unreadCount: 0,
        venture,
        memory: venture.status === "closed" || !!venture.closed_at || !!venture.ended_at,
      });
    }

    for (const thread of threads) {
      items.push({
        kind: "direct",
        key: `direct-${thread.other_id}`,
        lastAt: thread.last_message.created_at,
        unreadCount: thread.unread_count,
        thread,
      });
    }

    return items.sort((left, right) => {
      const unreadOrder = Number(right.unreadCount > 0) - Number(left.unreadCount > 0);
      if (unreadOrder !== 0) return unreadOrder;
      return right.lastAt.localeCompare(left.lastAt);
    });
  }, [previewsQuery.data, sortedVentures, threads, tribe, tribeQuery.data]);

  const directUnreadCount = threads.reduce((total, thread) => total + thread.unread_count, 0);
  const tribeUnreadCount = tribeQuery.data?.unreadCount ?? 0;
  const reliableUnreadCount = directUnreadCount + tribeUnreadCount;

  const showTribe = filter === "tribe";
  const showVentures = filter === "ventures";
  const showDirect = filter === "direct";
  const isLoading = joinedQuery.isLoading || hostedQuery.isLoading || threadsQuery.isLoading;

  const nothingAtAll =
    !tribe && ventureChats.length === 0 && threads.length === 0 && !threadsQuery.isLoading;

  return (
    <div className="min-h-screen bg-habitat pb-24">
      <AppHeader
        title="Chats"
        accent="var(--color-primary)"
        action={
          <button
            type="button"
            onClick={onOpenHelloRequests}
            aria-label={
              helloRequestCount > 0 ? `Hellos - ${helloRequestCount} waiting on you` : "Hellos"
            }
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <HandIcon className="h-5 w-5" />
            {helloRequestCount > 0 && (
              <span className="bg-meutuals-gradient absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-xs font-bold leading-none text-white">
                {helloRequestCount > 9 ? "9+" : helloRequestCount}
              </span>
            )}
          </button>
        }
      />

      <main className="mx-auto max-w-md px-5">
        {/* All is a true inbox: reliable unread conversations rise first and
            everything else follows latest activity. These filters preserve the
            audience-specific views when someone wants Tribe, Venture, or DM
            structure instead of the mixed chronological list. */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              ["all", "All", reliableUnreadCount],
              ["tribe", "Tribe", tribeUnreadCount],
              ["ventures", "Ventures", 0],
              ["direct", "Direct", directUnreadCount],
            ] as Array<[Filter, string, number]>
          ).map(([key, label, unreadCount]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                "flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                filter === key
                  ? "bg-primary/15 text-primary"
                  : "border border-border text-muted-foreground",
              )}
            >
              {label}
              {unreadCount > 0 && (
                <span className="bg-meutuals-gradient flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-xs font-bold leading-none text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading && <ConversationListSkeleton />}

        {!isLoading && filter === "all" && allChats.length > 0 && (
          <div className="mt-3 flex flex-col gap-1">
            {allChats.map((item) => {
              if (item.kind === "tribe" && tribe) {
                return (
                  <Row
                    key={item.key}
                    accented
                    context="Tribe"
                    leading={
                      <span
                        className="flex h-12 w-12 items-center justify-center rounded-2xl"
                        style={{
                          backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 20%, transparent)`,
                          boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${tribe.colorVar} 50%, transparent)`,
                        }}
                      >
                        <TribeMark tribe={tribe} size="sm" />
                      </span>
                    }
                    title={tribe.name}
                    subtitle={
                      tribeQuery.data?.lastContent
                        ? `${tribeQuery.data.lastSenderName ?? "Someone"}: ${tribeQuery.data.lastContent}`
                        : tribeQuery.data?.lastDeleted
                          ? "Message removed"
                          : "No messages yet — say something."
                    }
                    meta={tribeQuery.data?.lastAt ? timeAgoLabel(tribeQuery.data.lastAt) : null}
                    hint={
                      tribeQuery.data?.memberCount
                        ? `${tribeQuery.data.memberCount} ${tribeQuery.data.memberCount === 1 ? "member" : "members"} · everyone in your Tribe`
                        : "Everyone in your Tribe"
                    }
                    unread={item.unreadCount || null}
                    onClick={onOpenTribeChat}
                  />
                );
              }

              if (item.kind === "venture") {
                const preview = previewsQuery.data?.get(item.venture.id);
                return (
                  <Row
                    key={item.key}
                    context={item.memory ? "Memory" : "Venture"}
                    leading={
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-meutuals-gradient text-white">
                        {item.memory ? (
                          <UsersIcon className="h-4.5 w-4.5" weight="fill" />
                        ) : (
                          <LightningIcon className="h-4.5 w-4.5" weight="fill" />
                        )}
                      </span>
                    }
                    title={item.venture.title}
                    subtitle={
                      preview?.content ??
                      (item.memory
                        ? "Venture complete — reconnect with your party."
                        : "No messages yet.")
                    }
                    meta={preview ? timeAgoLabel(preview.created_at) : null}
                    hint={
                      item.memory
                        ? "Completed · find your Moots"
                        : [timingLabel(item.venture), `${item.venture.filled_slots} going`]
                            .filter(Boolean)
                            .join(" · ")
                    }
                    unread={null}
                    onClick={() => onOpenVentureChat(item.venture)}
                  />
                );
              }

              if (item.kind === "direct") {
                const thread = item.thread;
                return (
                  <Row
                    key={item.key}
                    context="Direct"
                    accented={thread.unread_count > 0}
                    leading={
                      <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-secondary text-lg">
                        {thread.other?.avatar_url ? (
                          <img
                            src={thread.other.avatar_url}
                            alt=""
                            className="h-12 w-12 object-cover"
                          />
                        ) : (
                          (thread.other?.avatar_emoji ?? "🙂")
                        )}
                      </span>
                    }
                    title={thread.other?.display_name?.trim() || "Someone"}
                    subtitle={
                      thread.last_message.deleted_at
                        ? "Message removed"
                        : thread.last_message.content ||
                          (thread.last_message.attachment_type === "image" ? "Photo" : "Message")
                    }
                    meta={timeAgoLabel(thread.last_message.created_at)}
                    unread={thread.unread_count || null}
                    onClick={() => onOpenThread(thread.other_id)}
                  />
                );
              }

              return null;
            })}
          </div>
        )}

        {!isLoading && showTribe && tribe && (
          <>
            <GroupLabel>Your Tribe</GroupLabel>
            <Row
              accented
              leading={
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 20%, transparent)`,
                    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${tribe.colorVar} 50%, transparent)`,
                  }}
                >
                  <TribeMark tribe={tribe} size="sm" />
                </span>
              }
              title={tribe.name}
              subtitle={
                tribeQuery.data?.lastContent
                  ? `${tribeQuery.data.lastSenderName ?? "Someone"}: ${tribeQuery.data.lastContent}`
                  : tribeQuery.data?.lastDeleted
                    ? "Message removed"
                    : "No messages yet — say something."
              }
              meta={tribeQuery.data?.lastAt ? timeAgoLabel(tribeQuery.data.lastAt) : null}
              hint={
                tribeQuery.data?.memberCount
                  ? `${tribeQuery.data.memberCount} ${tribeQuery.data.memberCount === 1 ? "member" : "members"} · everyone in your Tribe`
                  : "Everyone in your Tribe"
              }
              unread={tribeQuery.data?.unreadCount ?? null}
              onClick={onOpenTribeChat}
            />
          </>
        )}

        {!isLoading && showVentures && activeVentures.length > 0 && (
          <>
            <GroupLabel>Active Ventures</GroupLabel>
            <div className="flex flex-col gap-1">
              {activeVentures.map((venture) => {
                const preview = previewsQuery.data?.get(venture.id);
                return (
                  <Row
                    key={venture.id}
                    leading={
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-meutuals-gradient text-white">
                        <LightningIcon className="h-4.5 w-4.5" weight="fill" />
                      </span>
                    }
                    title={venture.title}
                    subtitle={preview?.content ?? "No messages yet."}
                    meta={preview ? timeAgoLabel(preview.created_at) : null}
                    hint={[timingLabel(venture), `${venture.filled_slots} going`]
                      .filter(Boolean)
                      .join(" · ")}
                    unread={unreadFor("venture", venture.id)}
                    onClick={() => onOpenVentureChat(venture)}
                  />
                );
              })}
            </div>
          </>
        )}

        {!isLoading && showVentures && ventureMemories.length > 0 && (
          <>
            <GroupLabel>Venture Memories</GroupLabel>
            <div className="flex flex-col gap-1">
              {ventureMemories.map((venture) => {
                const preview = previewsQuery.data?.get(venture.id);
                return (
                  <Row
                    key={venture.id}
                    leading={
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-meutuals-gradient text-white">
                        <UsersIcon className="h-4.5 w-4.5" weight="fill" />
                      </span>
                    }
                    title={venture.title}
                    subtitle={preview?.content ?? "Venture complete — reconnect with your party."}
                    meta={preview ? timeAgoLabel(preview.created_at) : null}
                    hint="Completed · find your Moots"
                    unread={unreadFor("venture", venture.id)}
                    onClick={() => onOpenVentureChat(venture)}
                  />
                );
              })}
            </div>
          </>
        )}

        {!isLoading && showDirect && threads.length > 0 && (
          <>
            <GroupLabel>Direct</GroupLabel>
            <div className="flex flex-col gap-1">
              {threads.map((thread) => (
                <Row
                  key={thread.other_id}
                  accented={thread.unread_count > 0}
                  leading={
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-lg">
                      {thread.other?.avatar_url ? (
                        <img
                          src={thread.other.avatar_url}
                          alt=""
                          className="h-12 w-12 rounded-2xl object-cover"
                        />
                      ) : (
                        (thread.other?.avatar_emoji ?? "🙂")
                      )}
                    </span>
                  }
                  title={thread.other?.display_name?.trim() || "Someone"}
                  subtitle={
                    thread.last_message.deleted_at
                      ? "Message removed"
                      : thread.last_message.content ||
                        (thread.last_message.attachment_type === "image" ? "Photo" : "Message")
                  }
                  meta={timeAgoLabel(thread.last_message.created_at)}
                  unread={thread.unread_count || null}
                  onClick={() => onOpenThread(thread.other_id)}
                />
              ))}
            </div>
          </>
        )}

        {!isLoading && !nothingAtAll && showDirect && threads.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="text-xs text-muted-foreground">
              No direct messages yet. Tap the chat button to start one with a Moot.
            </p>
          </div>
        )}

        {!isLoading && nothingAtAll && (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center">
            <ChatCircleIcon className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No conversations yet</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Join a Venture or say hello to someone in Discover, and it will show up here.
            </p>
          </div>
        )}
      </main>

      {/* Fixed to the viewport but width-matched to the centered max-w-md
          column and right-aligned within it - a raw viewport-edge FAB would
          drift away from the content on anything wider than a phone. Same
          pattern as Ventures' Host FAB. Visible regardless of filter -
          starting a new DM isn't specific to already being on Direct. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md justify-end px-5">
        <button
          type="button"
          onClick={() => setMootsPickerOpen(true)}
          aria-label="New message"
          className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-meutuals-gradient text-white shadow-xl shadow-black/30 transition-[transform,filter] hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ChatCircleDotsIcon className="h-6 w-6" weight="fill" aria-hidden="true" />
        </button>
      </div>

      <MootsPickerSheet
        open={mootsPickerOpen}
        onClose={() => setMootsPickerOpen(false)}
        onSelect={(userId) => {
          setMootsPickerOpen(false);
          onOpenThread(userId);
        }}
      />
    </div>
  );
}

/**
 * Who to start a DM with - everyone you're Moots with, not just people you
 * already have a thread with. A side drawer rather than a rising sheet or
 * centered dialog: this is a list you browse alongside the Direct filter
 * you came from, not a thing that should take over the whole screen.
 */
function MootsPickerSheet({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (userId: string) => void;
}) {
  const moots = useMyMoots();
  const rows = moots.data ?? [];

  // Grouped by primary Tribe (first joined), in the app's canonical Tribe
  // order rather than however the list happened to come back - a Moot with
  // no Tribe at all shouldn't be possible post-onboarding, but the fallback
  // bucket keeps this from silently dropping anyone if it ever is.
  const groups = useMemo(() => {
    const data = moots.data ?? [];
    const byTribe = new Map<TribeId, typeof data>();
    const other: typeof data = [];
    for (const m of data) {
      const primary = m.tribe_ids?.[0] as TribeId | undefined;
      if (!primary) {
        other.push(m);
        continue;
      }
      const bucket = byTribe.get(primary);
      if (bucket) bucket.push(m);
      else byTribe.set(primary, [m]);
    }
    const ordered = TRIBES.map((t) => ({ tribe: t, members: byTribe.get(t.id) ?? [] })).filter(
      (g) => g.members.length > 0,
    );
    return other.length ? [...ordered, { tribe: null, members: other }] : ordered;
  }, [moots.data]);

  return (
    <AnimatedModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="New message"
      side="right"
      contentClassName="flex flex-col"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-display text-lg font-bold">Moots</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="scroll-panel min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {moots.isLoading ? (
          <p className="text-center text-xs text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            No Moots yet. Accept a Hello, and they'll show up here to message.
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.tribe?.id ?? "other"}>
                <div className="mb-1.5 flex items-center gap-1.5 px-2">
                  {group.tribe && <TribeMark tribe={group.tribe} size="xs" decorative={false} />}
                  <p
                    className="label-mono"
                    style={{
                      color: group.tribe
                        ? readableAccentColor(group.tribe.colorVar)
                        : "var(--muted-foreground)",
                    }}
                  >
                    {group.tribe?.name ?? "Other"}
                  </p>
                </div>
                <ul className="space-y-1">
                  {group.members.map((m) => {
                    const name = m.display_name?.trim() || "Someone";
                    const avatar = m.avatar_url || m.avatar_emoji || "👋";
                    const isImg = avatar.startsWith("http") || avatar.startsWith("data:");
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(m.id)}
                          className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-lg">
                            {isImg ? (
                              <img src={avatar} alt="" className="h-full w-full object-cover" />
                            ) : (
                              avatar
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{name}</p>
                            {m.handle && (
                              <p className="truncate text-xs text-muted-foreground">@{m.handle}</p>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </AnimatedModal>
  );
}
