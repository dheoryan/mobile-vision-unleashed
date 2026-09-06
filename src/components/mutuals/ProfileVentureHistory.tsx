import { CalendarIcon } from "@phosphor-icons/react/dist/csr/Calendar";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import type { ProfileVentureHistoryItem } from "@/lib/ventures.functions";
import { timingLabel, ventureLifecycle } from "@/lib/venture-time";

function isCompleted(venture: ProfileVentureHistoryItem): boolean {
  return ventureLifecycle(venture) === "completed";
}

function VentureHistoryCard({
  venture,
  onSelect,
}: {
  venture: ProfileVentureHistoryItem;
  onSelect?: (venture: ProfileVentureHistoryItem) => void;
}) {
  const completed = isCompleted(venture);
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 truncate font-semibold">
          {venture.title || venture.intents.slice(0, 3).join(" · ") || "Open Venture"}
        </p>
        <span className="label-mono shrink-0 text-primary">
          {venture.profile_role === "hosted" ? "Hosted" : "Joined"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarIcon className="h-3.5 w-3.5" />
          {timingLabel(venture) ?? (completed ? "Completed" : "Schedule pending")}
        </span>
        <span className="inline-flex items-center gap-1">
          <UsersIcon className="h-3.5 w-3.5" />
          {venture.filled_slots}/{venture.max_slots} joined
        </span>
      </div>
    </>
  );

  const classes =
    "w-full rounded-2xl border border-border bg-card p-4 text-left text-sm transition-colors hover:border-primary/40 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return onSelect ? (
    <button type="button" onClick={() => onSelect(venture)} className={classes}>
      {content}
    </button>
  ) : (
    <article className={classes}>{content}</article>
  );
}

export function ProfileVentureHistory({
  ventures,
  onSelect,
}: {
  ventures: ProfileVentureHistoryItem[];
  onSelect?: (venture: ProfileVentureHistoryItem) => void;
}) {
  const visible = ventures.filter((venture) => ventureLifecycle(venture) !== "cancelled");
  const upcoming = visible.filter((venture) => !isCompleted(venture));
  const past = visible.filter(isCompleted);

  return (
    <div className="space-y-5">
      {upcoming.length > 0 && (
        <section aria-labelledby="profile-upcoming-ventures">
          <p id="profile-upcoming-ventures" className="label-mono mb-2 text-muted-foreground">
            Upcoming
          </p>
          <div className="space-y-2">
            {upcoming.map((venture) => (
              <VentureHistoryCard key={venture.id} venture={venture} onSelect={onSelect} />
            ))}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section aria-labelledby="profile-past-ventures">
          <p id="profile-past-ventures" className="label-mono mb-2 text-muted-foreground">
            Past ventures
          </p>
          <div className="space-y-2">
            {past.map((venture) => (
              <VentureHistoryCard key={venture.id} venture={venture} onSelect={onSelect} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
