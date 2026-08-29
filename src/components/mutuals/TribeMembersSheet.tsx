import { useEffect, useMemo, useState } from "react";
import { ChevronRight, MessageCircle, RefreshCw, Search, UsersRound, X } from "lucide-react";
import { AnimatedModal } from "@/components/ui/animated-modal";
import type { Tribe } from "@/lib/mutuals-data";
import { visibleTribeMembers, type TribeMemberSummary } from "@/lib/tribe-members";
import { SafetyMenu } from "./SafetyMenu";
import { TribeMark } from "./TribeMark";

function MemberAvatar({ member, color }: { member: TribeMemberSummary; color: string }) {
  const fallback = member.avatar_emoji?.trim() || member.display_name.trim().slice(0, 1) || "?";
  return (
    <span
      className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border text-sm font-semibold"
      style={{
        borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${color} 14%, var(--card))`,
      }}
    >
      {member.avatar_url ? (
        <img src={member.avatar_url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true">{fallback}</span>
      )}
    </span>
  );
}

export function TribeMembersSheet({
  open,
  onClose,
  tribe,
  members,
  total,
  hasMore,
  onlineIds,
  currentUserId,
  loading,
  error,
  onRetry,
  onOpenProfile,
}: {
  open: boolean;
  onClose: () => void;
  tribe: Tribe;
  members: TribeMemberSummary[];
  total: number;
  hasMore: boolean;
  onlineIds: ReadonlySet<string>;
  currentUserId?: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpenProfile?: (handle: string) => void;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const visibleMembers = useMemo(
    () => visibleTribeMembers(members, query, onlineIds, currentUserId),
    [currentUserId, members, onlineIds, query],
  );
  const onlineCount = members.reduce(
    (count, member) => count + Number(onlineIds.has(member.id)),
    0,
  );

  return (
    <AnimatedModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={`${tribe.name} members`}
      contentClassName="overflow-hidden"
    >
      <div className="flex max-h-[min(78dvh,42rem)] min-h-[28rem] flex-col">
        <div
          className="h-1 shrink-0"
          style={{ backgroundColor: tribe.colorVar }}
          aria-hidden="true"
        />
        <header className="flex shrink-0 items-start gap-3 border-b border-border px-5 pb-4 pt-5">
          <TribeMark tribe={tribe} size="md" decorative={false} />
          <div className="min-w-0 flex-1">
            <p className="label-mono text-muted-foreground">Inside the room</p>
            <h2 className="truncate font-display text-xl font-bold">{tribe.name} members</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="text-foreground">{onlineCount}</span> online · {total} members
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close member list"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {!loading && !error && members.length > 0 && (
          <div className="shrink-0 border-b border-border px-5 py-3">
            <label className="relative block">
              <span className="sr-only">Search Tribe members</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value.slice(0, 80))}
                placeholder="Search members"
                className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>
        )}

        <div className="scroll-panel min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-live="polite">
          {loading ? (
            <div className="space-y-1 px-3 py-2" aria-label="Loading Tribe members">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex h-16 animate-pulse items-center gap-3">
                  <span className="h-11 w-11 rounded-full bg-secondary" />
                  <span className="h-3 w-36 rounded-full bg-secondary" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
              <UsersRound className="h-7 w-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">Members couldn’t load</p>
              <p className="mt-1 text-xs text-muted-foreground">The room is still available.</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-xs font-semibold"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </div>
          ) : members.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
              <UsersRound className="h-7 w-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">The room is quiet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                No registered members are visible yet.
              </p>
            </div>
          ) : visibleMembers.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-semibold">No member matches “{query.trim()}”</p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-3 min-h-11 px-4 text-xs font-semibold"
                style={{ color: tribe.colorVar }}
              >
                Clear search
              </button>
            </div>
          ) : (
            <ul>
              {visibleMembers.map((member) => {
                const isMe = member.id === currentUserId;
                const isOnline = onlineIds.has(member.id);
                const canOpenProfile = !!member.handle && !!onOpenProfile;
                return (
                  <li
                    key={member.id}
                    className="flex min-h-16 items-center gap-3 border-b border-border/60 px-3 last:border-b-0"
                  >
                    <button
                      type="button"
                      disabled={!canOpenProfile}
                      onClick={() => {
                        if (!member.handle || !onOpenProfile) return;
                        onClose();
                        onOpenProfile(member.handle);
                      }}
                      aria-label={
                        canOpenProfile
                          ? `View ${isMe ? "your" : member.display_name || "member"} profile`
                          : undefined
                      }
                      className="group flex min-w-0 flex-1 items-center gap-3 py-1 text-left outline-none enabled:cursor-pointer disabled:cursor-default"
                    >
                      <span className="relative shrink-0">
                        <MemberAvatar member={member} color={tribe.colorVar} />
                        {isOnline && (
                          <span
                            className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-emerald-400"
                            aria-label="Online"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 py-2">
                        <span className="block truncate text-sm font-semibold transition-colors group-enabled:group-hover:text-primary group-enabled:group-focus-visible:text-primary">
                          {member.display_name || "Member"}
                        </span>
                        <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground transition-colors group-enabled:group-hover:text-foreground group-enabled:group-focus-visible:text-foreground">
                          <span className="truncate">
                            {isMe
                              ? "You"
                              : member.handle
                                ? `@${member.handle}`
                                : isOnline
                                  ? "Online now"
                                  : "Tribe member"}
                          </span>
                          {canOpenProfile && (
                            <ChevronRight
                              className="h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 group-active:translate-x-1"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                      </span>
                    </button>
                    {isMe ? (
                      <span
                        className="label-mono rounded-full px-2.5 py-1"
                        style={{
                          color: tribe.colorVar,
                          backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 14%, transparent)`,
                        }}
                      >
                        You
                      </span>
                    ) : (
                      <div className="flex shrink-0 items-center">
                        {canOpenProfile && (
                          // Tribe membership no longer guarantees a DM is
                          // open (same-Tribe still needs a Hello) - route
                          // through the profile page instead of a raw
                          // thread, since that's the one place that already
                          // knows whether to offer Message or Say hello.
                          <button
                            type="button"
                            onClick={() => {
                              if (!member.handle || !onOpenProfile) return;
                              onClose();
                              onOpenProfile(member.handle);
                            }}
                            aria-label={`Message ${member.display_name}`}
                            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                        )}
                        <SafetyMenu
                          targetName={member.display_name || member.handle || "this member"}
                          targetUserId={member.id}
                          buttonClassName="h-11 w-11"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {hasMore && !loading && !error && (
          <p className="shrink-0 border-t border-border px-5 py-3 text-center text-[11px] text-muted-foreground">
            Showing the first 200 members.
          </p>
        )}
      </div>
    </AnimatedModal>
  );
}
