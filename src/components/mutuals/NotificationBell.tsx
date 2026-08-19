import { AnimatePresence, motion } from "motion/react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useNotifications } from "@/lib/notifications-store";

export function NotificationBell() {
  const { unread } = useNotifications();
  return (
    <Link
      to="/notifications"
      aria-label="Notifications"
      className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-90 transition-transform"
    >
      <motion.span
        key={unread > 0 ? "ringing" : "idle"}
        initial={unread > 0 ? { rotate: 0 } : false}
        animate={unread > 0 ? { rotate: [0, -14, 12, -8, 4, 0] } : { rotate: 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        className="inline-flex"
      >
        <Bell className="h-5 w-5" />
      </motion.span>
      <AnimatePresence>
        {unread > 0 && (
          <motion.span
            key={unread > 9 ? "9+" : unread}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
          >
            {unread > 9 ? "9+" : unread}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
