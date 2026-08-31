import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { cn } from "@/lib/utils";

/** Small ⚡ amber overlay for MEUTUALS+ members. Place inside a `relative` wrapper. */
export function PlusBadge({
  size = "sm",
  className = "",
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  const s = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span
      className={cn(
        "absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow ring-2 ring-background",
        s,
        className,
      )}
      aria-label="MEUTUALS+ member"
      title="MEUTUALS+ member"
    >
      <LightningIcon
        className={size === "md" ? "h-3 w-3" : "h-2.5 w-2.5"}
        strokeWidth={2.6}
        weight="fill"
      />
    </span>
  );
}

export function PlusInlineBadge() {
  return (
    <span className="label-mono inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-primary">
      <LightningIcon className="h-2.5 w-2.5" weight="fill" /> +
    </span>
  );
}
