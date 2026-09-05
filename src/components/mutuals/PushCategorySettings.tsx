import { CalendarIcon } from "@phosphor-icons/react/dist/csr/Calendar";
import { HeartIcon } from "@phosphor-icons/react/dist/csr/Heart";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import type { Icon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_PUSH_PREFERENCES, type PushPreferenceKey } from "@/lib/push-preferences";
import { usePushPreferences, useUpdatePushPreference } from "@/lib/push-preferences-store";
import { Skeleton } from "./Skeleton";

interface CategoryDefinition {
  key: PushPreferenceKey;
  label: string;
  detail: string;
  icon: Icon;
}

const CATEGORIES: CategoryDefinition[] = [
  {
    key: "messages_mentions",
    label: "Messages & mentions",
    detail: "DMs, Hellos, and when someone calls you into a conversation.",
    icon: ChatCircleIcon,
  },
  {
    key: "venture_activity",
    label: "Venture activity",
    detail: "Join requests, invitations, acceptances, and party chat.",
    icon: CalendarIcon,
  },
  {
    key: "social_activity",
    label: "Comments & reactions",
    detail: "Likes, replies, comments, and new followers.",
    icon: HeartIcon,
  },
  {
    key: "tribe_activity",
    label: "Tribe activity",
    detail: "Important changes inside your Tribe.",
    icon: UsersIcon,
  },
  {
    key: "new_posts",
    label: "New Tribe posts",
    detail: "A push whenever someone shares a new Tribe signal.",
    icon: SparkleIcon,
  },
];

export function PushCategorySettings() {
  const preferencesQuery = usePushPreferences();
  const updatePreference = useUpdatePushPreference();
  const preferences = preferencesQuery.data ?? DEFAULT_PUSH_PREFERENCES;

  if (preferencesQuery.isLoading) {
    return (
      <div className="mt-6" aria-label="Loading notification categories">
        <Skeleton className="mb-3 h-4 w-32" />
        <Skeleton className="h-[380px] rounded-2xl" />
      </div>
    );
  }

  if (preferencesQuery.isError) {
    return (
      <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/[0.04] p-4">
        <p className="text-sm font-semibold">Categories aren’t available yet</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Your main notification setting still works. Try loading these controls again.
        </p>
        <button
          type="button"
          onClick={() => preferencesQuery.refetch()}
          className="mt-3 min-h-11 rounded-xl border border-primary/40 px-4 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <section className="mt-6" aria-labelledby="push-category-heading">
      <div className="mb-3 px-1">
        <h3 id="push-category-heading" className="text-sm font-semibold">
          What reaches you
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          These choices apply whenever push notifications are on.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        {CATEGORIES.map(({ key, label, detail, icon: Icon }, index) => {
          const checked = preferences[key];
          return (
            <div
              key={key}
              className={`flex min-h-[76px] items-center gap-3 px-4 py-3 ${
                index === 0 ? "" : "border-t border-border"
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
              </div>
              <div className="flex h-11 w-12 shrink-0 items-center justify-center">
                <Switch
                  checked={checked}
                  disabled={updatePreference.isPending}
                  aria-label={`${checked ? "Turn off" : "Turn on"} ${label}`}
                  onCheckedChange={(enabled) =>
                    updatePreference.mutate(
                      { key, enabled },
                      {
                        onError: () =>
                          toast.error("Could not update notification category", {
                            description: "Your previous choice has been restored.",
                          }),
                      },
                    )
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
