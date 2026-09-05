import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CalendarPlusIcon } from "@phosphor-icons/react/dist/csr/CalendarPlus";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { ClockIcon } from "@phosphor-icons/react/dist/csr/Clock";
import { MapPinIcon } from "@phosphor-icons/react/dist/csr/MapPin";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { ShareNetworkIcon } from "@phosphor-icons/react/dist/csr/ShareNetwork";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { TicketIcon } from "@phosphor-icons/react/dist/csr/Ticket";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { toast } from "sonner";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "./Skeleton";
import { readableAccentColor, type TribeId } from "@/lib/mutuals-data";
import {
  dailyPulse,
  pulseStreak,
  roomMetadataNumber,
  roomMetadataString,
  roomMetadataTimeOptions,
  type TribePlanTimeOption,
  type TribeRoomItem,
  type TribeVentureDraft,
} from "@/lib/tribe-room";
import {
  useAnswerDailyPulse,
  useCreateTribePlan,
  useMarkTribeRoomRead,
  useNotifyTribePulse,
  useShareTribePlanToChat,
  useToggleTribeRoomReaction,
  useTribePulseStreak,
  useTribeRoom,
} from "@/lib/tribe-room-store";
import { cn } from "@/lib/utils";
import {
  dayChoices,
  PLAN_PERIOD_CHOICES,
  planTimeLabel,
  todayKey,
  weekendKey,
  type PlanPeriod,
} from "@/lib/venture-time";

export type TribeRoomView = "chat" | "room" | "plans";

export function TribeRoomLayer({
  tribeId,
  tribeName,
  tribeColor,
  city,
  canParticipate,
  view,
  onViewChange,
  planOpen,
  onPlanOpenChange,
  onStartVenture,
  onOpenVentures,
  onOpenChats,
}: {
  tribeId: TribeId;
  tribeName: string;
  tribeColor: string;
  city: string;
  canParticipate: boolean;
  view: TribeRoomView;
  onViewChange: (view: TribeRoomView) => void;
  planOpen: boolean;
  onPlanOpenChange: (open: boolean) => void;
  onStartVenture?: (draft: TribeVentureDraft) => void;
  onOpenVentures?: () => void;
  onOpenChats?: () => void;
}) {
  const { user } = useAuth();
  const [pulseOpen, setPulseOpen] = useState(false);
  const room = useTribeRoom(tribeId, canParticipate);
  const streakQuery = useTribePulseStreak(tribeId, canParticipate);
  const streak = pulseStreak(tribeId, streakQuery.data?.counts ?? {});
  const markRead = useMarkTribeRoomRead(tribeId);
  const notifyPulse = useNotifyTribePulse();
  const prompt = dailyPulse(tribeId);
  const items = room.data?.items ?? [];
  const plans = items
    .filter((item) => item.room_kind === "plan")
    .slice()
    .reverse();
  const announcements = items
    .filter((item) => item.room_kind === "venture")
    .slice()
    .reverse();
  const pulseAnswers = items.filter(
    (item) =>
      item.room_kind === "pulse_answer" &&
      roomMetadataString(item.room_metadata, "prompt_id") === prompt.id,
  );
  const answered = pulseAnswers.some((item) => item.sender_id === user?.id);
  const linkedByPlan = useMemo(
    () => new Map(announcements.map((item) => [item.reply_to_id, item])),
    [announcements],
  );

  useEffect(() => {
    if (!room.data || !canParticipate) return;
    const timer = window.setTimeout(() => markRead.mutate(), 600);
    return () => window.clearTimeout(timer);
    // Mark once per successful room load. Mutation identity is intentionally
    // excluded so a render cannot turn this into a write loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.dataUpdatedAt, canParticipate, tribeId]);

  // Whichever member's device is first to open the room on a new day quietly
  // pings the rest of the tribe. The localStorage check is only to skip a
  // redundant network call on every visit - the server's own dedup on
  // prompt.id (not this) is what actually prevents a duplicate fan-out, so a
  // cleared cache or a second device can't cause a repeat notification.
  useEffect(() => {
    if (!canParticipate) return;
    const storageKey = `mutuals:tribe:${tribeId}:pulse-notified`;
    try {
      if (window.localStorage.getItem(storageKey) === prompt.id) return;
    } catch {
      /* ignore - worst case is one extra no-op call */
    }
    // Both the write and the mutate call are deferred into the same timer,
    // not just the mutate. React 18 StrictMode double-invokes this effect in
    // dev (mount, simulated cleanup, mount again, synchronously) - writing to
    // localStorage eagerly meant the *first*, throwaway invocation marked
    // "already notified" before its own timer got cancelled by cleanup, so
    // the *second*, real invocation saw that mark and skipped scheduling a
    // replacement entirely. Nothing ever fired. Keeping the write inside the
    // cancellable timer means a cleaned-up attempt leaves no trace behind.
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, prompt.id);
      } catch {
        /* ignore */
      }
      notifyPulse.mutate({
        tribe_key: tribeId,
        prompt_id: prompt.id,
        preview: `${tribeName}: ${prompt.question}`,
      });
    }, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tribeId, prompt.id, canParticipate]);

  return (
    <section
      className={cn("flex min-h-0 shrink-0 flex-col", view !== "chat" && "flex-1 overflow-hidden")}
      aria-labelledby="tribe-room-heading"
    >
      <div className="border-b border-border">
        <div
          className="grid min-h-14 w-full grid-cols-3 items-stretch"
          role="tablist"
          aria-label="Tribe Room"
        >
          {(["chat", "room", "plans"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => onViewChange(key)}
              className={cn(
                "relative flex min-h-14 items-center justify-center px-2 font-display text-base font-semibold text-muted-foreground transition-colors active:scale-[0.98] hover:bg-secondary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                view === key && "text-foreground",
              )}
            >
              {key === "chat" ? (
                "Chat"
              ) : key === "room" ? (
                "Tribevia"
              ) : (
                <span className="inline-flex items-center justify-center gap-1.5 leading-none">
                  Plans
                  {plans.length > 0 && (
                    <span
                      className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center self-center rounded-full px-1 font-mono text-xs font-bold leading-none text-white tabular-nums"
                      style={{ backgroundColor: tribeColor }}
                    >
                      {plans.length > 9 ? "9+" : plans.length}
                    </span>
                  )}
                </span>
              )}
              {view === key && (
                <span
                  className="absolute inset-x-5 bottom-0 h-[3px] rounded-t-full"
                  style={{ backgroundColor: tribeColor }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {view !== "chat" && room.isError && (
        <div className="mt-4 flex items-center gap-3 border-l-2 border-primary/70 bg-secondary/35 px-4 py-3">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
            Room activities are resting. The live chat below is still open.
          </p>
          <button
            type="button"
            onClick={() => room.refetch()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded text-xs font-semibold text-foreground transition-opacity active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowClockwiseIcon className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {view === "room" ? (
        <div className="scroll-panel min-h-0 flex-1 space-y-5 overflow-y-auto py-4">
          <DailyPulse
            prompt={prompt}
            answers={pulseAnswers}
            answered={answered}
            loading={room.isLoading}
            streak={streak}
            tribeId={tribeId}
            dbTribeId={room.data?.tribe_id ?? ""}
            tribeColor={tribeColor}
            disabled={!canParticipate}
            onAnswer={() => setPulseOpen(true)}
            currentUserId={user?.id}
            linkedByAnswer={linkedByPlan}
            onStartVenture={onStartVenture}
          />

          {announcements.length > 0 && (
            <div className="space-y-2">
              <p className="label-mono">Plans in motion</p>
              {announcements.slice(0, 2).map((item) => (
                <VentureAnnouncement
                  key={item.id}
                  item={item}
                  tribeColor={tribeColor}
                  onOpenVentures={onOpenVentures}
                  onOpenChats={onOpenChats}
                />
              ))}
            </div>
          )}

          {plans.length > 0 && announcements.length === 0 && (
            <div className="space-y-2">
              <p className="label-mono">The room is shaping</p>
              <PlanRow
                item={plans[0]}
                linked={linkedByPlan.get(plans[0].id)}
                dbTribeId={room.data?.tribe_id ?? ""}
                tribeId={tribeId}
                tribeColor={tribeColor}
                mine={plans[0].sender_id === user?.id}
                onStartVenture={onStartVenture}
              />
            </div>
          )}
        </div>
      ) : view === "plans" ? (
        <div className="scroll-panel min-h-0 flex-1 space-y-3 overflow-y-auto py-4">
          {room.isLoading && <RoomLines />}
          {!room.isLoading && plans.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border bg-card/45 px-5 py-7 text-center">
              <span
                className="mx-auto flex h-11 w-11 items-center justify-center rounded-full text-background"
                style={{ backgroundColor: tribeColor }}
              >
                <CalendarPlusIcon className="h-5 w-5" />
              </span>
              <p className="mt-4 font-display text-lg font-bold">Put an idea on the table.</p>
              <p className="mx-auto mt-1 max-w-64 text-xs leading-relaxed text-muted-foreground">
                Choose a place and one time—or let the room vote. Interested members receive an
                invite only if you make it a Venture.
              </p>
              <button
                type="button"
                onClick={() => onPlanOpenChange(true)}
                disabled={!canParticipate}
                className="mt-5 min-h-11 rounded-full px-5 text-xs font-semibold text-background transition-transform active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40"
                style={{ backgroundColor: tribeColor }}
              >
                Start a plan
              </button>
            </div>
          )}
          {plans.map((item) => (
            <PlanRow
              key={item.id}
              item={item}
              linked={linkedByPlan.get(item.id)}
              dbTribeId={room.data?.tribe_id ?? ""}
              tribeId={tribeId}
              tribeColor={tribeColor}
              mine={item.sender_id === user?.id}
              onStartVenture={onStartVenture}
            />
          ))}
        </div>
      ) : null}

      <span id="tribe-room-heading" className="sr-only">
        Tribe Room
      </span>

      <PulseComposer
        open={pulseOpen}
        onClose={() => setPulseOpen(false)}
        tribeId={tribeId}
        tribeName={tribeName}
        tribeColor={tribeColor}
        prompt={prompt}
      />
      <PlanComposer
        open={planOpen}
        onClose={() => onPlanOpenChange(false)}
        tribeId={tribeId}
        tribeName={tribeName}
        tribeColor={tribeColor}
        initialArea={city}
      />
    </section>
  );
}

function DailyPulse({
  prompt,
  answers,
  answered,
  loading,
  tribeId,
  dbTribeId,
  tribeColor,
  disabled,
  onAnswer,
  currentUserId,
  linkedByAnswer,
  onStartVenture,
  streak,
}: {
  prompt: ReturnType<typeof dailyPulse>;
  answers: TribeRoomItem[];
  answered: boolean;
  loading: boolean;
  tribeId: TribeId;
  dbTribeId: string;
  tribeColor: string;
  disabled: boolean;
  onAnswer: () => void;
  currentUserId?: string;
  linkedByAnswer: Map<string | null, TribeRoomItem>;
  onStartVenture?: (draft: TribeVentureDraft) => void;
  streak: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleAnswers = showAll ? answers : answers.slice(-2);
  return (
    <div
      className="relative overflow-hidden border-l-2 bg-card/60 px-4 py-4"
      style={{ borderColor: tribeColor }}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="label-mono inline-flex items-center gap-1.5"
          style={{ color: readableAccentColor(tribeColor) }}
        >
          <SparkleIcon className="h-3.5 w-3.5" /> Daily Tribevia
        </span>
        <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {streak >= 2 && (
            <span
              className="inline-flex items-center gap-0.5 normal-case tracking-normal text-foreground"
              title={`${streak} days running`}
            >
              <span aria-hidden="true" className="text-sm leading-none">
                🔥
              </span>{" "}
              {streak}
            </span>
          )}
          {loading ? "Loading" : `${answers.length} answered`}
        </span>
      </div>
      <h3 className="mt-3 font-display text-xl font-bold leading-snug">{prompt.question}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{prompt.hint}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <AnswerFaces answers={answers} />
        <button
          type="button"
          onClick={onAnswer}
          disabled={disabled || answered}
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
          style={{ backgroundColor: tribeColor }}
        >
          {answered ? <CheckIcon className="h-4 w-4" /> : <ArrowRightIcon className="h-4 w-4" />}
          {answered ? "Answered" : "Add yours"}
        </button>
      </div>
      {answers.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          {visibleAnswers.map((answer) => (
            <PulseAnswer
              key={answer.id}
              item={answer}
              tribeId={tribeId}
              dbTribeId={dbTribeId}
              tribeColor={tribeColor}
              mine={answer.sender_id === currentUserId}
              linked={linkedByAnswer.get(answer.id)}
              promptQuestion={prompt.question}
              onStartVenture={onStartVenture}
            />
          ))}
          {!showAll && answers.length > 2 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mx-auto flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              See all {answers.length} answers
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AnswerFaces({ answers }: { answers: TribeRoomItem[] }) {
  if (!answers.length)
    return <span className="text-xs text-muted-foreground">Be first in</span>;
  return (
    <div className="flex items-center">
      {answers.slice(-4).map((answer, index) => (
        <Avatar key={answer.id} item={answer} className={cn(index > 0 && "-ml-2")} />
      ))}
      {answers.length > 4 && (
        <span className="ml-2 text-xs text-muted-foreground">+{answers.length - 4}</span>
      )}
    </div>
  );
}

function PulseAnswer({
  item,
  tribeId,
  dbTribeId,
  tribeColor,
  mine,
  linked,
  promptQuestion,
  onStartVenture,
}: {
  item: TribeRoomItem;
  tribeId: TribeId;
  dbTribeId: string;
  tribeColor: string;
  mine: boolean;
  linked?: TribeRoomItem;
  promptQuestion: string;
  onStartVenture?: (draft: TribeVentureDraft) => void;
}) {
  const reaction = useToggleTribeRoomReaction(tribeId);
  const active = item.my_reactions.includes("spark");
  return (
    <div className="flex items-start gap-2.5">
      <Avatar item={item} />
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-relaxed text-foreground/90">
          <span className="font-semibold">{item.author?.display_name ?? "Member"}</span>{" "}
          <span className="text-muted-foreground">{item.content}</span>
        </p>
        {mine && !linked && onStartVenture && (
          <button
            type="button"
            onClick={() =>
              onStartVenture({
                sourceMessageId: item.id,
                dbTribeId,
                tribeId,
                title: item.content.slice(0, 80),
                note: `From today's Tribevia: "${promptQuestion}"`,
                whenLabel: "Timing open",
                timeOptions: [],
                area: "Area open",
                maxSlots: 4,
              })
            }
            className="mt-1.5 inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            style={{
              borderColor: `color-mix(in oklab, ${tribeColor} 45%, transparent)`,
              color: readableAccentColor(tribeColor),
            }}
          >
            Turn into Venture <ArrowRightIcon className="h-3 w-3" />
          </button>
        )}
        {linked && (
          <span className="mt-1.5 inline-flex min-h-9 items-center gap-1 rounded-full bg-secondary/60 px-2.5 text-xs font-semibold text-muted-foreground">
            <CheckIcon className="h-3 w-3" /> Venture live
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => reaction.mutate({ message_id: item.id, reaction: "spark" })}
        disabled={reaction.isPending}
        aria-pressed={active}
        aria-label={active ? "Remove spark" : "Add spark"}
        className={cn(
          "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full text-xs transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          !active && "text-muted-foreground",
        )}
        style={active ? { color: readableAccentColor(tribeColor) } : undefined}
      >
        <span aria-hidden="true" className="text-sm leading-none">
          🔥
        </span>{" "}
        {item.reactions.spark || ""}
      </button>
    </div>
  );
}

function PlanRow({
  item,
  linked,
  dbTribeId,
  tribeId,
  tribeColor,
  mine,
  onStartVenture,
}: {
  item: TribeRoomItem;
  linked?: TribeRoomItem;
  dbTribeId: string;
  tribeId: TribeId;
  tribeColor: string;
  mine: boolean;
  onStartVenture?: (draft: TribeVentureDraft) => void;
}) {
  const toggle = useToggleTribeRoomReaction(tribeId);
  const share = useShareTribePlanToChat();
  const interested = item.my_reactions.includes("interested");
  const timeOptions = roomMetadataTimeOptions(item.room_metadata, item.reactions);
  const timingMode = roomMetadataString(item.room_metadata, "timing_mode", "single");
  const whenLabel =
    timingMode === "single" && timeOptions[0]
      ? timeOptions[0].label
      : roomMetadataString(item.room_metadata, "when_label", "Timing open");
  const area = roomMetadataString(item.room_metadata, "area", "Area open");
  const note = roomMetadataString(item.room_metadata, "note");
  const maxSlots = roomMetadataNumber(item.room_metadata, "max_slots", 4);

  return (
    <article className="rounded-2xl border border-border bg-card/55 p-4">
      <div className="flex items-start gap-3">
        <Avatar item={item} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            {item.author?.display_name ?? "A member"} put a plan on the table
          </p>
          <h3 className="mt-1 font-display text-lg font-bold leading-tight">{item.content}</h3>
          {note && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{note}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="h-3.5 w-3.5" /> {whenLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon className="h-3.5 w-3.5" /> {area}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UsersIcon className="h-3.5 w-3.5" /> up to {maxSlots}
            </span>
          </div>
          {timingMode === "poll" && timeOptions.length >= 2 && (
            <fieldset className="mt-4 border-l-2 border-border pl-3">
              <legend className="label-mono px-0 text-muted-foreground">
                When can you make it?
              </legend>
              <div className="mt-2 grid gap-2">
                {timeOptions.map((option) => {
                  const active = item.my_reactions.includes(option.key);
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => toggle.mutate({ message_id: item.id, reaction: option.key })}
                      disabled={toggle.isPending || Boolean(linked)}
                      aria-pressed={active}
                      className={cn(
                        "flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 text-left text-xs transition-colors active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
                        active
                          ? "border-transparent text-background"
                          : "border-border bg-background/40 text-foreground",
                      )}
                      style={active ? { backgroundColor: tribeColor } : undefined}
                    >
                      <span className="font-semibold">{option.label}</span>
                      <span className="font-mono text-xs">
                        {option.votes} {option.votes === 1 ? "person" : "people"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Choose every time that works. The host confirms one exact start before publishing.
              </p>
            </fieldset>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
        <button
          type="button"
          onClick={() => toggle.mutate({ message_id: item.id, reaction: "interested" })}
          disabled={toggle.isPending || Boolean(linked)}
          aria-pressed={interested}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
            interested ? "border-transparent text-background" : "border-border text-foreground",
          )}
          style={interested ? { backgroundColor: tribeColor } : undefined}
        >
          <span aria-hidden="true" className="text-sm leading-none">
            🔥
          </span>
          {interested ? "I'm in" : "Interested"}
          {item.reactions.interested > 0 && ` · ${item.reactions.interested}`}
        </button>
        {mine && (
          <button
            type="button"
            onClick={() =>
              share.mutate(
                {
                  tribe_key: tribeId,
                  message_id: item.id,
                  preview: `📋 ${item.content} — ${whenLabel} · ${area}. Open the Plans tab to join.`,
                },
                {
                  onSuccess: () => toast.success("Shared to Chat"),
                  onError: (error) => toast.error((error as Error).message),
                },
              )
            }
            disabled={share.isPending}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-foreground transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            <ShareNetworkIcon className="h-3.5 w-3.5" /> Share to chat
          </button>
        )}
        {mine && !linked && onStartVenture && (
          <button
            type="button"
            onClick={() =>
              onStartVenture({
                sourceMessageId: item.id,
                dbTribeId,
                tribeId,
                title: item.content,
                note,
                whenLabel,
                timeOptions,
                area,
                maxSlots,
              })
            }
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            style={{
              borderColor: `color-mix(in oklab, ${tribeColor} 45%, transparent)`,
              color: readableAccentColor(tribeColor),
            }}
          >
            Turn into Venture <ArrowRightIcon className="h-3.5 w-3.5" />
          </button>
        )}
        {linked && (
          <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-secondary/60 px-3 text-xs font-semibold text-muted-foreground">
            <CheckIcon className="h-3.5 w-3.5" /> Venture live
          </span>
        )}
      </div>
      {!linked && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Interested means “invite me if this goes live.” Nobody joins automatically.
        </p>
      )}
    </article>
  );
}

function VentureAnnouncement({
  item,
  tribeColor,
  onOpenVentures,
  onOpenChats,
}: {
  item: TribeRoomItem;
  tribeColor: string;
  onOpenVentures?: () => void;
  onOpenChats?: () => void;
}) {
  const rawVenture = item.room_metadata.venture;
  const venture =
    rawVenture && typeof rawVenture === "object" ? (rawVenture as Record<string, unknown>) : null;
  const complete =
    venture?.status === "closed" ||
    typeof venture?.ended_at === "string" ||
    typeof venture?.closed_at === "string";
  const filled = typeof venture?.filled_slots === "number" ? venture.filled_slots : 1;
  const slots = roomMetadataNumber(item.room_metadata, "max_slots", 4);
  const onOpen = complete ? onOpenChats : onOpenVentures;

  return (
    <article className="relative overflow-hidden bg-card px-4 py-4">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: tribeColor }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-mono" style={{ color: readableAccentColor(tribeColor) }}>
            {complete ? "Completed together" : "Venture live"}
          </p>
          <h3 className="mt-1 truncate font-display text-lg font-bold">{item.content}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {complete
              ? `${filled} people now share this Venture memory.`
              : `${filled}/${slots} going · the room has become a real plan.`}
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
          {complete ? <SparkleIcon className="h-4 w-4" /> : <TicketIcon className="h-4 w-4" />}
        </span>
      </div>
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded text-xs font-semibold transition-opacity active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={{ color: readableAccentColor(tribeColor) }}
        >
          {complete ? "Open Venture memories" : "Open Venture"}
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </article>
  );
}

function PulseComposer({
  open,
  onClose,
  tribeId,
  tribeName,
  tribeColor,
  prompt,
}: {
  open: boolean;
  onClose: () => void;
  tribeId: TribeId;
  tribeName: string;
  tribeColor: string;
  prompt: ReturnType<typeof dailyPulse>;
}) {
  const [answer, setAnswer] = useState("");
  const mutation = useAnswerDailyPulse(tribeId);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const content = answer.trim();
    if (!content) return;
    mutation.mutate(
      { prompt_id: prompt.id, prompt: prompt.question, content },
      {
        onSuccess: () => {
          setAnswer("");
          onClose();
          toast.success("Added to today's Tribevia");
        },
        onError: (error) => toast.error((error as Error).message),
      },
    );
  };
  return (
    <AnimatedModal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Answer Daily Tribevia"
    >
      <form onSubmit={submit} className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-mono" style={{ color: readableAccentColor(tribeColor) }}>
              Daily Tribevia · {tribeName}
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold leading-tight">
              {prompt.question}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <label className="mt-5 block">
          <span className="sr-only">Your answer</span>
          <textarea
            autoFocus
            value={answer}
            onChange={(event) => setAnswer(event.target.value.slice(0, 600))}
            rows={5}
            placeholder="Keep it specific enough for someone to join in."
            className="w-full resize-none border-y border-border bg-background px-0 py-4 text-base outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </label>
        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">{answer.length}/600</span>
          <button
            type="submit"
            disabled={!answer.trim() || mutation.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-xs font-semibold text-primary-foreground transition-transform active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
            style={{ backgroundColor: tribeColor }}
          >
            {mutation.isPending ? (
              <SpinnerGapIcon className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRightIcon className="h-4 w-4" />
            )}
            Add to Tribevia
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
}

function defaultPlanTimeOptions(mode: "single" | "poll"): TribePlanTimeOption[] {
  const firstDay = todayKey(1);
  const weekend = weekendKey();
  const secondDay = weekend > firstDay ? weekend : todayKey(6);
  const first: TribePlanTimeOption = { key: "time_1", day: firstDay, period: "evening" };
  return mode === "single"
    ? [first]
    : [first, { key: "time_2", day: secondDay, period: "afternoon" }];
}

function PlanComposer({
  open,
  onClose,
  tribeId,
  tribeName,
  tribeColor,
  initialArea,
}: {
  open: boolean;
  onClose: () => void;
  tribeId: TribeId;
  tribeName: string;
  tribeColor: string;
  initialArea: string;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [timingMode, setTimingMode] = useState<"single" | "poll">("single");
  const [timeOptions, setTimeOptions] = useState<TribePlanTimeOption[]>(() =>
    defaultPlanTimeOptions("single"),
  );
  const [area, setArea] = useState(initialArea);
  const [maxSlots, setMaxSlots] = useState(4);
  const mutation = useCreateTribePlan(tribeId);
  const distinctTimeCount = new Set(timeOptions.map((option) => `${option.day}:${option.period}`))
    .size;
  const validTiming =
    timeOptions.length === distinctTimeCount &&
    (timingMode === "single" ? timeOptions.length === 1 : timeOptions.length >= 2);
  const chooseTimingMode = (mode: "single" | "poll") => {
    setTimingMode(mode);
    setTimeOptions((current) => {
      if (mode === "single") return [current[0] ?? defaultPlanTimeOptions("single")[0]];
      if (current.length >= 2) return current;
      const defaults = defaultPlanTimeOptions("poll");
      return [current[0] ?? defaults[0], defaults[1]];
    });
  };
  const updateTimeOption = (
    index: number,
    update: Partial<Pick<TribePlanTimeOption, "day" | "period">>,
  ) => {
    setTimeOptions((current) =>
      current.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...update } : option,
      ),
    );
  };
  const addTimeOption = () => {
    setTimeOptions((current) => {
      if (current.length >= 3) return current;
      const index = current.length;
      return [
        ...current,
        {
          key: `time_${index + 1}` as TribePlanTimeOption["key"],
          day: todayKey(index + 2),
          period: index === 1 ? "afternoon" : "evening",
        },
      ];
    });
  };
  const removeTimeOption = (index: number) => {
    setTimeOptions((current) =>
      current
        .filter((_option, optionIndex) => optionIndex !== index)
        .map((option, optionIndex) => ({
          ...option,
          key: `time_${optionIndex + 1}` as TribePlanTimeOption["key"],
        })),
    );
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim().length < 3 || area.trim().length < 2 || !validTiming) return;
    mutation.mutate(
      {
        title: title.trim(),
        note: note.trim(),
        timing_mode: timingMode,
        time_options: timeOptions,
        area: area.trim(),
        max_slots: maxSlots,
      },
      {
        onSuccess: () => {
          setTitle("");
          setNote("");
          setTimingMode("single");
          setTimeOptions(defaultPlanTimeOptions("single"));
          onClose();
          toast.success("Plan added to the room");
        },
        onError: (error) => toast.error((error as Error).message),
      },
    );
  };
  return (
    <AnimatedModal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Propose a plan"
      contentClassName="flex max-h-[92svh] flex-col overflow-hidden"
    >
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="label-mono" style={{ color: readableAccentColor(tribeColor) }}>
              Plan together · {tribeName}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold">What could the room do?</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              This is a temperature check, not a commitment.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="scroll-panel min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <RoomField label="What is the idea?">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value.slice(0, 80))}
              placeholder="Small gallery hop"
              className="w-full border-b border-border bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <span className="mt-1 block text-right font-mono text-xs text-muted-foreground">
              {title.length}/80
            </span>
          </RoomField>
          <RoomField label="Give the room a little context">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 280))}
              placeholder="Two galleries, then somewhere quiet to talk about what we saw."
              rows={3}
              className="w-full resize-none border-b border-border bg-transparent py-3 text-sm outline-none focus:border-primary"
            />
          </RoomField>
          <RoomGroup label="When could this happen?">
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-2xl border border-border bg-background p-1">
              {(
                [
                  ["single", "Pick one window"],
                  ["poll", "Ask the room"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={timingMode === mode}
                  onClick={() => chooseTimingMode(mode)}
                  className={cn(
                    "min-h-11 rounded-xl px-3 text-xs font-semibold transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    timingMode === mode ? "text-background" : "text-muted-foreground",
                  )}
                  style={timingMode === mode ? { backgroundColor: tribeColor } : undefined}
                >
                  {label}
                </button>
              ))}
            </div>

            {timingMode === "single" ? (
              <div className="mt-3 space-y-3 border-l-2 border-border pl-3">
                <div className="flex flex-wrap gap-2">
                  {dayChoices().map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => updateTimeOption(0, { day: choice.value })}
                      className={cn(
                        "min-h-11 rounded-full border px-3 text-xs font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        timeOptions[0]?.day === choice.value
                          ? "border-transparent text-background"
                          : "border-border text-muted-foreground",
                      )}
                      style={
                        timeOptions[0]?.day === choice.value
                          ? { backgroundColor: tribeColor }
                          : undefined
                      }
                    >
                      {choice.label}
                    </button>
                  ))}
                  <label className="relative">
                    <span className="sr-only">Pick another date</span>
                    <input
                      type="date"
                      min={todayKey()}
                      value={timeOptions[0]?.day ?? todayKey(1)}
                      onChange={(event) =>
                        event.target.value && updateTimeOption(0, { day: event.target.value })
                      }
                      className="min-h-11 rounded-full border border-border bg-background px-3 font-mono text-xs outline-none focus:border-primary"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PLAN_PERIOD_CHOICES.map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => updateTimeOption(0, { period: choice.value })}
                      className={cn(
                        "min-h-11 rounded-full border px-3 text-xs font-semibold capitalize transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        timeOptions[0]?.period === choice.value
                          ? "border-transparent text-background"
                          : "border-border text-muted-foreground",
                      )}
                      style={
                        timeOptions[0]?.period === choice.value
                          ? { backgroundColor: tribeColor }
                          : undefined
                      }
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
                {timeOptions[0] && (
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    {planTimeLabel(timeOptions[0].day, timeOptions[0].period)}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-3 space-y-2 border-l-2 border-border pl-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Add two or three windows. Members can choose every option that works.
                </p>
                {timeOptions.map((option, index) => (
                  <div
                    key={option.key}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-b border-border py-2"
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full font-mono text-xs font-bold text-background"
                      style={{ backgroundColor: tribeColor }}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <label>
                        <span className="sr-only">Option {index + 1} date</span>
                        <input
                          type="date"
                          min={todayKey()}
                          value={option.day}
                          onChange={(event) =>
                            event.target.value &&
                            updateTimeOption(index, { day: event.target.value })
                          }
                          className="min-h-11 rounded-xl border border-border bg-background px-2 font-mono text-xs outline-none focus:border-primary"
                        />
                      </label>
                      <label className="min-w-0 flex-1">
                        <span className="sr-only">Option {index + 1} time window</span>
                        <select
                          value={option.period}
                          onChange={(event) =>
                            updateTimeOption(index, {
                              period: event.target.value as PlanPeriod,
                            })
                          }
                          className="min-h-11 w-full rounded-xl border border-border bg-background px-2 text-xs font-semibold outline-none focus:border-primary"
                        >
                          {PLAN_PERIOD_CHOICES.map((choice) => (
                            <option key={choice.value} value={choice.value}>
                              {choice.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {timeOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeTimeOption(index)}
                          aria-label={`Remove option ${index + 1}`}
                          className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {timeOptions.length < 3 && (
                  <button
                    type="button"
                    onClick={addTimeOption}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded text-xs font-semibold transition-opacity active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    style={{ color: readableAccentColor(tribeColor) }}
                  >
                    <PlusIcon className="h-3.5 w-3.5" /> Add another time
                  </button>
                )}
                {!validTiming && (
                  <p className="text-xs font-medium text-destructive">
                    Each option needs a different date or time window.
                  </p>
                )}
              </div>
            )}
          </RoomGroup>
          <RoomField label="Area—not the exact meeting point">
            <input
              value={area}
              onChange={(event) => setArea(event.target.value.slice(0, 120))}
              placeholder="Kemang, Jakarta Selatan"
              className="w-full border-b border-border bg-transparent py-3 text-sm outline-none focus:border-primary"
            />
          </RoomField>
          <RoomField label="Room size">
            <div className="flex items-center justify-between border-b border-border py-2">
              <span className="text-sm text-muted-foreground">Up to {maxSlots} people</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMaxSlots((value) => Math.max(2, value - 1))}
                  aria-label="Fewer people"
                  className="h-11 w-11 rounded-full border border-border text-lg transition-colors hover:bg-secondary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  −
                </button>
                <span className="w-5 text-center font-display text-lg font-bold">{maxSlots}</span>
                <button
                  type="button"
                  onClick={() => setMaxSlots((value) => Math.min(20, value + 1))}
                  aria-label="More people"
                  className="h-11 w-11 rounded-full border border-border text-lg transition-colors hover:bg-secondary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  +
                </button>
              </div>
            </div>
          </RoomField>
        </div>
        <div className="shrink-0 border-t border-border bg-card px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <p className="text-xs leading-relaxed text-muted-foreground">
            If you later publish this as a Venture, everyone who tapped Interested receives an
            invite and decides for themselves.
          </p>
          <button
            type="submit"
            disabled={
              title.trim().length < 3 ||
              area.trim().length < 2 ||
              !validTiming ||
              mutation.isPending
            }
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-background transition-transform active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
            style={{ backgroundColor: tribeColor }}
          >
            {mutation.isPending ? (
              <SpinnerGapIcon className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlusIcon className="h-4 w-4" />
            )}
            Share plan with the room
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
}

function RoomField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-2xl border border-border/80 bg-background/45 p-4">
      <span className="label-mono">{label}</span>
      {children}
    </label>
  );
}

function RoomGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="block rounded-2xl border border-border/80 bg-background/45 p-4">
      <legend className="label-mono">{label}</legend>
      {children}
    </fieldset>
  );
}

function Avatar({ item, className }: { item: TribeRoomItem; className?: string }) {
  const name = item.author?.display_name ?? "Member";
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-secondary text-xs font-semibold",
        className,
      )}
      title={name}
    >
      {item.author?.avatar_url ? (
        <img src={item.author.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

function RoomLines() {
  return (
    <div className="space-y-3" aria-label="Loading room plans">
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
    </div>
  );
}
