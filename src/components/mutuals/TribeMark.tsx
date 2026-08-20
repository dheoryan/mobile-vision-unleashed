import { tribeById, type Tribe, type TribeId } from "@/lib/mutuals-data";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  xs: "h-5 w-5",
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-14 w-14",
  xl: "h-20 w-20",
} as const;

export function TribeMark({
  tribe: tribeInput,
  size = "md",
  className,
  decorative = true,
}: {
  tribe: Tribe | TribeId;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
  decorative?: boolean;
}) {
  const tribe = typeof tribeInput === "string" ? tribeById(tribeInput) : tribeInput;

  return (
    <span
      className={cn("inline-flex shrink-0 overflow-hidden rounded-full border border-white/15 bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.35)]", SIZE_CLASSES[size], className)}
      style={{ boxShadow: `0 0 0 1px color-mix(in oklab, ${tribe.colorVar} 55%, transparent)` }}
    >
      <img src={tribe.crest} alt={decorative ? "" : `${tribe.name} crest`} className="h-full w-full object-cover" />
    </span>
  );
}
