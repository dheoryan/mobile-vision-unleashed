import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/")({
  component: App,
});

const TAB_KEY = "mutuals.tab";
const PROFILE_KEY = "mutuals.profile";

function loadTab(): TabKey {
  if (typeof window === "undefined") return "tribe";
  const v = window.localStorage.getItem(TAB_KEY) as TabKey | null;
  return v && ["tribe", "timeline", "discover", "ventures", "profile"].includes(v) ? v : "tribe";
}

function loadProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Profile & { tribeId?: string };
    // Migrate legacy single-tribe profiles to tribeIds[]
    if (!Array.isArray(parsed.tribeIds)) {
      const legacy = parsed.tribeId as Profile["tribeIds"][number] | undefined;
      parsed.tribeIds = legacy ? [legacy] : ["wolf"];
      delete parsed.tribeId;
    }
    return parsed as Profile;
  } catch { return null; }
}

function App() {
  const [profile, setProfile] = useState<Profile | null>(loadProfile);
  const [tab, setTab] = useState<TabKey>(loadTab);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [openThreadUser, setOpenThreadUser] = useState<string | null>(null);
  const [extraThreads, setExtraThreads] = useState<DMThread[]>([]);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const intent = useIntent();

  // Persist tab + profile across reloads
  useEffect(() => { try { window.localStorage.setItem(TAB_KEY, tab); } catch {} }, [tab]);
  useEffect(() => {
    try {
      if (profile) window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      else window.localStorage.removeItem(PROFILE_KEY);
    } catch {}
  }, [profile]);

  // Consume cross-screen navigation intents (e.g. from notifications)
  useEffect(() => {
    if (!intent || !profile) return;
    const i = intentStore.consume();
    if (!i) return;
    if (i.kind === "openThreadWith") {
      setOpenThreadUser(i.userId);
      setMessagesOpen(true);
    } else if (i.kind === "openPost") {
      setOpenPostId(i.postId);
    } else if (i.kind === "openTab") {
      setTab(i.tab);
    }
  }, [intent, profile]);

  const unread = useMemo(() => 1 + extraThreads.length, [extraThreads]);

  if (!profile) return <Onboarding onDone={(p) => setProfile(p)} />;

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
    setProfile((p) => (p ? { ...p, ventureCount: p.ventureCount + 1 } : p));
  };

  const openMessages = () => { setOpenThreadUser(null); setMessagesOpen(true); };

  // Mount all tabs to preserve state — toggle visibility
  const screens: Record<TabKey, React.ReactNode> = {
    tribe:    <TribeScreen    profile={profile} onOpenMessages={openMessages} unread={unread} />,
    timeline: <TimelineScreen onOpenMessages={openMessages} unread={unread} />,
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
