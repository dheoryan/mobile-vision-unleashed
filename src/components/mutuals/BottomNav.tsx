import { NewspaperIcon } from "@phosphor-icons/react/dist/csr/Newspaper";
import { GlobeHemisphereWestIcon } from "@phosphor-icons/react/dist/csr/GlobeHemisphereWest";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { ChatCircleDotsIcon } from "@phosphor-icons/react/dist/csr/ChatCircleDots";
import { UserIcon } from "@phosphor-icons/react/dist/csr/User";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * One job per tab, and each tab answers exactly one question:
 *
 *   feed      what's happening?      (Tribe / The Wild, switched inside)
 *   discover  who's out there?
 *   ventures  what can I do?
 *   chats     who am I talking to?
 *   profile   who am I?
 *
 * The old set spent two tabs on feeds ("tribe" and "timeline") while
 * conversations had no tab at all — party chats and DMs were only reachable by
 * remembering which Venture or person they hung off. TimelineScreen already
 * carried the Tribe/Wild switch, so folding the Tribe room into Chats freed a
 * slot for the thing that had none.
 */
export type TabKey = "feed" | "discover" | "ventures" | "chats" | "profile";

const tabs: { key: TabKey; label: string; icon: Icon }[] = [
  { key: "feed", label: "Timeline", icon: NewspaperIcon },
  { key: "discover", label: "Discover", icon: GlobeHemisphereWestIcon },
  { key: "ventures", label: "Ventures", icon: LightningIcon },
  { key: "chats", label: "Chats", icon: ChatCircleDotsIcon },
  { key: "profile", label: "Profile", icon: UserIcon },
];

export function BottomNav({
  active,
  onChange,
  chatsBadge,
}: {
  active: TabKey;
  onChange: (t: TabKey) => void;
  /** Unread DM count. Tribe and Venture rooms have no read pointer in the
   *  schema, so this deliberately counts direct messages only. */
  chatsBadge?: number;
}) {
  return (
    <nav
      className="glass fixed bottom-0 left-0 right-0 z-30 border-t border-border"
      style={{
        background: "color-mix(in oklab, var(--color-background) 56%, transparent)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
      }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1.5 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5">
        {tabs.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          const badge = key === "chats" ? chatsBadge : undefined;
          return (
            <li key={key} className="flex-1">
              <button
                onClick={() => onChange(key)}
                className={cn(
                  "flex w-full flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isActive
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label={label}
              >
                <span
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center",
                    // .animate-tab exists in styles.css for exactly this - a
                    // one-shot bounce - but had never been wired to a tab
                    // control. It's a class add on activation (isActive false
                    // -> true), not a looping state, so it naturally only
                    // plays once per switch rather than on every render.
                    isActive && "animate-tab",
                  )}
                >
                  <Icon className="h-5 w-5" weight={isActive ? "fill" : "regular"} />
                  {!!badge && (
                    <span className="bg-meutuals-gradient absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-xs font-bold leading-none text-white ring-2 ring-background">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span className="text-xs font-medium tracking-wide">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
