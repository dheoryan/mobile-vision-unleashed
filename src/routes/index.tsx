import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Onboarding, type Profile } from "@/components/mutuals/Onboarding";
import { BottomNav, type TabKey } from "@/components/mutuals/BottomNav";
import { TribeScreen } from "@/components/mutuals/TribeScreen";
import { TimelineScreen } from "@/components/mutuals/TimelineScreen";
import { DiscoverScreen } from "@/components/mutuals/DiscoverScreen";
import { VenturesScreen } from "@/components/mutuals/VenturesScreen";
import { ProfileScreen } from "@/components/mutuals/ProfileScreen";
import { MessagesPanel } from "@/components/mutuals/MessagesPanel";
import type { DMThread, Person } from "@/lib/mutuals-data";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<TabKey>("tribe");
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [extraThreads, setExtraThreads] = useState<DMThread[]>([]);

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

  return (
    <>
      {tab === "tribe"    && <TribeScreen    profile={profile} onOpenMessages={() => setMessagesOpen(true)} unread={unread} />}
      {tab === "timeline" && <TimelineScreen onOpenMessages={() => setMessagesOpen(true)} unread={unread} />}
      {tab === "discover" && <DiscoverScreen onOpenMessages={() => setMessagesOpen(true)} unread={unread} />}
      {tab === "ventures" && (
        <VenturesScreen
          profile={profile}
          onOpenMessages={() => setMessagesOpen(true)}
          onSendHello={handleSendHello}
          onLaunchVenture={handleLaunchVenture}
          unread={unread}
        />
      )}
      {tab === "profile"  && <ProfileScreen profile={profile} onOpenMessages={() => setMessagesOpen(true)} unread={unread} setProfile={setProfile} />}

      <BottomNav active={tab} onChange={setTab} />
      <MessagesPanel open={messagesOpen} onClose={() => setMessagesOpen(false)} extraThreads={extraThreads} />
    </>
  );
}
