import { BellIcon } from "@phosphor-icons/react/dist/csr/Bell";
import { Link } from "@tanstack/react-router";
import { useNotifications } from "@/lib/notifications-store";

export function NotificationBell() {
  const { unread } = useNotifications();
  return (
    <Link
      to="/notifications"
      aria-label="Notifications"
      className="relative flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <BellIcon className="h-5 w-5" weight={unread > 0 ? "fill" : "regular"} />
      {unread > 0 && (
        <span className="bg-meutuals-gradient absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-xs font-bold leading-none text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
