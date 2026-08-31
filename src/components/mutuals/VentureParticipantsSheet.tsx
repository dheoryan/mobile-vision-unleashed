import { useEffect, useMemo, useState } from "react";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { AnimatedModal } from "@/components/ui/animated-modal";
import type { VentureArrivalState, VentureParty, VentureProfileLite } from "@/lib/ventures-store";
import type { VentureParticipant } from "@/lib/venture-participants";
import { arrivalStatusLabel } from "@/lib/venture-coordination";
import { SafetyMenu } from "./SafetyMenu";

function ParticipantAvatar({ profile }: { profile: VentureProfileLite }) {
  const fallback = profile.avatar_emoji?.trim() || profile.display_name.trim().slice(0, 1) || "?";
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/40 bg-primary/10 text-sm font-semibold">
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{fallback}</span>
      )}
    </span>
  );
}

export function VentureParticipantsSheet({
  open,
  onClose,
  venture,
  participants,
  currentUserId,
  arrivalStatuses,
  allowMessage,
  onOpenProfile,
  onMessage,
}: {
  open: boolean;
  onClose: () => void;
  venture: VentureParty;
  participants: VentureParticipant[];
  currentUserId?: string;
  arrivalStatuses?: VentureArrivalState[];
  allowMessage: boolean;
  onOpenProfile?: (handle: string) => void;
  onMessage?: (userId: string) => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const visibleParticipants = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return participants;
    return participants.filter(({ profile }) =>
      `${profile.display_name} ${profile.handle ?? ""}`.toLocaleLowerCase().includes(normalized),
    );
  }, [participants, query]);
  const statusesByUser = useMemo(
    () => new Map((arrivalStatuses ?? []).map((item) => [item.user_id, item.status])),
    [arrivalStatuses],
  );

  return (
    <AnimatedModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={`${venture.title} participants`}
      contentClassName="overflow-hidden"
      zIndex={60}
    >
      <div className="flex max-h-[min(78dvh,42rem)] min-h-[28rem] flex-col">
        <div className="h-1 shrink-0 bg-primary" aria-hidden="true" />
        <header className="flex shrink-0 items-start gap-3 border-b border-border px-5 pb-4 pt-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <UsersIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="label-mono text-muted-foreground">Together in this Venture</p>
            <h2 className="truncate font-display text-xl font-bold">Participants</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {participants.length} {participants.length === 1 ? "person" : "people"} ·{" "}
              {venture.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close participant list"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </header>

        {participants.length > 0 && (
          <div className="shrink-0 border-b border-border px-5 py-3">
            <label className="relative block">
              <span className="sr-only">Search Venture participants</span>
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value.slice(0, 80))}
                placeholder="Search participants"
                className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>
        )}

        <div className="scroll-panel min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-live="polite">
          {participants.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
              <UsersIcon className="h-7 w-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">Nobody is listed yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Accepted participants will appear here.
              </p>
            </div>
          ) : visibleParticipants.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-semibold">No participant matches “{query.trim()}”</p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-3 min-h-11 rounded-full px-4 text-xs font-semibold text-primary transition-colors hover:text-primary/80 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Clear search
              </button>
            </div>
          ) : (
            <ul>
              {visibleParticipants.map(({ profile, role }) => {
                const isMe = profile.id === currentUserId;
                const canOpenProfile = !!profile.handle && !!onOpenProfile;
                const roleLabel = role === "host" ? "Host" : "Participant";
                const arrivalStatus = statusesByUser.get(profile.id);
                return (
                  <li
                    key={profile.id}
                    className="flex min-h-16 items-center gap-3 border-b border-border/60 px-3 last:border-b-0"
                  >
                    <button
                      type="button"
                      disabled={!canOpenProfile}
                      onClick={() => {
                        if (!profile.handle || !onOpenProfile) return;
                        onClose();
                        onOpenProfile(profile.handle);
                      }}
                      aria-label={
                        canOpenProfile
                          ? `View ${isMe ? "your" : profile.display_name || "participant"} profile`
                          : undefined
                      }
                      className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 text-left transition-colors enabled:active:bg-secondary/30 enabled:cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <ParticipantAvatar profile={profile} />
                      <span className="min-w-0 flex-1 py-2">
                        <span className="block truncate text-sm font-semibold transition-colors group-enabled:group-hover:text-primary group-enabled:group-focus-visible:text-primary">
                          {profile.display_name || profile.handle || "Participant"}
                        </span>
                        <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground transition-colors group-enabled:group-hover:text-foreground group-enabled:group-focus-visible:text-foreground">
                          <span className="truncate">
                            {roleLabel}
                            {profile.handle ? ` · @${profile.handle}` : ""}
                            {arrivalStatus ? ` · ${arrivalStatusLabel(arrivalStatus)}` : ""}
                          </span>
                          {canOpenProfile && (
                            <CaretRightIcon
                              className="h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 group-active:translate-x-1"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                      </span>
                    </button>

                    {isMe ? (
                      <span className="label-mono rounded-full bg-primary/15 px-2.5 py-1 text-primary">
                        You
                      </span>
                    ) : (
                      <div className="flex shrink-0 items-center">
                        {allowMessage && onMessage && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onMessage(profile.id);
                            }}
                            aria-label={`Message ${profile.display_name || "participant"}`}
                            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <ChatCircleIcon className="h-4 w-4" />
                          </button>
                        )}
                        <SafetyMenu
                          targetName={profile.display_name || profile.handle || "this participant"}
                          targetUserId={profile.id}
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
      </div>
    </AnimatedModal>
  );
}
