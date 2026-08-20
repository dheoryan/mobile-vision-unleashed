import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useNotifications } from "@/lib/notifications-store";

export function NotificationBell() {
  const { unread } = useNotifications();
  return (
    <Link
      to="/notifications"
      aria-label="Notifications"
      className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
