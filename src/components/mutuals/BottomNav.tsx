import { Home, Compass, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabKey = "tribe" | "timeline" | "ventures" | "profile";

const tabs: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: "tribe",    label: "Tribe",    icon: Home },
  { key: "timeline", label: "Discover", icon: Compass },
  { key: "ventures", label: "Ventures", icon: Sparkles },
  { key: "profile",  label: "You",      icon: User },
];

export function BottomNav({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <nav className="glass fixed bottom-0 left-0 right-0 z-30 border-t border-border">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
        {tabs.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <li key={key} className="flex-1">
              <button
                onClick={() => onChange(key)}
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={label}
              >
                <span className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full transition-all",
                  isActive ? "bg-primary/15" : "bg-transparent"
                )}>
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <span className="text-[11px] font-medium tracking-wide">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
