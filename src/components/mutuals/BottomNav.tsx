import { Tent, Newspaper, Globe2, Zap, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabKey = "tribe" | "timeline" | "discover" | "ventures" | "profile";

const tabs: { key: TabKey; label: string; icon: typeof Tent }[] = [
  { key: "tribe",    label: "Tribe",    icon: Tent },
  { key: "timeline", label: "Timeline", icon: Newspaper },
  { key: "discover", label: "Discover", icon: Globe2 },
  { key: "ventures", label: "Ventures", icon: Zap },
  { key: "profile",  label: "Profile",  icon: User },
];

export function BottomNav({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <nav className="glass fixed bottom-0 left-0 right-0 z-30 border-t border-border">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1.5 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5">
        {tabs.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <li key={key} className="flex-1">
              <button
                onClick={() => onChange(key)}
                className={cn(
                  "flex w-full flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={label}
              >
                <span className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  isActive ? "bg-primary/15" : "bg-transparent"
                )}>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </span>
                <span className="text-[10px] font-medium tracking-wide">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
