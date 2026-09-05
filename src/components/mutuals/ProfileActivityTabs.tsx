import { GridFourIcon } from "@phosphor-icons/react/dist/csr/GridFour";
import { RepeatIcon } from "@phosphor-icons/react/dist/csr/Repeat";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { cn } from "@/lib/utils";

export type ProfileActivityTab = "signals" | "ventures" | "vibes";
export type ProfileSignalView = "original" | "reposts";

const TABS = [
  { id: "signals", label: "Signals", icon: GridFourIcon },
  { id: "ventures", label: "Ventures", icon: LightningIcon },
  { id: "vibes", label: "Vibes", icon: SparkleIcon },
] as const;

export function ProfileActivityTabs({
  value,
  onChange,
}: {
  value: ProfileActivityTab;
  onChange: (tab: ProfileActivityTab) => void;
}) {
  return (
    <div
      className="mb-5 mt-8 flex border-b border-border"
      role="tablist"
      aria-label="Profile sections"
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center gap-1.5 pb-2.5 text-xs transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
              active
                ? "font-bold text-primary shadow-[inset_0_-2px_0_var(--color-primary)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

const SIGNAL_VIEWS = [
  { id: "original", label: "Original", icon: GridFourIcon },
  { id: "reposts", label: "Reposts", icon: RepeatIcon },
] as const;

export function ProfileSignalFilter({
  value,
  onChange,
}: {
  value: ProfileSignalView;
  onChange: (view: ProfileSignalView) => void;
}) {
  return (
    <div
      className="-mt-2 mb-5 grid grid-cols-2 rounded-2xl bg-secondary/70 p-1"
      role="group"
      aria-label="Signal type"
    >
      {SIGNAL_VIEWS.map(({ id, label, icon: Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(id)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-[background-color,color,box-shadow,transform] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
