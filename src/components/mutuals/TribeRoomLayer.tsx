import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarPlus,
  Check,
  Clock3,
  Flame,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { useAuth } from "@/lib/auth-context";
import type { TribeId } from "@/lib/mutuals-data";
import {
  dailyPulse,
  roomMetadataNumber,
  roomMetadataString,
  type TribeRoomItem,
  type TribeVentureDraft,
} from "@/lib/tribe-room";
import {
  useAnswerDailyPulse,
  useCreateTribePlan,
  useMarkTribeRoomRead,
  useToggleTribeRoomReaction,
  useTribeRoom,
} from "@/lib/tribe-room-store";
import { cn } from "@/lib/utils";

type RoomView = "room" | "plans";

export function TribeRoomLayer({
  tribeId,
  tribeName,
  tribeColor,
  city,
  canParticipate,
  onStartVenture,
  onOpenVentures,
  onOpenChats,
}: {
  tribeId: TribeId;
  tribeName: string;
  tribeColor: string;
  city: string;
  canParticipate: boolean;
  onStartVenture?: (draft: TribeVentureDraft) => void;
  onOpenVentures?: () => void;
  onOpenChats?: () => void;
}) {
  const { user } = useAuth();
  const [view, setView] = useState<RoomView>("room");
  const [pulseOpen, setPulseOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const room = useTribeRoom(tribeId, canParticipate);
  const markRead = useMarkTribeRoomRead(tribeId);
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

  return (
    <section className="mt-4" aria-labelledby="tribe-room-heading">
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex min-h-11 items-center gap-5" role="tablist" aria-label="Tribe Room">
          {(["room", "plans"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={cn(
                "relative min-h-11 text-xs font-semibold capitalize text-muted-foreground transition-colors",
                view === key && "text-foreground",
              )}
            >
              {key === "room" ? "Room" : `Plans${plans.length ? ` · ${plans.length}` : ""}`}
              {view === key && (
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5"
                  style={{ backgroundColor: tribeColor }}
                />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPlanOpen(true)}
          disabled={!canParticipate}
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold disabled:opacity-40"
          style={{ color: tribeColor }}
        >
          <CalendarPlus className="h-4 w-4" /> Propose
        </button>
      </div>

      {room.isError && (
        <div className="mt-4 flex items-center gap-3 border-l-2 border-primary/70 bg-secondary/35 px-4 py-3">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
            Room activities are resting. The live chat below is still open.
          </p>
          <button
            type="button"
            onClick={() => room.refetch()}
            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {view === "room" ? (
        <div className="space-y-5 pt-4">
          <DailyPulse
            prompt={prompt}
            answers={pulseAnswers}
            answered={answered}
            loading={room.isLoading}
            tribeId={tribeId}
            tribeColor={tribeColor}
            disabled={!canParticipate}
            onAnswer={() => setPulseOpen(true)}
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

          <div className="flex items-center gap-3 pt-1">
            <span className="h-px flex-1 bg-border" />
            <span id="tribe-room-heading" className="label-mono inline-flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> Live room
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      ) : (
        <div className="space-y-3 pt-4">
          {room.isLoading && <RoomLines />}
          {!room.isLoading && plans.length === 0 && (
            <div className="py-9 text-center">
              <CalendarPlus className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">No plans on the table</p>
              <p className="mx-auto mt-1 max-w-64 text-xs leading-relaxed text-muted-foreground">
                Start with a loose idea. The room can show interest before you commit to hosting.
              </p>
              <button
                type="button"
                onClick={() => setPlanOpen(true)}
                className="mt-4 min-h-11 px-4 text-xs font-semibold"
                style={{ color: tribeColor }}
              >
                Propose a plan
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
      )}

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
        onClose={() => setPlanOpen(false)}
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
  tribeColor,
  disabled,
  onAnswer,
}: {
  prompt: ReturnType<typeof dailyPulse>;
  answers: TribeRoomItem[];
  answered: boolean;
  loading: boolean;
  tribeId: TribeId;
  tribeColor: string;
  disabled: boolean;
  onAnswer: () => void;
}) {
  return (
    <div
      className="relative overflow-hidden border-l-2 bg-card/60 px-4 py-4"
      style={{ borderColor: tribeColor }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="label-mono inline-flex items-center gap-1.5" style={{ color: tribeColor }}>
          <Sparkles className="h-3.5 w-3.5" /> Daily Pulse
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
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
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          style={{ backgroundColor: tribeColor }}
        >
          {answered ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          {answered ? "Answered" : "Add yours"}
        </button>
      </div>
      {answers.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-border pt-3">
          {answers.slice(-2).map((answer) => (
            <PulseAnswer key={answer.id} item={answer} tribeId={tribeId} tribeColor={tribeColor} />
          ))}
        </div>
      )}
    </div>
  );
}

function AnswerFaces({ answers }: { answers: TribeRoomItem[] }) {
  if (!answers.length)
    return <span className="text-[11px] text-muted-foreground">Be first in</span>;
  return (
    <div className="flex items-center">
      {answers.slice(-4).map((answer, index) => (
        <Avatar key={answer.id} item={answer} className={cn(index > 0 && "-ml-2")} />
      ))}
      {answers.length > 4 && (
        <span className="ml-2 text-[10px] text-muted-foreground">+{answers.length - 4}</span>
      )}
    </div>
  );
}

function PulseAnswer({
  item,
  tribeId,
  tribeColor,
}: {
  item: TribeRoomItem;
  tribeId: TribeId;
  tribeColor: string;
}) {
  const reaction = useToggleTribeRoomReaction(tribeId);
  const active = item.my_reactions.includes("spark");
  return (
    <div className="flex items-start gap-2.5">
      <Avatar item={item} />
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-foreground/90">
        <span className="font-semibold">{item.author?.display_name ?? "Member"}</span>{" "}
        <span className="text-muted-foreground">{item.content}</span>
      </p>
      <button
        type="button"
        onClick={() => reaction.mutate({ message_id: item.id, reaction: "spark" })}
        disabled={reaction.isPending}
        aria-pressed={active}
        aria-label={active ? "Remove spark" : "Add spark"}
        className={cn(
          "inline-flex min-h-11 min-w-11 items-center justify-center gap-1 text-[10px]",
          !active && "text-muted-foreground",
        )}
        style={active ? { color: tribeColor } : undefined}
      >
        <Flame className="h-3.5 w-3.5" /> {item.reactions.spark || ""}
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
  const interested = item.my_reactions.includes("interested");
  const whenLabel = roomMetadataString(item.room_metadata, "when_label", "Timing open");
  const area = roomMetadataString(item.room_metadata, "area", "Area open");
  const note = roomMetadataString(item.room_metadata, "note");
  const maxSlots = roomMetadataNumber(item.room_metadata, "max_slots", 4);

  return (
    <article className="border-y border-border bg-card/45 px-1 py-4 first:border-t">
      <div className="flex items-start gap-3">
        <Avatar item={item} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">
            {item.author?.display_name ?? "A member"} put a plan on the table
          </p>
          <h3 className="mt-1 font-display text-lg font-bold leading-tight">{item.content}</h3>
          {note && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{note}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" /> {whenLabel}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {area}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> up to {maxSlots}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 pl-11">
        <button
          type="button"
          onClick={() => toggle.mutate({ message_id: item.id, reaction: "interested" })}
          disabled={toggle.isPending || Boolean(linked)}
          aria-pressed={interested}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-50",
            interested ? "border-transparent text-background" : "border-border text-foreground",
          )}
          style={interested ? { backgroundColor: tribeColor } : undefined}
        >
          <Flame className="h-3.5 w-3.5" />
          {interested ? "I'm in" : "Interested"}
          {item.reactions.interested > 0 && ` · ${item.reactions.interested}`}
        </button>
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
                area,
                maxSlots,
              })
            }
            className="inline-flex min-h-11 items-center gap-1.5 px-2 text-xs font-semibold"
            style={{ color: tribeColor }}
          >
            Build Venture <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
        {linked && (
          <span className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Check className="h-3.5 w-3.5" /> Venture live
          </span>
        )}
      </div>
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
          <p className="label-mono" style={{ color: tribeColor }}>
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
          {complete ? <Sparkles className="h-4 w-4" /> : <Ticket className="h-4 w-4" />}
        </span>
      </div>
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold"
          style={{ color: tribeColor }}
        >
          {complete ? "Open Venture memories" : "Open Venture"}
          <ArrowRight className="h-3.5 w-3.5" />
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
          toast.success("Added to today's Pulse");
        },
        onError: (error) => toast.error((error as Error).message),
      },
    );
  };
  return (
    <AnimatedModal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Answer Daily Pulse"
    >
      <form onSubmit={submit} className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-mono" style={{ color: tribeColor }}>
              Daily Pulse · {tribeName}
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold leading-tight">
              {prompt.question}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center text-muted-foreground"
          >
            <X className="h-5 w-5" />
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
          <span className="font-mono text-[10px] text-muted-foreground">{answer.length}/600</span>
          <button
            type="submit"
            disabled={!answer.trim() || mutation.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            style={{ backgroundColor: tribeColor }}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Add to Pulse
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
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
  const [whenLabel, setWhenLabel] = useState("This week");
  const [area, setArea] = useState(initialArea);
  const [maxSlots, setMaxSlots] = useState(4);
  const mutation = useCreateTribePlan(tribeId);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim().length < 3 || area.trim().length < 2) return;
    mutation.mutate(
      {
        title: title.trim(),
        note: note.trim(),
        when_label: whenLabel,
        area: area.trim(),
        max_slots: maxSlots,
      },
      {
        onSuccess: () => {
          setTitle("");
          setNote("");
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
      contentClassName="max-h-[92svh] overflow-y-auto"
    >
      <form onSubmit={submit} className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-mono" style={{ color: tribeColor }}>
              Loose plan · {tribeName}
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold">Put it on the table.</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Interest first. Hosting only starts when you turn it into a Venture.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <RoomField label="What is the idea?">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value.slice(0, 80))}
              placeholder="Small gallery hop"
              className="w-full border-b border-border bg-transparent py-3 text-base outline-none focus:border-primary"
            />
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
          <RoomField label="Rough timing">
            <div className="flex flex-wrap gap-2 pt-2">
              {["Tonight", "This week", "This weekend", "Next week"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setWhenLabel(value)}
                  className={cn(
                    "min-h-11 rounded-full border px-3 text-xs font-semibold",
                    whenLabel === value
                      ? "border-transparent text-background"
                      : "border-border text-muted-foreground",
                  )}
                  style={whenLabel === value ? { backgroundColor: tribeColor } : undefined}
                >
                  {value}
                </button>
              ))}
            </div>
          </RoomField>
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
                  className="h-11 w-11 rounded-full border border-border text-lg"
                >
                  −
                </button>
                <span className="w-5 text-center font-display text-lg font-bold">{maxSlots}</span>
                <button
                  type="button"
                  onClick={() => setMaxSlots((value) => Math.min(20, value + 1))}
                  aria-label="More people"
                  className="h-11 w-11 rounded-full border border-border text-lg"
                >
                  +
                </button>
              </div>
            </div>
          </RoomField>
        </div>
        <button
          type="submit"
          disabled={title.trim().length < 3 || area.trim().length < 2 || mutation.isPending}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-primary-foreground disabled:opacity-50"
          style={{ backgroundColor: tribeColor }}
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarPlus className="h-4 w-4" />
          )}
          Propose to the room
        </button>
      </form>
    </AnimatedModal>
  );
}

function RoomField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-mono">{label}</span>
      {children}
    </label>
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
      <div className="h-24 animate-pulse bg-muted/60" />
      <div className="h-24 animate-pulse bg-muted/40" />
    </div>
  );
}
