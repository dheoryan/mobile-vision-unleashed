import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Onboarding, type Profile } from "@/components/mutuals/Onboarding";
import { BottomNav, type TabKey } from "@/components/mutuals/BottomNav";
import { TribeScreen } from "@/components/mutuals/TribeScreen";
import { TimelineScreen } from "@/components/mutuals/TimelineScreen";
import { DiscoverScreen } from "@/components/mutuals/DiscoverScreen";
import { VenturesScreen } from "@/components/mutuals/VenturesScreen";
import { ProfileScreen } from "@/components/mutuals/ProfileScreen";
import { ChatsScreen } from "@/components/mutuals/ChatsScreen";
import { MessagesPanel } from "@/components/mutuals/MessagesPanel";
import { HelloRequestsSheet } from "@/components/mutuals/HelloRequestsSheet";
import type { VentureParty } from "@/lib/ventures-store";
import { CommentsModal } from "@/components/mutuals/CommentsModal";
import { TRIBES, type Person, type TribeId } from "@/lib/mutuals-data";
import { useUnreadCount, useThreads } from "@/lib/messages-store";
import { sendMessage as sendMessageFn } from "@/lib/messages.functions";
import { useServerFn } from "@tanstack/react-start";
import { intentStore, useIntent } from "@/lib/intent-store";
import { rowToProfile, useProfileRow, useUpdateProfile, profileToPatch } from "@/lib/profile-store";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { AgeVerification } from "@/components/mutuals/AgeVerification";
import { useSaveMyLocation } from "@/lib/location-store";
import { AppBootstrapSkeleton } from "@/components/mutuals/Skeleton";
import type { TribeVentureDraft } from "@/lib/tribe-room";
import { useAnnounceTribeVenture } from "@/lib/tribe-room-store";
import {
  currentAppNavigation,
  readAppNavigation,
  writeAppNavigation,
  type AppNavigationSnapshot,
} from "@/lib/app-navigation";
import {
  parseNotificationHomeSearch,
  type NotificationHomeSearch,
} from "@/lib/notification-navigation";
import { saveStoredVentureMode } from "@/lib/ventures-mode";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): NotificationHomeSearch =>
    parseNotificationHomeSearch(search),
  component: App,
});

const TAB_KEY = "mutuals.tab";
const LEGACY_PROFILE_KEY = "mutuals.profile";

const VALID_TABS: TabKey[] = ["feed", "discover", "ventures", "chats", "profile"];
const VALID_TRIBES = new Set<TribeId>(TRIBES.map((tribe) => tribe.id));

/** Existing installs have a tab name in localStorage that no longer exists.
 *  Without this they land on the fallback and silently lose their place.
 *
 *  "timeline" was the feed and keeps being the feed. "tribe" was the Tribe
 *  room, which was almost entirely the group chat — so its readers belong in
 *  Chats, not in Feed. */
const LEGACY_TABS: Record<string, TabKey> = {
  timeline: "feed",
  tribe: "chats",
};

function tabKey(userId: string): string {
  return `${TAB_KEY}:${userId}`;
}

function loadTab(userId: string): TabKey {
  if (typeof window === "undefined") return "feed";
  try {
    const v = window.localStorage.getItem(tabKey(userId));
    if (!v) return "feed";
    if ((VALID_TABS as string[]).includes(v)) return v as TabKey;
    return LEGACY_TABS[v] ?? "feed";
  } catch {
    return "feed";
  }
}

function notificationTab(search: NotificationHomeSearch): TabKey | null {
  switch (search.notification) {
    case "post":
    case "feed-post":
      return "feed";
    case "dm":
    case "venture-chat":
    case "tribe":
      return "chats";
    case "venture":
      return "ventures";
    case "tab":
      return search.tab ?? "feed";
    default:
      return null;
  }
}

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const notificationSearch = Route.useSearch();
  const notificationDestinationTab = notificationTab(notificationSearch);
  const profileQuery = useProfileRow();
  const updateProfile = useUpdateProfile();
  const saveLocation = useSaveMyLocation();

  const profile = rowToProfile(profileQuery.data ?? null);

  const [tab, setTab] = useState<TabKey>("feed");
  const [tabOwnerId, setTabOwnerId] = useState<string | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [helloRequestsOpen, setHelloRequestsOpen] = useState(false);
  const [openThreadUser, setOpenThreadUser] = useState<string | null>(null);
  const [openVentureChat, setOpenVentureChat] = useState<VentureParty | null>(null);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null);
  const [scrollToPostId, setScrollToPostId] = useState<string | null>(null);
  const [initialTribe, setInitialTribe] = useState<TribeId | undefined>(undefined);
  // The Tribe room is no longer a root tab. It is a full-screen view pushed
  // from Chats, which is where its group chat now lives.
  const [tribeChatOpen, setTribeChatOpen] = useState(false);
  const [ventureDraft, setVentureDraft] = useState<TribeVentureDraft | null>(null);
  const [ventureDestination, setVentureDestination] = useState<{
    ventureId: string;
    mode: "host" | "yours";
  } | null>(null);
  const [pendingVentureChatId, setPendingVentureChatId] = useState<string | null>(null);
  const handledNotificationTarget = useRef<string | null>(null);
  const intent = useIntent();
  const threadsQuery = useThreads();
  const sendDM = useServerFn(sendMessageFn);
  const announceTribeVenture = useAnnounceTribeVenture();

  const restoreNavigation = useCallback((snapshot: AppNavigationSnapshot) => {
    setTab(snapshot.tab);
    setTribeChatOpen(snapshot.layer?.kind === "tribe");
    setInitialTribe(snapshot.layer?.kind === "tribe" ? snapshot.layer.tribeId : undefined);
    setMessagesOpen(snapshot.layer?.kind === "messages");
    setHelloRequestsOpen(snapshot.layer?.kind === "helloRequests");
    setOpenThreadUser(snapshot.layer?.kind === "messages" ? (snapshot.layer.userId ?? null) : null);
    setOpenVentureChat(
      snapshot.layer?.kind === "messages" ? (snapshot.layer.venture ?? null) : null,
    );
    setOpenPostId(snapshot.layer?.kind === "post" ? snapshot.layer.postId : null);
    setHighlightCommentId(
      snapshot.layer?.kind === "post" ? (snapshot.layer.commentId ?? null) : null,
    );
  }, []);

  const pushNavigation = useCallback(
    (snapshot: AppNavigationSnapshot) => {
      writeAppNavigation(snapshot);
      restoreNavigation(snapshot);
    },
    [restoreNavigation],
  );

  const closeLayer = useCallback(
    (kind: NonNullable<AppNavigationSnapshot["layer"]>["kind"]) => {
      if (currentAppNavigation()?.layer?.kind === kind) {
        window.history.back();
        return;
      }
      restoreNavigation({ tab });
    },
    [restoreNavigation, tab],
  );

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const snapshot = readAppNavigation(event.state);
      if (snapshot) restoreNavigation(snapshot);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [restoreNavigation]);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  // Restore and persist navigation per account. Installed PWAs retain browser
  // storage across sign-outs, so a device-wide key leaks the previous user's
  // last screen into the next account.
  useEffect(() => {
    if (!userId) {
      setTab("feed");
      setTabOwnerId(null);
      return;
    }
    const restoredTab = notificationDestinationTab ?? loadTab(userId);
    setTab(restoredTab);
    setTabOwnerId(userId);
    setMessagesOpen(false);
    setHelloRequestsOpen(false);
    setOpenThreadUser(null);
    setOpenVentureChat(null);
    setOpenPostId(null);
    setHighlightCommentId(null);
    setScrollToPostId(null);
    setInitialTribe(undefined);
    setTribeChatOpen(false);
    setVentureDraft(null);
    setVentureDestination(null);
    setPendingVentureChatId(null);
    writeAppNavigation({ tab: restoredTab }, true);
  }, [notificationDestinationTab, userId]);

  // Notification destinations are encoded in the URL so taps remain reliable
  // across PWA launches, reloads, and route remounts. Apply the exact screen
  // first, then clean the URL without asking the router to remount the home
  // route and restore the member's previous tab over the destination.
  useEffect(() => {
    const { notification, target, comment, mode, tab: targetTab } = notificationSearch;
    if (!userId || !notification) return;

    const destinationKey = JSON.stringify(notificationSearch);
    if (handledNotificationTarget.current === destinationKey) return;
    handledNotificationTarget.current = destinationKey;

    let snapshot: AppNavigationSnapshot;
    switch (notification) {
      case "post":
        if (!target) return;
        snapshot = {
          tab: "feed",
          layer: { kind: "post", postId: target, commentId: comment ?? null },
        };
        break;
      case "feed-post":
        if (!target) return;
        setScrollToPostId(target);
        snapshot = { tab: "feed" };
        break;
      case "dm":
        if (!target) return;
        snapshot = { tab: "chats", layer: { kind: "messages", userId: target } };
        break;
      case "venture":
        if (!target || !mode) return;
        if (userId) saveStoredVentureMode(userId, mode);
        setVentureDestination({ ventureId: target, mode });
        snapshot = { tab: "ventures" };
        break;
      case "venture-chat":
        if (!target) return;
        setPendingVentureChatId(target);
        snapshot = { tab: "chats" };
        break;
      case "tribe":
        if (!target || !VALID_TRIBES.has(target as TribeId)) {
          snapshot = { tab: "chats" };
          break;
        }
        snapshot = {
          tab: "chats",
          layer: { kind: "tribe", tribeId: target as TribeId },
        };
        break;
      case "tab":
        snapshot = { tab: targetTab ?? "feed" };
        break;
      case "chats-inbox":
        // Not a specific thread - can_direct_message is still false for a
        // Hello nobody's answered yet, so a Thread would just render empty
        // with a composer that fails on send. HelloRequestsSheet is the
        // dedicated home for both incoming and sent Hello activity.
        snapshot = { tab: "chats", layer: { kind: "helloRequests" } };
        break;
    }

    restoreNavigation(snapshot);
    writeAppNavigation(snapshot, true);
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [notificationSearch, restoreNavigation, userId]);

  useEffect(() => {
    if (!userId || tabOwnerId !== userId) return;
    try {
      window.localStorage.setItem(tabKey(userId), tab);
    } catch {
      /* Storage can be unavailable in privacy modes. */
    }
  }, [tab, tabOwnerId, userId]);

  // One-shot migration: push legacy localStorage profile into DB
  useEffect(() => {
    if (!user || profileQuery.isLoading) return;
    if (profile) {
      try {
        window.localStorage.removeItem(LEGACY_PROFILE_KEY);
      } catch {
        /* Storage can be unavailable in privacy modes. */
      }
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
          try {
            window.localStorage.removeItem(LEGACY_PROFILE_KEY);
          } catch {
            /* Storage can be unavailable in privacy modes. */
          }
          toast.success("Welcome back — profile restored");
        },
      });
    } catch {
      /* Ignore malformed legacy state; the database remains authoritative. */
    }
  }, [user, profileQuery.isLoading, profile, updateProfile]);

  // Consume cross-screen navigation intents
  useEffect(() => {
    if (!intent) return;
    const i = intentStore.consume();
    if (!i) return;
    if (i.kind === "openThreadWith") {
      pushNavigation({ tab: "chats", layer: { kind: "messages", userId: i.userId } });
    } else if (i.kind === "openVenture") {
      setVentureDestination({ ventureId: i.ventureId, mode: i.mode });
      pushNavigation({ tab: "ventures" });
    } else if (i.kind === "openVentureChat") {
      setPendingVentureChatId(i.ventureId);
      pushNavigation({ tab: "chats" });
    } else if (i.kind === "openPost") {
      pushNavigation({
        tab: "feed",
        layer: { kind: "post", postId: i.postId, commentId: i.commentId ?? null },
      });
    } else if (i.kind === "scrollToPost") {
      pushNavigation({ tab: "feed" });
      setScrollToPostId(i.postId);
    } else if (i.kind === "openTab") {
      pushNavigation({ tab: i.tab });
    } else if (i.kind === "openTribe") {
      pushNavigation({ tab: "chats", layer: { kind: "tribe", tribeId: i.tribeId } });
    }
    if (notificationSearch.notification) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, [intent, notificationSearch.notification, pushNavigation]);

  const unread = useUnreadCount(threadsQuery.data);

  // Locally-applied profile setter that syncs to DB. Passing null = sign out.
  const setProfile = (updater: Profile | null | ((p: Profile | null) => Profile | null)) => {
    const next =
      typeof updater === "function"
        ? (updater as (p: Profile | null) => Profile | null)(profile)
        : updater;
    if (next === null) {
      void signOut();
      return;
    }
    updateProfile.mutate(profileToPatch(next), {
      onError: (err) => toast.error((err as Error).message),
    });
  };

  if (authLoading || (user && profileQuery.isLoading)) {
    return <AppBootstrapSkeleton />;
  }
  if (!user) return null; // redirecting

  if (profileQuery.data && !profileQuery.data.adult_verified_at) {
    return <AgeVerification locked={!!profileQuery.data.date_of_birth} />;
  }

  if (!profile) {
    return (
      <Onboarding
        saving={updateProfile.isPending || saveLocation.isPending}
        onDone={(p, location) =>
          updateProfile.mutate(profileToPatch(p), {
            onSuccess: () => {
              if (!location) return;
              saveLocation.mutate(location, {
                onError: (error) =>
                  toast.error("Profile saved, but nearby is off", {
                    description: (error as Error).message,
                  }),
              });
            },
            onError: (err) => toast.error((err as Error).message),
          })
        }
      />
    );
  }

  const handleSendHello = async (person: Person, message: string) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      person.id,
    );
    if (!isUuid) {
      toast.error("That person isn't on Meutuals yet.");
      return;
    }
    try {
      await sendDM({ data: { recipient_id: person.id, content: message } });
      toast.success(`Hello sent to ${person.name}`);
      pushNavigation({ tab, layer: { kind: "messages", userId: person.id } });
      threadsQuery.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleLaunchVenture = () => {
    // Called by VenturesScreen after it creates a venture via ventures-store's
    // useCreateHostedVenture (which already persists + invalidates queries server-side).
    // Nothing else to do here.
  };

  const openVentureMessages = (venture: VentureParty) => {
    pushNavigation({ tab, layer: { kind: "messages", venture } });
  };

  const changeTab = (nextTab: TabKey) => {
    if (nextTab === tab && !currentAppNavigation()?.layer) return;
    pushNavigation({ tab: nextTab });
  };

  const screens: Record<TabKey, React.ReactNode> = {
    feed: (
      <TimelineScreen
        profile={profile}
        scrollToPostId={scrollToPostId}
        onScrolledToPost={() => setScrollToPostId(null)}
      />
    ),
    discover: <DiscoverScreen />,
    ventures: (
      <VenturesScreen
        profile={profile}
        setProfile={setProfile}
        onOpenVentureChat={openVentureMessages}
        onSendHello={handleSendHello}
        onLaunchVenture={handleLaunchVenture}
        initialTribeDraft={ventureDraft}
        onTribeDraftFinished={(draft, venture) => {
          setVentureDraft(null);
          announceTribeVenture.mutate(
            {
              tribe_key: draft.tribeId,
              source_message_id: draft.sourceMessageId,
              venture_id: venture.id,
            },
            {
              onSuccess: (result) => {
                if (result.invited_count > 0) {
                  toast.success(
                    `${result.invited_count} interested ${result.invited_count === 1 ? "member was" : "members were"} invited.`,
                  );
                }
              },
              onError: (error) =>
                toast.error("Venture is live, but the Tribe card was not posted", {
                  description: (error as Error).message,
                }),
            },
          );
        }}
        onTribeDraftCancelled={() => setVentureDraft(null)}
        notificationDestination={ventureDestination}
        onNotificationDestinationConsumed={() => setVentureDestination(null)}
      />
    ),
    chats: (
      <ChatsScreen
        profile={profile}
        onOpenTribeChat={() => pushNavigation({ tab: "chats", layer: { kind: "tribe" } })}
        onOpenVentureChat={openVentureMessages}
        onOpenThread={(userId) => {
          pushNavigation({ tab: "chats", layer: { kind: "messages", userId } });
        }}
        onOpenHelloRequests={() =>
          pushNavigation({ tab: "chats", layer: { kind: "helloRequests" } })
        }
        initialVentureId={pendingVentureChatId}
        onInitialVentureConsumed={() => setPendingVentureChatId(null)}
      />
    ),
    profile: <ProfileScreen profile={profile} setProfile={setProfile} />,
  };

  // The Tribe room takes over the whole screen when open, nav included — it is
  // a room you are inside, not a tab you are on.
  if (tribeChatOpen) {
    return (
      <>
        <TribeScreen
          profile={profile}
          setProfile={setProfile}
          initialTribe={initialTribe}
          onBack={() => closeLayer("tribe")}
          onStartVenture={(draft) => {
            setVentureDraft(draft);
            pushNavigation({ tab: "ventures" });
          }}
          onOpenVentures={() => {
            pushNavigation({ tab: "ventures" });
          }}
          onOpenChats={() => {
            pushNavigation({ tab: "chats" });
          }}
          onOpenMemberProfile={(handle) => {
            navigate({ to: "/u/$handle", params: { handle } });
          }}
          onOpenMemberThread={(userId) => {
            pushNavigation({ tab: "chats", layer: { kind: "messages", userId } });
          }}
        />
        <MessagesPanel
          open={messagesOpen}
          onClose={() => closeLayer("messages")}
          openWithUserId={openThreadUser}
          openWithVenture={openVentureChat}
          onOpenProfile={(handle) => navigate({ to: "/u/$handle", params: { handle } })}
        />
        <HelloRequestsSheet open={helloRequestsOpen} onClose={() => closeLayer("helloRequests")} />
      </>
    );
  }

  return (
    <>
      {/* Only the active tab is mounted. Previously all five were rendered with
          `hidden`, which is CSS-only — every screen's hooks ran on every page
          load, producing ~21 requests and ~40 Postgres queries per load, with
          17 separate JWT verifications. Mounting one tab cuts that to what the
          user is actually looking at.

          Trade-off: per-tab component state and scroll position reset on
          switch. If that becomes a problem, keep a Set of visited tabs and
          render those, rather than reverting to rendering all five. */}
      {screens[tab]}

      <BottomNav active={tab} onChange={changeTab} chatsBadge={unread} />
      <MessagesPanel
        open={messagesOpen}
        onClose={() => closeLayer("messages")}
        openWithUserId={openThreadUser}
        openWithVenture={openVentureChat}
        onOpenProfile={(handle) => navigate({ to: "/u/$handle", params: { handle } })}
      />
      <HelloRequestsSheet open={helloRequestsOpen} onClose={() => closeLayer("helloRequests")} />
      <CommentsModal
        open={!!openPostId}
        onClose={() => closeLayer("post")}
        postId={openPostId}
        highlightCommentId={highlightCommentId}
      />
    </>
  );
}
