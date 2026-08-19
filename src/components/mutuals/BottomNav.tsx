import { motion } from "motion/react";
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
              <motion.button
                onClick={() => onChange(key)}
                whileTap={{ scale: 0.9 }}
                className={cn(
                  "flex w-full flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={label}
              >
                <span className="relative flex h-8 w-8 items-center justify-center rounded-full">
                  {isActive && (
                    <motion.span
                      layoutId="bottom-nav-active-pill"
                      className="absolute inset-0 rounded-full bg-primary/15"
                      transition={{ type: "spring", stiffness: 500, damping: 34 }}
                    />
                  )}
                  <motion.span
                    key={isActive ? "active" : "inactive"}
                    className="relative"
                    initial={isActive ? { scale: 1 } : false}
                    animate={isActive ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                    transition={{ duration: 0.32, ease: "easeOut" }}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </motion.span>
                </span>
                <span className="text-[10px] font-medium tracking-wide">{label}</span>
              </motion.button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
