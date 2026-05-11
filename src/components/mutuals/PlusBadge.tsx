import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small ⚡ amber overlay for MUTUALS+ members. Place inside a `relative` wrapper. */
export function PlusBadge({ size = "sm", className = "" }: { size?: "sm" | "md"; className?: string }) {
  const s = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span
      className={cn(
        "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-background",
        s,
        className
      )}
      aria-label="MUTUALS+ member"
      title="MUTUALS+ member"
    >
      <Zap className={size === "md" ? "h-3 w-3" : "h-2.5 w-2.5"} strokeWidth={2.6} fill="currentColor" />
    </span>
  );
}

export function PlusInlineBadge() {
  return (
    <span className="label-mono inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-primary">
      <Zap className="h-2.5 w-2.5" fill="currentColor" /> +
    </span>
  );
}
