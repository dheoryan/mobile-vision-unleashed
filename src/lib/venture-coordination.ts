import type { VentureArrivalStatus, VentureParty } from "./ventures.functions";

export const VENTURE_ARRIVAL_CHOICES: ReadonlyArray<{
  value: VentureArrivalStatus;
  label: string;
}> = [
  { value: "on_my_way", label: "On my way" },
  { value: "arrived", label: "I’m here" },
  { value: "running_late", label: "Running late" },
  { value: "cant_make_it", label: "Can’t make it" },
];

export const VENTURE_EMPTY_PROMPTS = [
  { label: "Introduce yourself", text: "Hey everyone — looking forward to this!" },
  { label: "Ask where to meet", text: "Where should we meet when we arrive?" },
  {
    label: "Share arrival time",
    text: "What time is everyone planning to get there?",
  },
] as const;

export function arrivalStatusLabel(status: VentureArrivalStatus): string {
  return VENTURE_ARRIVAL_CHOICES.find((choice) => choice.value === status)?.label ?? status;
}

export function ventureReminderLabel(
  venture: Pick<VentureParty, "starts_at" | "ends_at">,
  now: Date = new Date(),
): string | null {
  if (!venture.starts_at) return null;
  const start = Date.parse(venture.starts_at);
  if (!Number.isFinite(start)) return null;
  const end = venture.ends_at ? Date.parse(venture.ends_at) : Number.NaN;
  const delta = start - now.getTime();

  if (delta <= 0 && (!Number.isFinite(end) || end > now.getTime())) return "Happening now";
  if (delta <= 0 || delta > 2 * 60 * 60 * 1000) return null;

  const minutes = Math.max(1, Math.ceil(delta / 60_000));
  if (minutes < 60) return `Starts in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `Starts in ${hours} hr ${remaining} min` : `Starts in ${hours} hr`;
}

export function venturePlaceLabel(venture: Pick<VentureParty, "venue">): string | null {
  if (!venture.venue) return null;
  return [venture.venue.host_label.trim(), venture.venue.area.trim()].filter(Boolean).join(" · ");
}
