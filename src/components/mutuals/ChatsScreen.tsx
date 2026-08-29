import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Hand, MessageCircle, Plus, UsersRound, X, Zap } from "lucide-react";
import { AppHeader } from "./Shared";
import { TribeMark } from "./TribeMark";
import { TRIBES, tribeById, type TribeId } from "@/lib/mutuals-data";
import type { Profile } from "./Onboarding";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useThreads } from "@/lib/messages-store";
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

      const { data: rows } = await supabase
        .from("tribe_messages")
        .select("content, created_at, sender_id")
        .eq("tribe_id", tribeRow.id)
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
        const { count: unread } = await supabase
          .from("tribe_messages")
          .select("id", { count: "exact", head: true })
          .eq("tribe_id", tribeRow.id)
          .neq("sender_id", user!.id)
          .gt("created_at", readPointer.last_read_at);
        unreadCount = unread ?? 0;
      }

      return {
        dbTribeId: tribeRow.id,
        lastContent: last?.content ?? null,
        lastSenderName: senderName,
        lastAt: last?.created_at ?? null,
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
      const { data } = await supabase
        .from("venture_messages")
        .select("venture_id, content, attachment_type, created_at, sender_id")
        .in("venture_id", ventureIds)
        .order("created_at", { ascending: false })
        .limit(200);
      const newest = new Map<string, { content: string; created_at: string }>();
      for (const row of data ?? []) {
        if (!newest.has(row.venture_id)) {
          newest.set(row.venture_id, {
            content: row.content || (row.attachment_type === "image" ? "Photo" : "Message"),
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
  accented,
  unread,
  onClick,
}: {
  leading: React.ReactNode;
  title: string;
  subtitle: string;
  meta?: string | null;
  hint?: string | null;
  accented?: boolean;
  unread?: number | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
        accented ? "border-primary/30 bg-card" : "border-transparent hover:border-border",
      )}
    >
      <span className="shrink-0">{leading}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-sm", unread ? "font-bold" : "font-semibold")}>
            {title}
          </span>
          {meta && <span className="label-mono shrink-0 text-muted-foreground">{meta}</span>}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>
        {hint && <span className="label-mono mt-1 block text-accent">{hint}</span>}
      </span>
      {!!unread && (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
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

  const showTribe = filter === "all" || filter === "tribe";
  const showVentures = filter === "all" || filter === "ventures";
  const showDirect = filter === "all" || filter === "direct";
  const isLoading = joinedQuery.isLoading || hostedQuery.isLoading || threadsQuery.isLoading;

  const nothingAtAll =
    !tribe && ventureChats.length === 0 && threads.length === 0 && !threadsQuery.isLoading;

  return (
    <div className="min-h-screen bg-habitat pb-24">
      <AppHeader
        title="Chats"
        subtitle="Rooms"
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
            <Hand className="h-5 w-5" />
            {helloRequestCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">
                {helloRequestCount > 9 ? "9+" : helloRequestCount}
              </span>
            )}
          </button>
        }
      />

      <main className="mx-auto max-w-md px-5">
        {/* Ordered by permanence, not recency: the Tribe room is singular and
            always there, Ventures are temporary groups that end, Direct is one
            to one. That ordering is the audience model made visible — how many
            people can read what you type, largest group first. */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              ["all", "All"],
              ["tribe", "Tribe"],
              ["ventures", "Ventures"],
              ["direct", "Direct"],
            ] as Array<[Filter, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                "min-h-9 shrink-0 rounded-full px-3.5 text-xs font-semibold transition-colors",
                filter === key
                  ? "bg-primary/15 text-primary"
                  : "border border-border text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading && <ConversationListSkeleton />}

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
                  : "No messages yet — say something."
              }
              meta={tribeQuery.data?.lastAt ? timeAgoLabel(tribeQuery.data.lastAt) : null}
              hint={
                tribeQuery.data?.memberCount
                  ? `${tribeQuery.data.memberCount} members · everyone in your Tribe`
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
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card">
                        <Zap className="h-4.5 w-4.5 text-primary" />
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
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                        <UsersRound className="h-4.5 w-4.5 text-primary" />
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
                    thread.last_message.content ||
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
              No direct messages yet. Tap "New message" to start one with a Moot.
            </p>
          </div>
        )}

        {!isLoading && nothingAtAll && (
          <div className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center">
            <MessageCircle className="mx-auto h-6 w-6 text-muted-foreground" />
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
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 mx-auto flex max-w-md justify-end px-5">
        <button
          type="button"
          onClick={() => setMootsPickerOpen(true)}
          aria-label="New message"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground shadow-xl shadow-black/30 transition-transform active:scale-95"
        >
          <Plus className="h-4 w-4" /> New message
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
          <X className="h-5 w-5" />
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
                    style={{ color: group.tribe?.colorVar ?? "var(--muted-foreground)" }}
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
                              <p className="truncate text-[11px] text-muted-foreground">
                                @{m.handle}
                              </p>
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
