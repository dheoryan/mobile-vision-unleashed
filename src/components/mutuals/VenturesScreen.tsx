import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  Clock,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  UserPlus,
  Zap,
  Users,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { INTENTS, TRIBES, type Person, type TribeId } from "@/lib/mutuals-data";
import { AppHeader, SectionTitle, TribeBadge } from "./Shared";
import { PlusBadge } from "./PlusBadge";
import { SafetyMenu } from "./SafetyMenu";
import { UpsellModal } from "./UpsellModal";
import { FeatureIllustration } from "./FeatureIllustration";
import venturesArt from "@/assets/app-illustrations/ventures.webp";
import { VentureSwipeDeck } from "./VentureSwipeDeck";
import { Layers, List } from "lucide-react";
import { useBlocked } from "@/lib/blocked-store";
import { requestPushPrompt } from "@/lib/push-prompt-events";
import {
  useApplyToVenture,
  useCloseHostedVenture,
  useCreateHostedVenture,
  useDecideVentureApplication,
  useMyHostedVentures,
  useMyJoinedVentures,
  useOpenVentures,
  type VentureApplication,
  type VentureParty,
  type VentureProfileLite,
  type VentureScope,
} from "@/lib/ventures-store";
import type { Profile } from "./Onboarding";
import { cn } from "@/lib/utils";
import { MONETIZATION_ENABLED, showPlusBadge } from "@/lib/feature-flags";
import {
  inviteUserToVenture,
  listVentureInviteCandidates,
  respondToVentureInvite,
  type VentureInviteCandidate,
} from "@/lib/ventures.functions";

type Mode = "look" | "host";
type VentureStage = "intro" | "role" | "feature";

const TIME_WINDOWS = ["Tonight", "This week evenings", "This weekend", "Next week"];
const VENTURES_INTRO_KEY = "mutuals:ventures:intro-seen";
const VENTURES_MODE_KEY = "mutuals:ventures:last-mode";

function safeLocalStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function hasSeenVentureIntro() {
  return safeLocalStorage()?.getItem(VENTURES_INTRO_KEY) === "1";
}

function markVentureIntroSeen() {
  safeLocalStorage()?.setItem(VENTURES_INTRO_KEY, "1");
}

function readStoredMode(): Mode {
  const value = safeLocalStorage()?.getItem(VENTURES_MODE_KEY);
  return value === "host" ? "host" : "look";
}

function saveStoredMode(mode: Mode) {
  safeLocalStorage()?.setItem(VENTURES_MODE_KEY, mode);
}

export function VenturesScreen({
  profile,
  setProfile,
  onOpenMessages,
  onOpenVentureChat,
  onSendHello: _onSendHello,
  onLaunchVenture,
  unread,
}: {
  profile: Profile;
  setProfile?: (updater: (p: Profile | null) => Profile | null) => void;
  onOpenMessages: () => void;
  onOpenVentureChat: (venture: VentureParty) => void;
  onSendHello?: (person: Person, message: string) => void;
  onLaunchVenture?: () => void;
  unread?: number;
}) {
  const [stage, setStage] = useState<VentureStage>("intro");
  const [mode, setModeState] = useState<Mode>("look");
  const [scope, setScope] = useState<VentureScope>("all");
  const [hostFormOpen, setHostFormOpen] = useState(false);
  const [paywall, setPaywall] = useState(false);

  const blocked = useBlocked();
  const openQuery = useOpenVentures(scope);
  const hostedQuery = useMyHostedVentures();
  const joinedQuery = useMyJoinedVentures();

  useEffect(() => {
    persistMode(readStoredMode());
    if (hasSeenVentureIntro()) {
      setStage("feature");
    }
  }, []);

  const openVentures = useMemo(
    () => (openQuery.data ?? []).filter((v) => !blocked.has(v.host_id)),
    [openQuery.data, blocked],
  );
  const hostedVentures = useMemo(() => hostedQuery.data ?? [], [hostedQuery.data]);
  const joinedVentures = useMemo(() => joinedQuery.data ?? [], [joinedQuery.data]);
  const hasVentureActivity = hostedVentures.length > 0 || joinedVentures.length > 0;

  useEffect(() => {
    if (stage === "intro" && hasVentureActivity && !hasSeenVentureIntro()) {
      markVentureIntroSeen();
      setStage("feature");
    }
  }, [hasVentureActivity, stage]);

  const persistMode = (nextMode: Mode) => {
    setModeState(nextMode);
    saveStoredMode(nextMode);
  };

  const switchMode = (nextMode: Mode) => {
    if (
      nextMode === "host" &&
      MONETIZATION_ENABLED &&
      profile.plan === "free" &&
      profile.ventureCount >= 3
    ) {
      setPaywall(true);
      return;
    }
    markVentureIntroSeen();
    persistMode(nextMode);
    setHostFormOpen(false);
    setStage("feature");
  };

  const enterFeature = (nextMode: Mode, options?: { openHostForm?: boolean }) => {
    if (
      nextMode === "host" &&
      MONETIZATION_ENABLED &&
      profile.plan === "free" &&
      profile.ventureCount >= 3
    ) {
      setPaywall(true);
      return;
    }
    markVentureIntroSeen();
    persistMode(nextMode);
    setHostFormOpen(Boolean(options?.openHostForm));
    setStage("feature");
  };

  const startHosting = () => {
    if (MONETIZATION_ENABLED && profile.plan === "free" && profile.ventureCount >= 3) {
      setPaywall(true);
      return;
    }
    markVentureIntroSeen();
    persistMode("host");
    setStage("feature");
    setHostFormOpen(true);
  };

  const handleCreated = (venture: VentureParty) => {
    onLaunchVenture?.();
    setHostFormOpen(false);
    onOpenVentureChat(venture);
  };

  return (
    <div className="bg-habitat min-h-screen pb-28">
      <AppHeader
        title="Ventures"
        subtitle={
          stage === "intro" ? "Optional" : stage === "role" ? "Choose mode" : "Open party board"
        }
        accent="var(--color-primary)"
        onOpenMessages={onOpenMessages}
        unread={unread}
      />

      <main className="mx-auto max-w-md px-5">
        {stage === "intro" ? (
          <VenturesIntro onContinue={() => setStage("role")} />
        ) : stage === "role" ? (
          <VentureRoleChooser
            onBack={() => setStage("intro")}
            onChoose={(nextMode) => enterFeature(nextMode, { openHostForm: nextMode === "host" })}
          />
        ) : (
          <>
            <FeatureHero mode={mode} onModeChange={switchMode} />

            {mode === "look" ? (
              <LookView
                profile={profile}
                scope={scope}
                setScope={setScope}
                openVentures={openVentures}
                joinedVentures={joinedVentures}
                isLoading={openQuery.isLoading}
                isError={openQuery.isError}
                onRetry={() => openQuery.refetch()}
                onOpenChat={onOpenVentureChat}
                onStartHosting={startHosting}
                onChanged={() => {
                  openQuery.refetch();
                  joinedQuery.refetch();
                }}
              />
            ) : (
              <HostView
                profile={profile}
                formOpen={hostFormOpen}
                setFormOpen={setHostFormOpen}
                hostedVentures={hostedVentures}
                isLoading={hostedQuery.isLoading}
                onCreated={handleCreated}
                onOpenChat={onOpenVentureChat}
                onChanged={() => hostedQuery.refetch()}
              />
            )}
          </>
        )}
      </main>

      <UpsellModal
        open={paywall}
        onClose={() => setPaywall(false)}
        used={profile.ventureCount}
      />
    </div>
  );
}

function RoleButton({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function VenturesIntro({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="pt-5 animate-rise">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <FeatureIllustration src={venturesArt} size="lg" className="mb-5" />
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Zap className="h-5 w-5" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold leading-tight">
          Ventures are optional.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Join small open plans, or host one when you are ready. No swiping. No pressure. Just open
          groups, requests, and party chat.
        </p>
      </section>

      <section className="mt-6">
        <h3 className="font-display text-lg font-bold">How it works</h3>
        <div className="mt-3 space-y-2.5">
          <IntroStep
            number="1"
            title="Choose your role"
            body="Look for an open crew, or host one yourself."
          />
          <IntroStep
            number="2"
            title="Request, review, accept"
            body="Join requests stay lightweight, and hosts decide who gets in."
          />
          <IntroStep
            number="3"
            title="Plan in party chat"
            body="Accepted members get a shared chat while the Venture is active."
          />
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
        <div className="flex items-center gap-2 text-emerald-300">
          <ShieldCheck className="h-4 w-4" />
          <h3 className="text-sm font-semibold">Meet safely</h3>
        </div>
        <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
          <li>Meet in a public place and arrange your own transport.</li>
          <li>Keep exact locations and personal contact details in accepted-member chat.</li>
          <li>Tell someone you trust where you are going. Leave and report anything that feels wrong.</li>
        </ul>
      </section>

      <button
        type="button"
        onClick={onContinue}
        className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
      >
        Choose Looking or Hosting
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function IntroStep({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        {number}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function VentureRoleChooser({
  onBack,
  onChoose,
}: {
  onBack: () => void;
  onChoose: (mode: Mode) => void;
}) {
  return (
    <div className="pt-5 animate-rise">
      <section className="rounded-3xl border border-border bg-card p-5">
        <p className="label-mono text-muted-foreground">Choose mode</p>
        <h2 className="mt-2 font-display text-2xl font-bold leading-tight">
          What are you here for?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Pick one path first. You can switch between Looking and Hosting later.
        </p>

        <div className="mt-5 grid gap-3">
          <RoleChoiceCard
            icon={<Search className="h-5 w-5" />}
            title="Looking"
            body="Browse open Ventures, request to join, then chat after you are accepted."
            onClick={() => onChoose("look")}
          />
          <RoleChoiceCard
            icon={<Plus className="h-5 w-5" />}
            title="Hosting"
            body="Create an open party, review requests, and keep the crew organized."
            onClick={() => onChoose("host")}
          />
        </div>
      </section>

      <button
        type="button"
        onClick={onBack}
        className="mt-4 w-full rounded-2xl border border-border bg-card py-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        Back to how it works
      </button>
    </div>
  );
}

function RoleChoiceCard({
  icon,
  title,
  body,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/60"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{body}</span>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary">
          {title === "Looking" ? "Browse Ventures" : "Create Venture"}
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </span>
    </button>
  );
}

function FeatureHero({ mode, onModeChange }: { mode: Mode; onModeChange: (mode: Mode) => void }) {
  return (
    <section className="mt-5 rounded-2xl border border-border bg-card p-4 animate-rise">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-mono text-muted-foreground">Ventures</p>
          <h2 className="mt-1 font-display text-2xl font-bold leading-tight">
            Find a crew, or host one.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open groups with a host, join requests, slots, and party chat.
          </p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Users className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-secondary/70 p-1">
        <RoleButton
          active={mode === "look"}
          icon={<Search className="h-4 w-4" />}
          onClick={() => onModeChange("look")}
        >
          Looking
        </RoleButton>
        <RoleButton
          active={mode === "host"}
          icon={<Plus className="h-4 w-4" />}
          onClick={() => onModeChange("host")}
        >
          Hosting
        </RoleButton>
      </div>
    </section>
  );
}

function LookView({
  profile,
  scope,
  setScope,
  openVentures,
  joinedVentures,
  isLoading,
  isError,
  onRetry,
  onOpenChat,
  onStartHosting,
  onChanged,
}: {
  profile: Profile;
  scope: VentureScope;
  setScope: (scope: VentureScope) => void;
  openVentures: VentureParty[];
  joinedVentures: VentureParty[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenChat: (venture: VentureParty) => void;
  onStartHosting: () => void;
  onChanged: () => void;
}) {
  const apply = useApplyToVenture();
  const respondInviteFn = useServerFn(respondToVentureInvite);
  const respondInvite = useMutation({
    mutationFn: ({
      applicationId,
      status,
    }: {
      applicationId: string;
      status: "accepted" | "declined";
    }) => respondInviteFn({ data: { application_id: applicationId, status } }),
    onSuccess: (application) => {
      toast.success(
        application.status === "accepted"
          ? "Invite accepted. Welcome to the party."
          : "Invite passed.",
      );
      onChanged();
      requestPushPrompt("venture");
    },
    onError: (err) => toast.error((err as Error).message),
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Deck by default — the board is a stream of plans, not a directory.
  const [boardView, setBoardView] = useState<"deck" | "list">("deck");
  const mineLabel = profile.tribeIds.length > 1 ? "My Tribes" : "My Tribe";

  const activeParties = useMemo(
    () =>
      joinedVentures.filter((venture) => (venture.my_application?.status as string) === "accepted"),
    [joinedVentures],
  );

  const invitedRequests = useMemo(
    () =>
      joinedVentures.filter((venture) => (venture.my_application?.status as string) === "invited"),
    [joinedVentures],
  );

  const pendingRequests = useMemo(
    () =>
      joinedVentures.filter((venture) => (venture.my_application?.status as string) === "pending"),
    [joinedVentures],
  );

  const requestedVentureIds = useMemo(
    () => new Set(joinedVentures.map((venture) => venture.id)),
    [joinedVentures],
  );

  const joinableVentures = useMemo(
    () =>
      openVentures.filter(
        (venture) => !venture.my_application && !requestedVentureIds.has(venture.id),
      ),
    [openVentures, requestedVentureIds],
  );

  const submitApply = (venture: VentureParty) => {
    apply.mutate(
      {
        venture_id: venture.id,
        message: notes[venture.id]?.trim() || "",
      },
      {
        onSuccess: () => {
          toast.success("Request sent to the host.");
          requestPushPrompt("venture");
          setNotes((cur) => ({ ...cur, [venture.id]: "" }));
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  };

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-1">
        <RoleButton
          active={scope === "all"}
          icon={<SlidersHorizontal className="h-4 w-4" />}
          onClick={() => setScope("all")}
        >
          All Tribes
        </RoleButton>
        <RoleButton
          active={scope === "mine"}
          icon={<Users className="h-4 w-4" />}
          onClick={() => setScope("mine")}
        >
          {mineLabel}
        </RoleButton>
      </div>

      {invitedRequests.length > 0 && (
        <>
          <SectionTitle title="Invites" hint={`${invitedRequests.length} waiting`} />
          <div className="space-y-2">
            {invitedRequests.map((venture) => (
              <JoinedVentureCard
                key={venture.id}
                venture={venture}
                onOpenChat={() => onOpenChat(venture)}
                busy={
                  respondInvite.isPending &&
                  respondInvite.variables?.applicationId === venture.my_application?.id
                }
                onAcceptInvite={() =>
                  venture.my_application?.id &&
                  respondInvite.mutate({
                    applicationId: venture.my_application.id,
                    status: "accepted",
                  })
                }
                onDeclineInvite={() =>
                  venture.my_application?.id &&
                  respondInvite.mutate({
                    applicationId: venture.my_application.id,
                    status: "declined",
                  })
                }
              />
            ))}
          </div>
        </>
      )}

      {activeParties.length > 0 && (
        <>
          <SectionTitle title="Your Active Ventures" hint={`${activeParties.length} active`} />
          <div className="space-y-2">
            {activeParties.map((venture) => (
              <JoinedVentureCard
                key={venture.id}
                venture={venture}
                onOpenChat={() => onOpenChat(venture)}
              />
            ))}
          </div>
        </>
      )}

      {pendingRequests.length > 0 && (
        <>
          <SectionTitle title="Pending Requests" hint={`${pendingRequests.length} waiting`} />
          <div className="space-y-2">
            {pendingRequests.map((venture) => (
              <JoinedVentureCard
                key={venture.id}
                venture={venture}
                onOpenChat={() => onOpenChat(venture)}
              />
            ))}
          </div>
        </>
      )}

      <SectionTitle
        title="Open Ventures"
        hint={isLoading ? "Loading parties" : `${joinableVentures.length} joinable`}
        action={
          <div className="flex items-center gap-1 rounded-full bg-card p-1 text-muted-foreground">
            <button
              onClick={() => setBoardView("deck")}
              aria-label="One at a time"
              aria-pressed={boardView === "deck"}
              className={cn("rounded-full p-1.5", boardView === "deck" && "bg-primary text-primary-foreground")}
            >
              <Layers className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setBoardView("list")}
              aria-label="List"
              aria-pressed={boardView === "list"}
              className={cn("rounded-full p-1.5", boardView === "list" && "bg-primary text-primary-foreground")}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      />

      {isLoading ? (
        <LoadingBlock label="Finding open Ventures" />
      ) : isError ? (
        <RetryBlock label="Could not load open Ventures." onRetry={onRetry} />
      ) : joinableVentures.length ? (
        boardView === "deck" ? (
          /* One plan at a time. Judging an activity rather than a person is
             what makes a swipe deck appropriate here at all. */
          <VentureSwipeDeck
            ventures={joinableVentures}
            onOpenChat={onOpenChat}
            onChanged={onChanged}
          />
        ) : (
          <div className="space-y-3">
            {joinableVentures.map((venture) => (
              <OpenVentureCard
                key={venture.id}
                venture={venture}
                note={notes[venture.id] ?? ""}
                onNoteChange={(value) => setNotes((cur) => ({ ...cur, [venture.id]: value }))}
                onApply={() => submitApply(venture)}
                onOpenChat={() => onOpenChat(venture)}
                applying={apply.isPending && apply.variables?.venture_id === venture.id}
              />
            ))}
          </div>
        )
      ) : (
        <EmptyPanel
          icon={<Search className="h-6 w-6" />}
          title={
            activeParties.length || pendingRequests.length || invitedRequests.length
              ? "No more open Ventures here."
              : "No open Ventures here yet."
          }
          body={
            activeParties.length || pendingRequests.length || invitedRequests.length
              ? "You already joined, requested, or were invited to the available Ventures. Switch filters or host a new one."
              : "Host one now or switch the tribe filter."
          }
          actionLabel="Host a Venture"
          onAction={onStartHosting}
        />
      )}
    </>
  );
}

function HostView({
  profile,
  formOpen,
  setFormOpen,
  hostedVentures,
  isLoading,
  onCreated,
  onOpenChat,
  onChanged,
}: {
  profile: Profile;
  formOpen: boolean;
  setFormOpen: (open: boolean) => void;
  hostedVentures: VentureParty[];
  isLoading: boolean;
  onCreated: (venture: VentureParty) => void;
  onOpenChat: (venture: VentureParty) => void;
  onChanged: () => void;
}) {
  return (
    <>
      <SectionTitle
        title="Hosted Ventures"
        hint={isLoading ? "Loading" : `${hostedVentures.length} total`}
        action={
          <button
            type="button"
            onClick={() => setFormOpen(!formOpen)}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"
          >
            {formOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {formOpen ? "Close" : "New"}
          </button>
        }
      />

      {formOpen && (
        <HostForm profile={profile} onCancel={() => setFormOpen(false)} onCreated={onCreated} />
      )}

      {isLoading ? (
        <LoadingBlock label="Loading hosted Ventures" />
      ) : hostedVentures.length ? (
        <div className="space-y-3">
          {hostedVentures.map((venture) => (
            <HostedVentureCard
              key={venture.id}
              venture={venture}
              onOpenChat={() => onOpenChat(venture)}
              onInvited={onChanged}
            />
          ))}
        </div>
      ) : (
        <EmptyPanel
          icon={<Users className="h-6 w-6" />}
          title="You are not hosting yet."
          body="Create the first open party and review requests as they come in."
          actionLabel="Create Venture"
          onAction={() => setFormOpen(true)}
        />
      )}
    </>
  );
}

function HostForm({
  profile,
  onCancel,
  onCreated,
}: {
  profile: Profile;
  onCancel: () => void;
  onCreated: (venture: VentureParty) => void;
}) {
  const create = useCreateHostedVenture();
  const [title, setTitle] = useState("");
  const [intents, setIntents] = useState<string[]>([]);
  const [scope, setScope] = useState<VentureScope>("all");
  const [timeWindow, setTimeWindow] = useState(TIME_WINDOWS[1]);
  const [maxSlots, setMaxSlots] = useState(4);
  const [note, setNote] = useState("");

  const myTribes = TRIBES.filter((tribe) => profile.tribeIds.includes(tribe.id));
  const canSubmit =
    title.trim().length >= 3 && intents.length > 0 && maxSlots >= 2 && maxSlots <= 20;

  const toggleIntent = (intent: string) => {
    setIntents((cur) => {
      if (cur.includes(intent)) return cur.filter((item) => item !== intent);
      return cur.length >= 5 ? cur : [...cur, intent];
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    create.mutate(
      {
        title: title.trim(),
        intents,
        scope,
        time_window: timeWindow,
        max_slots: maxSlots,
        note: note.trim(),
      },
      {
        onSuccess: (venture) => {
          toast.success("Venture is live.");
          requestPushPrompt("venture");
          onCreated(venture);
          setTitle("");
          setIntents([]);
          setScope("all");
          setTimeWindow(TIME_WINDOWS[1]);
          setMaxSlots(4);
          setNote("");
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="mb-4 rounded-2xl border border-border bg-card p-4 animate-rise"
    >
      <div className="grid gap-3">
        <FieldLabel label="Venture title">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value.slice(0, 80))}
            placeholder="Late coffee in Senopati"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </FieldLabel>

        <FieldLabel label="Intents">
          <div className="flex flex-wrap gap-2">
            {INTENTS.map((intent) => {
              const active = intents.includes(intent);
              return (
                <button
                  key={intent}
                  type="button"
                  onClick={() => toggleIntent(intent)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground",
                  )}
                >
                  {intent}
                </button>
              );
            })}
          </div>
        </FieldLabel>

        <FieldLabel label="Audience">
          <div className="grid grid-cols-2 gap-2">
            <ChoiceButton
              active={scope === "all"}
              onClick={() => setScope("all")}
              title="All Tribes"
              body="Anyone nearby can apply."
            />
            <ChoiceButton
              active={scope === "mine"}
              onClick={() => setScope("mine")}
              title={myTribes.length > 1 ? "My Tribes" : "My Tribe"}
              body={myTribes.map((tribe) => tribe.name).join(", ") || "Your home base."}
            />
          </div>
        </FieldLabel>

        <FieldLabel label="Time window">
          <div className="grid grid-cols-2 gap-2">
            {TIME_WINDOWS.map((option) => (
              <ChoiceButton
                key={option}
                active={timeWindow === option}
                onClick={() => setTimeWindow(option)}
                title={option}
                compact
              />
            ))}
          </div>
        </FieldLabel>

        <FieldLabel label="Slots">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <input
              type="number"
              min={2}
              max={20}
              value={maxSlots}
              onChange={(event) => setMaxSlots(Number(event.target.value))}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <span className="text-xs text-muted-foreground">including host</span>
          </div>
        </FieldLabel>

        <FieldLabel label="Host note">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, 280))}
            placeholder="Share the vibe and a public area — save exact details for accepted-member chat."
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <div className="mt-1 flex items-start justify-between gap-3 text-[10px] text-muted-foreground">
            <span>Don't post a home address, phone number, or exact private location.</span>
            <span className="shrink-0">{note.length}/280</span>
          </div>
        </FieldLabel>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl border border-border bg-background py-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit || create.isPending}
          className="inline-flex flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {create.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          Go live
        </button>
      </div>
    </form>
  );
}

function OpenVentureCard({
  venture,
  note,
  onNoteChange,
  onApply,
  onOpenChat,
  applying,
}: {
  venture: VentureParty;
  note: string;
  onNoteChange: (value: string) => void;
  onApply: () => void;
  onOpenChat: () => void;
  applying: boolean;
}) {
  const application = venture.my_application;
  const accepted = application?.status === "accepted";
  const pending = application?.status === "pending";
  const declined = application?.status === "declined";

  return (
    <article className="rounded-2xl border border-border bg-card p-4 animate-rise">
      <VentureCardHeader venture={venture} />
      <VentureMeta venture={venture} />

      {venture.note && (
        <p className="mt-3 rounded-xl bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {venture.note}
        </p>
      )}

      {accepted ? (
        <button
          type="button"
          onClick={onOpenChat}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-semibold text-primary-foreground"
        >
          <MessageCircle className="h-4 w-4" /> Open party chat
        </button>
      ) : pending || declined ? (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-xs font-semibold text-muted-foreground">
          {pending ? <Clock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          {pending ? "Request pending" : "Request declined"}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <input
            value={note}
            onChange={(event) => onNoteChange(event.target.value.slice(0, 180))}
            placeholder="Optional note to the host"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={onApply}
            disabled={applying}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {applying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}
            Apply to join
          </button>
        </div>
      )}
    </article>
  );
}

function HostedVentureCard({
  venture,
  onOpenChat,
  onInvited,
}: {
  venture: VentureParty;
  onOpenChat: () => void;
  onInvited: () => void;
}) {
  const decide = useDecideVentureApplication();
  const close = useCloseHostedVenture();
  const [inviteOpen, setInviteOpen] = useState(false);
  const pending = venture.applications.filter((app) => app.status === "pending");
  const accepted = venture.applications.filter((app) => app.status === "accepted");
  const isClosed = venture.status === "closed";

  const decideApp = (application: VentureApplication, status: "accepted" | "declined") => {
    decide.mutate(
      { application_id: application.id, status },
      {
        onSuccess: () =>
          toast.success(status === "accepted" ? "Applicant accepted." : "Request declined."),
        onError: (err) => toast.error((err as Error).message),
      },
    );
  };

  const closeVenture = () => {
    close.mutate(venture.id, {
      onSuccess: () => toast.success("Venture closed."),
      onError: (err) => toast.error((err as Error).message),
    });
  };

  return (
    <article className="rounded-2xl border border-border bg-card p-4 animate-rise">
      <VentureCardHeader venture={venture} hideHost />
      <VentureMeta venture={venture} />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onOpenChat}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background py-2.5 text-xs font-semibold text-foreground"
        >
          <MessageCircle className="h-4 w-4" /> Chat
        </button>
        {!isClosed && (
          <button
            type="button"
            onClick={() => setInviteOpen((open) => !open)}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-2xl border py-2.5 text-xs font-semibold",
              inviteOpen
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground",
            )}
          >
            <UserPlus className="h-4 w-4" /> Invite
          </button>
        )}
        {!isClosed && (
          <button
            type="button"
            onClick={closeVenture}
            disabled={close.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {close.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
            Close
          </button>
        )}
      </div>

      {inviteOpen && !isClosed && (
        <InviteConnectedUsersPanel venture={venture} onInvited={onInvited} />
      )}

      <div className="mt-4 space-y-3">
        <div>
          <p className="label-mono text-muted-foreground">Pending requests</p>
          {pending.length ? (
            <div className="mt-2 space-y-2">
              {pending.map((application) => (
                <ApplicantRow
                  key={application.id}
                  application={application}
                  busy={decide.isPending && decide.variables?.application_id === application.id}
                  onAccept={() => decideApp(application, "accepted")}
                  onDecline={() => decideApp(application, "declined")}
                />
              ))}
            </div>
          ) : (
            <p className="mt-2 rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
              No pending requests.
            </p>
          )}
        </div>

        {venture.applications.some(
          (application) => (application.status as string) === "invited",
        ) && (
          <div>
            <p className="label-mono text-muted-foreground">Invites sent</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {venture.applications
                .filter((application) => (application.status as string) === "invited")
                .map((application) => (
                  <MemberPill key={application.id} profile={application.applicant} />
                ))}
            </div>
          </div>
        )}

        {accepted.length > 0 && (
          <div>
            <p className="label-mono text-muted-foreground">Party members</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {accepted.map((application) => (
                <MemberPill key={application.id} profile={application.applicant} />
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function InviteConnectedUsersPanel({
  venture,
  onInvited,
}: {
  venture: VentureParty;
  onInvited: () => void;
}) {
  const [search, setSearch] = useState("");
  const listCandidates = useServerFn(listVentureInviteCandidates);
  const inviteFn = useServerFn(inviteUserToVenture);
  const candidatesQuery = useQuery({
    queryKey: ["ventures", "invite-candidates", venture.id],
    queryFn: () => listCandidates({ data: { venture_id: venture.id } }),
    staleTime: 10_000,
  });
  const invite = useMutation({
    mutationFn: (targetUserId: string) =>
      inviteFn({ data: { venture_id: venture.id, target_user_id: targetUserId } }),
    onSuccess: (application) => {
      toast.success(`Invite sent to ${displayName(application.applicant)}.`);
      candidatesQuery.refetch();
      onInvited();
      requestPushPrompt("venture");
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const candidates = candidatesQuery.data ?? [];
    if (!keyword) return candidates;
    return candidates.filter((candidate) => {
      const haystack = [candidate.display_name, candidate.handle, candidate.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [candidatesQuery.data, search]);

  const full = venture.filled_slots >= venture.max_slots || venture.status === "full";

  return (
    <div className="mt-3 rounded-2xl border border-border bg-background/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-mono text-muted-foreground">Invite people</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Pick someone you follow, or someone who follows you.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground">
          {venture.filled_slots}/{venture.max_slots}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search followed / followers"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>

      {candidatesQuery.isLoading ? (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading people
        </div>
      ) : candidatesQuery.isError ? (
        <button
          type="button"
          onClick={() => candidatesQuery.refetch()}
          className="mt-3 w-full rounded-xl border border-border bg-card py-3 text-xs font-semibold text-muted-foreground"
        >
          Could not load people. Retry
        </button>
      ) : filtered.length ? (
        <div className="scroll-panel mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
          {filtered.map((candidate) => {
            const alreadyAccepted = candidate.invite_status === "accepted";
            const alreadyPending = candidate.invite_status === "pending";
            const alreadyInvited = candidate.invite_status === "invited";
            const disabled =
              full || alreadyAccepted || alreadyPending || alreadyInvited || invite.isPending;
            return (
              <InviteCandidateRow
                key={candidate.id}
                candidate={candidate}
                disabled={disabled}
                busy={invite.isPending && invite.variables === candidate.id}
                statusLabel={
                  alreadyAccepted
                    ? "In party"
                    : alreadyPending
                      ? "Requested"
                      : alreadyInvited
                        ? "Invited"
                        : full
                          ? "Full"
                          : "Invite"
                }
                onInvite={() => invite.mutate(candidate.id)}
              />
            );
          })}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          {search.trim()
            ? "No people match that search."
            : "Follow people, or let them follow you, to invite them here."}
        </p>
      )}
    </div>
  );
}

function InviteCandidateRow({
  candidate,
  disabled,
  busy,
  statusLabel,
  onInvite,
}: {
  candidate: VentureInviteCandidate;
  disabled: boolean;
  busy: boolean;
  statusLabel: string;
  onInvite: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
      <Avatar profile={candidate} size="xs" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-xs font-semibold">{displayName(candidate)}</p>
          <RelationshipPill relationship={candidate.relationship} />
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {candidate.handle ? `@${candidate.handle}` : candidate.city || "Connected"}
        </p>
      </div>
      <button
        type="button"
        onClick={onInvite}
        disabled={disabled}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold",
          disabled
            ? "border border-border text-muted-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <UserPlus className="h-3.5 w-3.5" />
        )}
        {statusLabel}
      </button>
    </div>
  );
}

function RelationshipPill({
  relationship,
}: {
  relationship: VentureInviteCandidate["relationship"];
}) {
  const label =
    relationship === "mutual" ? "Mutual" : relationship === "following" ? "Following" : "Follower";
  return (
    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {label}
    </span>
  );
}

function JoinedVentureCard({
  venture,
  onOpenChat,
  onAcceptInvite,
  onDeclineInvite,
  busy = false,
}: {
  venture: VentureParty;
  onOpenChat: () => void;
  onAcceptInvite?: () => void;
  onDeclineInvite?: () => void;
  busy?: boolean;
}) {
  const status = (venture.my_application?.status as string | undefined) ?? "pending";
  const host = venture.host;
  const isAccepted = status === "accepted";
  const isPending = status === "pending";
  const isInvited = status === "invited";

  return (
    <article className="rounded-2xl border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-3">
        <Avatar profile={host} size="xs" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{venture.title}</h3>
            <StatusPill status={status} />
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="truncate">{displayName(host)}</span>
            <span>•</span>
            <span className="shrink-0">
              {venture.filled_slots}/{venture.max_slots}
            </span>
            <span className="shrink-0">slots</span>
          </div>
        </div>
        {isAccepted ? (
          <button
            type="button"
            onClick={onOpenChat}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Chat
          </button>
        ) : isInvited ? (
          <div className="grid shrink-0 grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onDeclineInvite}
              disabled={busy}
              className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground disabled:opacity-50"
            >
              Pass
            </button>
            <button
              type="button"
              onClick={onAcceptInvite}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Accept
            </button>
          </div>
        ) : (
          <span className="shrink-0 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
            {isPending ? "Waiting" : "Closed"}
          </span>
        )}
        <SafetyMenu
          targetName={displayName(host)}
          targetUserId={venture.host_id}
          className="shrink-0"
        />
      </div>
    </article>
  );
}

function VentureCardHeader({
  venture,
  hideHost = false,
}: {
  venture: VentureParty;
  hideHost?: boolean;
}) {
  const host = venture.host;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-display text-lg font-bold">{venture.title}</h3>
          <StatusPill status={venture.status} />
        </div>
        {!hideHost && (
          <div className="mt-2 flex items-center gap-2">
            <Avatar profile={host} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{displayName(host)}</p>
              <p className="truncate text-[11px] text-muted-foreground">{host?.city || "Nearby"}</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-start gap-1">
        <div className="text-right">
          <p className="text-sm font-bold">
            {venture.filled_slots}/{venture.max_slots}
          </p>
          <p className="text-[10px] text-muted-foreground">slots</p>
        </div>
        {!hideHost && (
          <SafetyMenu
            targetName={displayName(host)}
            targetUserId={venture.host_id}
            className="-mt-1 shrink-0"
          />
        )}
      </div>
    </div>
  );
}

function VentureMeta({ venture }: { venture: VentureParty }) {
  const hostTribes = venture.host?.tribe_ids?.filter(Boolean) as TribeId[] | undefined;
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {venture.intents.slice(0, 5).map((intent) => (
          <span key={intent} className="label-mono rounded-full bg-accent/15 px-2 py-1 text-accent">
            {intent}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" /> {venture.time_window}
        </span>
        <span>{venture.scope === "mine" ? "Host tribes only" : "All tribes"}</span>
      </div>
      {hostTribes?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {hostTribes.map((tribeId) => {
            const tribe = TRIBES.find((item) => item.id === tribeId);
            if (!tribe) return null;
            return (
              <TribeBadge key={tribe.id} tribe={tribe} />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ApplicantRow({
  application,
  busy,
  onAccept,
  onDecline,
}: {
  application: VentureApplication;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-start gap-2">
        <Avatar profile={application.applicant} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{displayName(application.applicant)}</p>
          {application.message ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {application.message}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">No note attached.</p>
          )}
        </div>
        <SafetyMenu
          targetName={displayName(application.applicant)}
          targetUserId={application.applicant_id}
          className="-mt-1 shrink-0"
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onDecline}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <UserX className="h-3.5 w-3.5" /> Decline
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Accept
        </button>
      </div>
    </div>
  );
}

function MemberPill({ profile }: { profile: VentureProfileLite | null }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background px-2 py-1">
      <Avatar profile={profile} size="xs" />
      <span className="truncate text-xs font-semibold">{displayName(profile)}</span>
    </span>
  );
}

function Avatar({
  profile,
  size = "md",
}: {
  profile: VentureProfileLite | null;
  size?: "xs" | "sm" | "md";
}) {
  const avatar = profile?.avatar_url || profile?.avatar_emoji || "";
  const isImg = avatar.startsWith("http") || avatar.startsWith("data:");
  const initial = (displayName(profile)[0] ?? "U").toUpperCase();
  const classes =
    size === "xs" ? "h-6 w-6 text-xs" : size === "sm" ? "h-9 w-9 text-sm" : "h-11 w-11 text-base";
  return (
    <span className="relative shrink-0">
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full bg-secondary font-semibold",
          classes,
        )}
      >
        {isImg ? (
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          avatar || initial
        )}
      </span>
      {showPlusBadge(profile?.plan) && <PlusBadge />}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const label =
    status === "open"
      ? "Open"
      : status === "full"
        ? "Full"
        : status === "closed"
          ? "Closed"
          : status === "accepted"
            ? "Accepted"
            : status === "invited"
              ? "Invited"
              : status === "declined"
                ? "Declined"
                : status === "cancelled"
                  ? "Cancelled"
                  : "Pending";
  const color =
    status === "open" || status === "accepted"
      ? "border-primary/40 bg-primary/10 text-primary"
      : status === "pending" || status === "invited"
        ? "border-accent/40 bg-accent/10 text-accent"
        : "border-border bg-secondary text-muted-foreground";
  return <span className={cn("label-mono rounded-full border px-2 py-1", color)}>{label}</span>;
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="label-mono mb-1.5 block text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  title,
  body,
  compact,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border text-left transition-colors",
        compact ? "px-3 py-2.5" : "p-3",
        active ? "border-primary bg-primary/10" : "border-border bg-background",
      )}
    >
      <p className="text-xs font-semibold">{title}</p>
      {body && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{body}</p>}
    </button>
  );
}

function LoadingBlock({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 text-sm text-muted-foreground",
        compact ? "py-4" : "py-10",
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function RetryBlock({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {label}{" "}
      <button type="button" onClick={onRetry} className="font-semibold text-foreground underline">
        Retry
      </button>
    </div>
  );
}

function EmptyPanel({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function displayName(profile: VentureProfileLite | null | undefined) {
  return profile?.display_name?.trim() || "Someone";
}

function shortTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
