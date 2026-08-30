import { ChevronRight, Globe2, Lock } from "lucide-react";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { cn } from "@/lib/utils";
import { TribeMark } from "./TribeMark";

export type RepostAudience = "tribe" | "all";

export function RepostAudienceChoices({
  tribeId,
  allowWild,
  disabled = false,
  onSelect,
}: {
  tribeId: TribeId;
  allowWild: boolean;
  disabled?: boolean;
  onSelect: (audience: RepostAudience) => void;
}) {
  const tribe = tribeById(tribeId);

  return (
    <div>
      <p className="label-mono px-5 pb-2 pt-4 text-muted-foreground">REPOST TO</p>
      <div className="border-y border-border">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect("tribe")}
          className="group flex min-h-[4.75rem] w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-secondary/55 active:bg-secondary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          aria-label={`Repost to your Tribe, ${tribe.name}`}
        >
          <TribeMark tribe={tribe} size="sm" className="h-11 w-11 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">My Tribe</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Only people in {tribe.name}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>

        <button
          type="button"
          disabled={disabled || !allowWild}
          onClick={() => onSelect("all")}
          className="group flex min-h-[4.75rem] w-full items-center gap-3 border-t border-border px-5 py-3 text-left transition-colors hover:bg-secondary/55 active:bg-secondary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          aria-label={
            allowWild ? "Repost to The Wild" : "The Wild is unavailable for a Tribe-only signal"
          }
        >
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
              allowWild
                ? "bg-meutuals-gradient text-primary-foreground"
                : "bg-primary/12 text-primary",
            )}
          >
            {allowWild ? <Globe2 className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">The Wild</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {allowWild ? "People across every Tribe" : "The original is Tribe-only"}
            </span>
          </span>
          {allowWild && (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          )}
        </button>
      </div>
    </div>
  );
}
