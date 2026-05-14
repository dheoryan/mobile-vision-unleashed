import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Onboarding, type Profile } from "@/components/mutuals/Onboarding";
import { BottomNav, type TabKey } from "@/components/mutuals/BottomNav";
import { TribeScreen } from "@/components/mutuals/TribeScreen";
import { TimelineScreen } from "@/components/mutuals/TimelineScreen";
import { DiscoverScreen } from "@/components/mutuals/DiscoverScreen";
import { VenturesScreen } from "@/components/mutuals/VenturesScreen";
import { ProfileScreen } from "@/components/mutuals/ProfileScreen";
import { MessagesPanel } from "@/components/mutuals/MessagesPanel";
import { CommentsModal } from "@/components/mutuals/CommentsModal";
import type { DMThread, Person } from "@/lib/mutuals-data";
import { intentStore, useIntent } from "@/lib/intent-store";
import {
  rowToProfile,
  useProfileRow,
  useUpdateProfile,
  profileToPatch,
} from "@/lib/profile-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: App,
});

const TAB_KEY = "mutuals.tab";
const LEGACY_PROFILE_KEY = "mutuals.profile";

function loadTab(): TabKey {
  if (typeof window === "undefined") return "tribe";
  const v = window.localStorage.getItem(TAB_KEY) as TabKey | null;
  return v && ["tribe", "timeline", "discover", "ventures", "profile"].includes(v) ? v : "tribe";
}

function App() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const profileQuery = useProfileRow();
  const updateProfile = useUpdateProfile();

  const profile = rowToProfile(profileQuery.data ?? null);

  const [tab, setTab] = useState<TabKey>(loadTab);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [openThreadUser, setOpenThreadUser] = useState<string | null>(null);
  const [extraThreads, setExtraThreads] = useState<DMThread[]>([]);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const intent = useIntent();

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  // Persist tab
  useEffect(() => { try { window.localStorage.setItem(TAB_KEY, tab); } catch {} }, [tab]);

  // One-shot migration: push legacy localStorage profile into DB
  useEffect(() => {
    if (!user || profileQuery.isLoading) return;
    if (profile) {
      try { window.localStorage.removeItem(LEGACY_PROFILE_KEY); } catch {}
      return;
    }
    try {
      const raw = window.localStorage.getItem(LEGACY_PROFILE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Profile & { tribeId?: string };
      if (!Array.isArray(parsed.tribeIds)) {
        parsed.tribeIds = parsed.tribeId ? [parsed.tribeId as Profile["tribeIds"][number]] : [];
      }
      if (!parsed.tribeIds.length || !parsed.name) return;
      updateProfile.mutate(profileToPatch(parsed), {
        onSuccess: () => {
          try { window.localStorage.removeItem(LEGACY_PROFILE_KEY); } catch {}
          toast.success("Welcome back — profile restored");
        },
      });
    } catch {}
  }, [user, profileQuery.isLoading, profile, updateProfile]);

  // Consume cross-screen navigation intents
  useEffect(() => {
    if (!intent || !profile) return;
    const i = intentStore.consume();
    if (!i) return;
    if (i.kind === "openThreadWith") { setOpenThreadUser(i.userId); setMessagesOpen(true); }
    else if (i.kind === "openPost") { setOpenPostId(i.postId); }
    else if (i.kind === "openTab") { setTab(i.tab); }
  }, [intent, profile]);

  const unread = useMemo(() => 1 + extraThreads.length, [extraThreads]);

  // Locally-applied profile setter that syncs to DB
  const setProfile = (updater: Profile | ((p: Profile | null) => Profile | null)) => {
    const next = typeof updater === "function" ? (updater as (p: Profile | null) => Profile | null)(profile) : updater;
    if (!next) return;
    updateProfile.mutate(profileToPatch(next));
  };

  if (authLoading || (user && profileQuery.isLoading)) {
    return <div className="bg-habitat flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!user) return null; // redirecting

  if (!profile) {
    return (
      <Onboarding
        onDone={(p) =>
          updateProfile.mutate(profileToPatch(p), {
            onError: (err) => toast.error((err as Error).message),
          })
        }
      />
    );
  }

  const handleSendHello = (person: Person, message: string) => {
    setExtraThreads((prev) => {
      if (prev.some((t) => t.withUserId === person.id)) return prev;
      return [
        {
          id: `new-${person.id}`,
          withUserId: person.id,
          preview: message,
          time: "now",
          unread: true,
          messages: [{ id: `m-${Date.now()}`, from: "me", text: message, time: "now" }],
        },
        ...prev,
      ];
    });
  };

  const handleLaunchVenture = () => {
    if (!profile) return;
    updateProfile.mutate({ /* venture_count handled below */ } as never);
    // Increment via patch
    updateProfile.mutate(profileToPatch({ ...profile, ventureCount: profile.ventureCount + 1 }));
  };

  const openMessages = () => { setOpenThreadUser(null); setMessagesOpen(true); };

  const screens: Record<TabKey, React.ReactNode> = {
    tribe:    <TribeScreen    profile={profile} setProfile={setProfile} onOpenMessages={openMessages} unread={unread} />,
    timeline: <TimelineScreen profile={profile} onOpenMessages={openMessages} unread={unread} />,
    discover: <DiscoverScreen onOpenMessages={openMessages} unread={unread} />,
    ventures: (
      <VenturesScreen
        profile={profile}
        setProfile={setProfile}
        onOpenMessages={openMessages}
        onSendHello={handleSendHello}
        onLaunchVenture={handleLaunchVenture}
        unread={unread}
      />
    ),
    profile:  <ProfileScreen profile={profile} onOpenMessages={openMessages} unread={unread} setProfile={setProfile} />,
  };

  return (
    <>
      {(Object.keys(screens) as TabKey[]).map((k) => (
        <div key={k} hidden={tab !== k} aria-hidden={tab !== k}>
          {screens[k]}
        </div>
      ))}

      <BottomNav active={tab} onChange={setTab} />
      <MessagesPanel
        open={messagesOpen}
        onClose={() => { setMessagesOpen(false); setOpenThreadUser(null); }}
        extraThreads={extraThreads}
        openWithUserId={openThreadUser}
      />
      <CommentsModal open={!!openPostId} onClose={() => setOpenPostId(null)} postId={openPostId} />
    </>
  );
}
