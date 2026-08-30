import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SettingsScreen, type SettingsView } from "@/components/mutuals/SettingsScreen";

const SETTINGS_VIEWS = new Set<SettingsView>([
  "main",
  "account",
  "notifications",
  "nearby",
  "installation",
  "safety",
  "blocked",
  "savedPosts",
]);

export const Route = createFileRoute("/settings")({
  validateSearch: (search: Record<string, unknown>): { view?: SettingsView } => ({
    view:
      typeof search.view === "string" && SETTINGS_VIEWS.has(search.view as SettingsView)
        ? (search.view as SettingsView)
        : undefined,
  }),
  head: () => ({ meta: [{ title: "Settings — MEUTUALS — Your tribe is waiting" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { view = "main" } = Route.useSearch();
  return (
    <SettingsScreen
      view={view}
      onViewChange={(nextView) =>
        void navigate({ to: "/settings", search: nextView === "main" ? {} : { view: nextView } })
      }
    />
  );
}
