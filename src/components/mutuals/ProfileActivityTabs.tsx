import { Grid3x3, Repeat2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProfileActivityTab = "signals" | "reposts" | "ventures";

const TABS = [
  { id: "signals", label: "Signals", icon: Grid3x3 },
  { id: "reposts", label: "Reposts", icon: Repeat2 },
  { id: "ventures", label: "Ventures", icon: Zap },
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
      aria-label="Profile activity"
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
