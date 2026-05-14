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
import type { Person } from "@/lib/mutuals-data";
import { unreadFromThreads, useThreads } from "@/lib/messages-store";
import { sendMessage as sendMessageFn } from "@/lib/messages.functions";
import { useServerFn } from "@tanstack/react-start";
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
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const intent = useIntent();
  const threadsQuery = useThreads();
  const sendDM = useServerFn(sendMessageFn);

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

  const unread = useMemo(() => unreadFromThreads(threadsQuery.data), [threadsQuery.data]);

  // Locally-applied profile setter that syncs to DB. Passing null = sign out.
  const setProfile = (updater: Profile | null | ((p: Profile | null) => Profile | null)) => {
    const next = typeof updater === "function" ? (updater as (p: Profile | null) => Profile | null)(profile) : updater;
    if (next === null) {
      supabase.auth.signOut();
      return;
    }
    updateProfile.mutate(profileToPatch(next), {
      onError: (err) => toast.error((err as Error).message),
    });
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

  const handleSendHello = async (person: Person, message: string) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(person.id);
    if (!isUuid) {
      toast.error("That person isn't on Mutuals yet.");
      return;
    }
    try {
      await sendDM({ data: { recipient_id: person.id, content: message } });
      toast.success(`Hello sent to ${person.name}`);
      setOpenThreadUser(person.id);
      setMessagesOpen(true);
      threadsQuery.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleLaunchVenture = () => {
    if (!profile) return;
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
        openWithUserId={openThreadUser}
      />
      <CommentsModal open={!!openPostId} onClose={() => setOpenPostId(null)} postId={openPostId} />
    </>
  );
}
