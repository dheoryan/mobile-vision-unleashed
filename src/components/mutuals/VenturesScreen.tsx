import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { ClockIcon } from "@phosphor-icons/react/dist/csr/Clock";
import { CrosshairIcon } from "@phosphor-icons/react/dist/csr/Crosshair";
import { ImageIcon } from "@phosphor-icons/react/dist/csr/Image";
import { LightningIcon } from "@phosphor-icons/react/dist/csr/Lightning";
import { LockIcon } from "@phosphor-icons/react/dist/csr/Lock";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { PencilIcon } from "@phosphor-icons/react/dist/csr/Pencil";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { TicketIcon } from "@phosphor-icons/react/dist/csr/Ticket";
import { UserCheckIcon } from "@phosphor-icons/react/dist/csr/UserCheck";
import { UserMinusIcon } from "@phosphor-icons/react/dist/csr/UserMinus";
import { UserPlusIcon } from "@phosphor-icons/react/dist/csr/UserPlus";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { toast } from "sonner";
import { TRIBES, tribeById, type Person, type TribeId } from "@/lib/mutuals-data";
import { INTEREST_OPTION_GROUPS, INTEREST_OPTIONS } from "@/lib/profile-options";
import { AppHeader, SectionTitle, TribeBadge } from "./Shared";
import { PlusBadge } from "./PlusBadge";
import { SafetyMenu } from "./SafetyMenu";
import { UpsellModal } from "./UpsellModal";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { useVisualViewport, visualViewportStyle } from "@/hooks/use-visual-viewport";
import { FeatureIllustration } from "./FeatureIllustration";
import venturesArt from "@/assets/app-illustrations/ventures.webp";
import { VentureCardShell } from "./VentureImage";
import { VentureListSkeleton } from "./Skeleton";
import { readStoredVentureMode, saveStoredVentureMode } from "@/lib/ventures-mode";
import { useBlocked } from "@/lib/blocked-store";
import { requestPushPrompt } from "@/lib/push-prompt-events";
import { uploadVentureImage, signVentureImageUrl } from "@/lib/uploads";
import { useAuth } from "@/lib/auth-context";
import {
  useApplyToVenture,
  useWithdrawVentureApplication,
  useReopenHostedVenture,
  useCompleteHostedVenture,
  useCancelHostedVenture,
  useCreateHostedVenture,
  useUpdateHostedVenture,
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
import {
  DURATION_CHOICES,
  dayChoices,
  durationMinutes,
  endTimeForDuration,
  endsAtLabel,
  initialDay,
  initialTime,
  minutesUntilEnd,
  periodDefaultTime,
  PLAN_PERIOD_CHOICES,
  timingLabel,
  dayChoiceLabel,
  timingPayload,
  todayKey,
  ventureAcceptsRequests,
  ventureLifecycle,
  ventureStateLabel,
} from "@/lib/venture-time";
import { VentureBoard } from "./VentureBoard";
import { VentureSearching } from "./VentureSearching";
import { VentureTicket, VentureTicketDetail } from "./VentureTicket";
import { VenuePicker, type PickedVenue } from "./VenuePicker";
import { VentureVibeLabel } from "./VentureVibeLabel";
import { useMyLocationSettings, useSaveMyLocation } from "@/lib/location-store";
import { requestBrowserLocation } from "@/lib/location";
import type { TribeVentureDraft } from "@/lib/tribe-room";

const VENTURES_INTRO_KEY = "mutuals:ventures:intro-seen";
const VENTURE_DRAFT_KEY = "mutuals:venture-draft";

type StoredVentureDraft = {
  title: string;
  intents: string[];
  scope: VentureScope;
  day: string;
  time: string;
  durationMins: number;
  durationMode: "preset" | "custom";
  customEndTime: string;
  maxSlots: number;
  note: string;
  venue: PickedVenue | null;
  arrivalDetails: string;
  imagePath: string | null;
};

function ventureDraftStorageKey(userId: string) {
  return `${VENTURE_DRAFT_KEY}:${userId}`;
}

function readStoredHostDraft(userId?: string): StoredVentureDraft | null {
  if (!userId) return null;
  try {
    const raw = safeLocalStorage()?.getItem(ventureDraftStorageKey(userId));
    return raw ? (JSON.parse(raw) as StoredVentureDraft) : null;
  } catch {
    return null;
  }
}

function clearStoredHostDraft(userId?: string) {
  if (userId) safeLocalStorage()?.removeItem(ventureDraftStorageKey(userId));
}

// A declined or cancelled application isn't a live claim on a slot - the
// only statuses that should hide a Venture from the joinable board or mark
// it "yours" are the ones where the applicant still has a stake in it.
const LIVE_APPLICATION_STATUSES = new Set(["invited", "accepted", "pending"]);
function isLiveApplicationStatus(status: string | undefined) {
  return status !== undefined && LIVE_APPLICATION_STATUSES.has(status);
}

function dateMs(value: string | null | undefined) {
  if (!value) return null;
  const valueMs = Date.parse(value);
  return Number.isFinite(valueMs) ? valueMs : null;
}

/** Active plans read as an agenda: happening/next first, undated legacy rows last. */
function compareUpcomingVentures(left: VentureParty, right: VentureParty) {
  const leftStart = dateMs(left.starts_at);
  const rightStart = dateMs(right.starts_at);
  if (leftStart === null && rightStart === null) {
    return (dateMs(right.created_at) ?? 0) - (dateMs(left.created_at) ?? 0);
  }
  if (leftStart === null) return 1;
  if (rightStart === null) return -1;
  return leftStart - rightStart;
}

/** Memories read as a journal: the latest Venture date is always first. */
function compareRecentVentures(left: VentureParty, right: VentureParty) {
  const leftDate = dateMs(left.starts_at) ?? dateMs(left.created_at) ?? 0;
  const rightDate = dateMs(right.starts_at) ?? dateMs(right.created_at) ?? 0;
  return rightDate - leftDate;
}

function safeLocalStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function introKey(userId: string) {
  return `${VENTURES_INTRO_KEY}:${userId}`;
}

function hasSeenVentureIntro(userId: string) {
  return safeLocalStorage()?.getItem(introKey(userId)) === "1";
}

function markVentureIntroSeen(userId: string) {
  safeLocalStorage()?.setItem(introKey(userId), "1");
}

type Mode = "look" | "yours" | "host";
type VentureStage = "intro" | "role" | "loading" | "feature";

// Long enough for the transition to read as intentional when query data is
// already cached, while still yielding immediately after that when the board
// needs real network time.
const VENTURE_ENTRY_MIN_MS = 1100;

// Kept "This week evenings" and "This weekend" verbatim so Ventures created
// before this list grew still match a chip when their host opens the editor.
// Free text in the database, so this can grow again without a migration.

export function VenturesScreen({
  profile,
  setProfile,
  onOpenVentureChat,
  onSendHello: _onSendHello,
  onLaunchVenture,
  initialTribeDraft,
  onTribeDraftFinished,
  onTribeDraftCancelled,
  notificationDestination,
  onNotificationDestinationConsumed,
}: {
  profile: Profile;
  setProfile?: (updater: (p: Profile | null) => Profile | null) => void;
  onOpenVentureChat: (venture: VentureParty) => void;
  onSendHello?: (person: Person, message: string) => void;
  onLaunchVenture?: () => void;
  initialTribeDraft?: TribeVentureDraft | null;
  onTribeDraftFinished?: (draft: TribeVentureDraft, venture: VentureParty) => void;
  onTribeDraftCancelled?: () => void;
  notificationDestination?: {
    ventureId: string;
    mode: "host" | "yours";
  } | null;
  onNotificationDestinationConsumed?: () => void;
}) {
  const { user } = useAuth();
  const userId = user?.id;
  const [stage, setStage] = useState<VentureStage>("intro");
  const [loadingStartedAt, setLoadingStartedAt] = useState(0);
  const [mode, setModeState] = useState<Mode>("look");
  const [scope, setScope] = useState<VentureScope>("all");
  const [hostFormOpen, setHostFormOpen] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [activeTribeDraft, setActiveTribeDraft] = useState<TribeVentureDraft | null>(null);

  const blocked = useBlocked();
  const openQuery = useOpenVentures(scope);
  const hostedQuery = useMyHostedVentures();
  const joinedQuery = useMyJoinedVentures();

  useEffect(() => {
    if (!userId) return;
    setModeState(readStoredVentureMode(userId));
    setScope("all");
    setHostFormOpen(false);
    setPaywall(false);
    if (hasSeenVentureIntro(userId)) {
      setLoadingStartedAt(Date.now());
      setStage("loading");
    } else {
      setStage("intro");
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || !initialTribeDraft) return;
    markVentureIntroSeen(userId);
    saveStoredVentureMode(userId, "host");
    setModeState("host");
    setStage("feature");
    setActiveTribeDraft(initialTribeDraft);
    setHostFormOpen(true);
  }, [initialTribeDraft, userId]);

  useEffect(() => {
    if (!userId || !notificationDestination) return;
    markVentureIntroSeen(userId);
    saveStoredVentureMode(userId, notificationDestination.mode);
    setModeState(notificationDestination.mode);
    setStage("feature");
    setHostFormOpen(false);
  }, [notificationDestination, userId]);

  const openVentures = useMemo(
    () => (openQuery.data ?? []).filter((v) => !blocked.has(v.host_id)),
    [openQuery.data, blocked],
  );
  const hostedVentures = useMemo(() => hostedQuery.data ?? [], [hostedQuery.data]);
  const joinedVentures = useMemo(() => joinedQuery.data ?? [], [joinedQuery.data]);
  const hasVentureActivity = hostedVentures.length > 0 || joinedVentures.length > 0;
  const entryDataIsLoading =
    mode === "look" ? openQuery.isLoading : joinedQuery.isLoading || hostedQuery.isLoading;

  useEffect(() => {
    if (stage !== "loading" || entryDataIsLoading) return;
    const remaining = Math.max(0, VENTURE_ENTRY_MIN_MS - (Date.now() - loadingStartedAt));
    const timer = window.setTimeout(() => setStage("feature"), remaining);
    return () => window.clearTimeout(timer);
  }, [entryDataIsLoading, loadingStartedAt, stage]);

  useEffect(() => {
    if (userId && stage === "intro" && hasVentureActivity && !hasSeenVentureIntro(userId)) {
      markVentureIntroSeen(userId);
      setLoadingStartedAt(Date.now());
      setStage("loading");
    }
  }, [hasVentureActivity, stage, userId]);

  const persistMode = (nextMode: Mode) => {
    setModeState(nextMode);
    if (userId) saveStoredVentureMode(userId, nextMode);
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
    if (userId) markVentureIntroSeen(userId);
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
    if (userId) markVentureIntroSeen(userId);
    persistMode(nextMode);
    setHostFormOpen(Boolean(options?.openHostForm));
    setLoadingStartedAt(Date.now());
    setStage("loading");
  };

  const startHosting = () => {
    if (MONETIZATION_ENABLED && profile.plan === "free" && profile.ventureCount >= 3) {
      setPaywall(true);
      return;
    }
    if (userId) markVentureIntroSeen(userId);
    persistMode("host");
    setStage("feature");
    setHostFormOpen(true);
  };

  const handleCreated = (venture: VentureParty) => {
    onLaunchVenture?.();
    setHostFormOpen(false);
    if (activeTribeDraft) {
      onTribeDraftFinished?.(activeTribeDraft, venture);
      setActiveTribeDraft(null);
    }
    onOpenVentureChat(venture);
  };

  return (
    <div className={cn("bg-habitat min-h-screen", stage === "loading" ? "pb-0" : "pb-32")}>
      <AppHeader
        title={stage !== "feature" ? "Ventures" : mode === "look" ? "Venture board" : "My Ventures"}
        accent="var(--color-primary)"
        action={
          stage === "feature" ? (
            <button
              type="button"
              onClick={startHosting}
              aria-label="Host a Venture"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          ) : undefined
        }
      />

      <main className="mx-auto max-w-md px-5">
        {stage === "intro" ? (
          <VenturesIntro onContinue={() => setStage("role")} />
        ) : stage === "role" ? (
          <VentureRoleChooser
            onBack={() => setStage("intro")}
            onChoose={(nextMode) => enterFeature(nextMode, { openHostForm: nextMode === "host" })}
          />
        ) : stage === "loading" ? (
          <VentureSearching
            label={mode === "look" ? "Opening the Venture board…" : "Opening your Ventures…"}
            detail={
              mode === "look"
                ? "Finding fresh plans that match how you want to meet."
                : "Gathering your plans, people and latest updates."
            }
          />
        ) : (
          <>
            {/* Discovery and My Ventures are peer views. Each exposes the
                other through the same compact switch in its section header. */}
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
                onOpenMine={() => switchMode("yours")}
                onStartHosting={startHosting}
                onChanged={() => {
                  openQuery.refetch();
                  joinedQuery.refetch();
                }}
              />
            ) : (
              <MyVenturesView
                profile={profile}
                formOpen={hostFormOpen}
                setFormOpen={setHostFormOpen}
                hostedVentures={hostedVentures}
                joinedVentures={joinedVentures}
                isLoading={hostedQuery.isLoading || joinedQuery.isLoading}
                onCreated={handleCreated}
                onOpenChat={onOpenVentureChat}
                onBrowse={() => switchMode("look")}
                onChanged={() => {
                  openQuery.refetch();
                  hostedQuery.refetch();
                  joinedQuery.refetch();
                }}
                tribeDraft={activeTribeDraft}
                onDraftCancelled={() => {
                  setActiveTribeDraft(null);
                  onTribeDraftCancelled?.();
                }}
                focusVentureId={notificationDestination?.ventureId ?? null}
                onFocused={onNotificationDestinationConsumed}
              />
            )}
          </>
        )}
      </main>

      <UpsellModal open={paywall} onClose={() => setPaywall(false)} used={profile.ventureCount} />
    </div>
  );
}

function RoleButton({
  active,
  icon,
  onClick,
  children,
  accentColor,
}: {
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
  /** Selected state fills with this Tribe color instead of the brand
   *  gradient - same "gradient = everyone, Tribe color = Tribe-only" rule
   *  used everywhere audience shows up in the Venture system (Vibe chips,
   *  the Audience toggle, the submit button). Omit for the "all" side of a
   *  toggle, which keeps the gradient. */
  accentColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? accentColor
            ? "text-white shadow-sm"
            : "bg-meutuals-gradient text-white shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
      style={active && accentColor ? { backgroundColor: accentColor } : undefined}
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
          <LightningIcon className="h-5 w-5" />
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
          <ShieldCheckIcon className="h-4 w-4" />
          <h3 className="text-sm font-semibold">Meet safely</h3>
        </div>
        <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
          <li>Meet in a public place and arrange your own transport.</li>
          <li>Keep exact locations and personal contact details in accepted-member chat.</li>
          <li>
            Tell someone you trust where you are going. Leave and report anything that feels wrong.
          </li>
        </ul>
      </section>

      <button
        type="button"
        onClick={onContinue}
        className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Choose Looking or Hosting
        <ArrowRightIcon className="h-4 w-4" />
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
            icon={<MagnifyingGlassIcon className="h-5 w-5" />}
            title="Looking"
            body="Browse open Ventures, request to join, then chat after you are accepted."
            onClick={() => onChoose("look")}
          />
          <RoleChoiceCard
            icon={<PlusIcon className="h-5 w-5" />}
            title="Hosting"
            body="Create an open party, review requests, and keep the crew organized."
            onClick={() => onChoose("host")}
          />
        </div>
      </section>

      <button
        type="button"
        onClick={onBack}
        className="mt-4 w-full rounded-2xl border border-border bg-card py-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
      className="group flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/60 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{body}</span>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          {title === "Looking" ? "Browse Ventures" : "Create Venture"}
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </span>
      </span>
    </button>
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
  onOpenMine,
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
  onOpenMine: () => void;
  onStartHosting: () => void;
  onChanged: () => void;
}) {
  const apply = useApplyToVenture();
  const withdraw = useWithdrawVentureApplication();
  const locationQuery = useMyLocationSettings();
  const saveLocation = useSaveMyLocation();
  const [locating, setLocating] = useState(false);
  const enableVenueDistance = async () => {
    setLocating(true);
    try {
      const location = await requestBrowserLocation();
      // This consent is for personal venue distance, not people discovery.
      // Keep discoverability paused until the member explicitly enables it.
      await saveLocation.mutateAsync({ ...location, radius_km: 15, discoverable: false });
      toast.success("Venue distance is ready", {
        description: "Only you see these bands. Nearby people remains paused.",
      });
      onChanged();
    } catch (error) {
      toast.error("Venue distance remains off", { description: (error as Error).message });
    } finally {
      setLocating(false);
    }
  };
  const withdrawRequest = (applicationId: string) =>
    withdraw.mutate(applicationId, {
      onSuccess: () => {
        toast.success("Request withdrawn.");
        onChanged();
      },
      onError: (err) => toast.error((err as Error).message),
    });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const mineLabel = profile.tribeIds.length > 1 ? "My Tribes" : "My Tribe";
  const primaryTribe = tribeById(profile.tribeIds[0]);

  const activeParties = useMemo(
    () =>
      joinedVentures.filter((venture) => (venture.my_application?.status as string) === "accepted"),
    [joinedVentures],
  );
  const liveJoinedCount = useMemo(
    () =>
      joinedVentures.filter((venture) => {
        const lifecycle = ventureLifecycle(venture);
        return (
          isLiveApplicationStatus(venture.my_application?.status) &&
          lifecycle !== "cancelled" &&
          lifecycle !== "completed"
        );
      }).length,
    [joinedVentures],
  );
  const invitationCount = joinedVentures.filter(
    (venture) =>
      venture.my_application?.status === "invited" && ventureLifecycle(venture) === "scheduled",
  ).length;

  // A declined or self-withdrawn (cancelled) application isn't a live claim
  // on a slot - the Venture should come back to the board, not disappear
  // everywhere. VentureBoard already renders "Closed to you"/"Request
  // declined" for exactly that status; it just never used to receive one.
  const requestedVentureIds = useMemo(
    () =>
      new Set(
        joinedVentures
          .filter((venture) => isLiveApplicationStatus(venture.my_application?.status))
          .map((venture) => venture.id),
      ),
    [joinedVentures],
  );

  const joinableVentures = useMemo(
    () =>
      openVentures.filter(
        (venture) =>
          !isLiveApplicationStatus(venture.my_application?.status) &&
          !requestedVentureIds.has(venture.id),
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
      {/* Invitations, requests, and accepted plans live in My Ventures so the
          discovery list stays focused on plans the member can still join. */}

      <SectionTitle
        title="Open Ventures"
        hint={isLoading ? "Loading parties" : `${joinableVentures.length} joinable`}
        action={
          <button
            type="button"
            onClick={onOpenMine}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <TicketIcon className="h-3.5 w-3.5 text-primary" />
            My Ventures
            {liveJoinedCount > 0 && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full bg-meutuals-gradient px-1.5 font-mono text-xs font-bold text-white"
                aria-label={`${invitationCount} invitation${invitationCount === 1 ? "" : "s"} need an answer`}
              >
                {invitationCount > 0 ? invitationCount : liveJoinedCount}
              </span>
            )}
          </button>
        }
      />

      {/* Filter comes right after the title it filters, not before - a
          control reading before the thing it controls made the section feel
          headerless. */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-1">
        <RoleButton
          active={scope === "all"}
          icon={<SlidersHorizontalIcon className="h-4 w-4" />}
          onClick={() => setScope("all")}
        >
          All Tribes
        </RoleButton>
        <RoleButton
          active={scope === "mine"}
          icon={<UsersIcon className="h-4 w-4" />}
          onClick={() => setScope("mine")}
          accentColor={primaryTribe.colorVar}
        >
          {mineLabel}
        </RoleButton>
      </div>

      {!locationQuery.isLoading && !locationQuery.data && (
        <button
          type="button"
          onClick={enableVenueDistance}
          disabled={locating || saveLocation.isPending}
          className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            {locating ? (
              <SpinnerGapIcon className="h-4 w-4 animate-spin" />
            ) : (
              <CrosshairIcon className="h-4 w-4" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold">See how far each Venture is</span>
            <span className="block text-xs leading-snug text-muted-foreground">
              Uses your approximate area privately. It does not make you discoverable.
            </span>
          </span>
        </button>
      )}

      <div className="mt-4">
        {isLoading ? (
          <VentureListSkeleton />
        ) : isError ? (
          <RetryBlock label="Could not load open Ventures." onRetry={onRetry} />
        ) : joinableVentures.length ? (
          <VentureBoard
            ventures={joinableVentures}
            notes={notes}
            onNoteChange={(id, value) => setNotes((cur) => ({ ...cur, [id]: value }))}
            onApply={submitApply}
            onOpenChat={onOpenChat}
            applyingId={apply.isPending ? (apply.variables?.venture_id ?? null) : null}
            onWithdraw={withdrawRequest}
            withdrawingId={withdraw.isPending ? (withdraw.variables ?? null) : null}
          />
        ) : (
          <EmptyPanel
            icon={<MagnifyingGlassIcon className="h-6 w-6" />}
            title={
              activeParties.length ? "No more open Ventures here." : "No open Ventures here yet."
            }
            body={
              activeParties.length
                ? "You already joined or requested the available Ventures. Check Yours, switch filters, or host a new one."
                : "Host one now or switch the tribe filter."
            }
            actionLabel="Host a Venture"
            onAction={onStartHosting}
            gradient
          />
        )}
      </div>
    </>
  );
}

function MyVenturesView({
  profile,
  formOpen,
  setFormOpen,
  hostedVentures,
  joinedVentures,
  isLoading,
  onCreated,
  onOpenChat,
  onBrowse,
  onChanged,
  tribeDraft,
  onDraftCancelled,
  focusVentureId,
  onFocused,
}: {
  profile: Profile;
  formOpen: boolean;
  setFormOpen: (open: boolean) => void;
  hostedVentures: VentureParty[];
  joinedVentures: VentureParty[];
  isLoading: boolean;
  onCreated: (venture: VentureParty) => void;
  onOpenChat: (venture: VentureParty) => void;
  onBrowse: () => void;
  onChanged: () => void;
  tribeDraft: TribeVentureDraft | null;
  onDraftCancelled: () => void;
  focusVentureId?: string | null;
  onFocused?: () => void;
}) {
  const [ventureTab, setVentureTab] = useState<"active" | "history">("active");
  const [ownershipTab, setOwnershipTab] = useState<"hosted" | "joined">("hosted");
  const [detailId, setDetailId] = useState<string | null>(null);
  const hostFormViewport = useVisualViewport(formOpen);
  const hostedActive = useMemo(
    () =>
      hostedVentures
        .filter((venture) => ["scheduled", "happening"].includes(ventureLifecycle(venture)))
        .sort(compareUpcomingVentures),
    [hostedVentures],
  );
  const hostedMemories = useMemo(
    () =>
      hostedVentures
        .filter((venture) => ventureLifecycle(venture) === "completed")
        .sort(compareRecentVentures),
    [hostedVentures],
  );
  const hostedCancelled = useMemo(
    () =>
      hostedVentures
        .filter((venture) => ventureLifecycle(venture) === "cancelled")
        .sort(compareRecentVentures),
    [hostedVentures],
  );
  const invitations = useMemo(
    () =>
      joinedVentures
        .filter(
          (venture) =>
            venture.my_application?.status === "invited" &&
            ventureLifecycle(venture) === "scheduled",
        )
        .sort(compareUpcomingVentures),
    [joinedVentures],
  );
  const joinedActive = useMemo(
    () =>
      joinedVentures
        .filter(
          (venture) =>
            venture.my_application?.status === "accepted" &&
            ["scheduled", "happening"].includes(ventureLifecycle(venture)),
        )
        .sort(compareUpcomingVentures),
    [joinedVentures],
  );
  const pending = useMemo(
    () =>
      joinedVentures
        .filter(
          (venture) =>
            venture.my_application?.status === "pending" &&
            ventureLifecycle(venture) === "scheduled",
        )
        .sort(compareUpcomingVentures),
    [joinedVentures],
  );
  const joinedMemories = useMemo(
    () =>
      joinedVentures
        .filter(
          (venture) =>
            venture.my_application?.status === "accepted" &&
            ventureLifecycle(venture) === "completed",
        )
        .sort(compareRecentVentures),
    [joinedVentures],
  );
  const joinedCancelled = useMemo(
    () =>
      joinedVentures
        .filter(
          (venture) =>
            venture.my_application?.status === "accepted" &&
            ventureLifecycle(venture) === "cancelled",
        )
        .sort(compareRecentVentures),
    [joinedVentures],
  );
  const activeCount =
    hostedActive.length + invitations.length + joinedActive.length + pending.length;
  const historyCount =
    hostedMemories.length + joinedMemories.length + hostedCancelled.length + joinedCancelled.length;
  const joinedActiveCount = invitations.length + joinedActive.length + pending.length;
  const hostedHistoryCount = hostedMemories.length + hostedCancelled.length;
  const joinedHistoryCount = joinedMemories.length + joinedCancelled.length;
  const selectedCount =
    ventureTab === "active"
      ? ownershipTab === "hosted"
        ? hostedActive.length
        : joinedActiveCount
      : ownershipTab === "hosted"
        ? hostedHistoryCount
        : joinedHistoryCount;
  const detail = joinedVentures.find((venture) => venture.id === detailId) ?? null;

  const withdraw = useWithdrawVentureApplication();
  const withdrawRequest = (applicationId: string) =>
    withdraw.mutate(applicationId, {
      onSuccess: () => {
        toast.success("Request withdrawn.");
        onChanged();
      },
      onError: (err) => toast.error((err as Error).message),
    });

  const respondFn = useServerFn(respondToVentureInvite);
  const respond = useMutation({
    mutationFn: ({
      applicationId,
      status,
    }: {
      applicationId: string;
      status: "accepted" | "declined";
    }) => respondFn({ data: { application_id: applicationId, status } }),
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
  const withdrawingApplicationId = withdraw.isPending ? (withdraw.variables ?? null) : null;
  const respondingApplicationId = respond.isPending
    ? (respond.variables?.applicationId ?? null)
    : null;
  const respondToInvite = (applicationId: string, status: "accepted" | "declined") =>
    respond.mutate({ applicationId, status });

  useEffect(() => {
    if (!focusVentureId || isLoading) return;
    const focusedHosted = hostedVentures.find((venture) => venture.id === focusVentureId);
    const focusedJoined = joinedVentures.find((venture) => venture.id === focusVentureId);
    const focused = focusedHosted ?? focusedJoined;
    if (!focused) {
      toast.error("That Venture is no longer available.");
      onFocused?.();
      return;
    }
    setVentureTab(
      ["completed", "cancelled"].includes(ventureLifecycle(focused)) ? "history" : "active",
    );
    setOwnershipTab(focusedHosted ? "hosted" : "joined");
    setFormOpen(false);
    if (focusedJoined) setDetailId(focused.id);
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`venture-${focused.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      onFocused?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusVentureId, hostedVentures, isLoading, joinedVentures, onFocused, setFormOpen]);

  const openCreator = () => {
    setVentureTab("active");
    setOwnershipTab("hosted");
    setFormOpen(true);
  };

  useEffect(() => {
    if (!formOpen) return;
    setVentureTab("active");
    setOwnershipTab("hosted");
  }, [formOpen]);

  return (
    <>
      <SectionTitle
        title="Your Ventures"
        hint={
          isLoading
            ? "Loading"
            : ventureTab === "active"
              ? `${activeCount} active`
              : `${historyCount} memories & records`
        }
        action={
          <button
            type="button"
            onClick={onBrowse}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MagnifyingGlassIcon className="h-3.5 w-3.5 text-primary" />
            Venture board
          </button>
        }
      />

      <div
        aria-label="My Ventures"
        className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-border bg-card p-1"
      >
        {(["active", "history"] as const).map((tab) => {
          const selected = ventureTab === tab;
          const count = tab === "active" ? activeCount : historyCount;
          return (
            <button
              key={tab}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setVentureTab(tab);
                setFormOpen(false);
                if (tribeDraft) onDraftCancelled();
              }}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                selected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === "active" ? "Active" : "Memories"}
              {count > 0 && (
                <span
                  className={cn(
                    "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[10px] font-bold",
                    selected ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tablist"
        aria-label={`${ventureTab === "active" ? "Active" : "Memories"} Venture ownership`}
        className="mb-5 grid grid-cols-2 border-b border-border"
      >
        {(["hosted", "joined"] as const).map((tab) => {
          const selected = ownershipTab === tab;
          const count =
            ventureTab === "active"
              ? tab === "hosted"
                ? hostedActive.length
                : joinedActiveCount
              : tab === "hosted"
                ? hostedHistoryCount
                : joinedHistoryCount;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setOwnershipTab(tab)}
              className={cn(
                "relative inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === "hosted" ? (
                <LightningIcon className="h-3.5 w-3.5" weight={selected ? "fill" : "regular"} />
              ) : (
                <UsersIcon className="h-3.5 w-3.5" weight={selected ? "fill" : "regular"} />
              )}
              {tab === "hosted" ? "Hosted" : "Joined"}
              {count > 0 && (
                <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
              )}
              {selected && (
                <span
                  aria-hidden
                  className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* A dialog, not an inline expansion - same reasoning as the Edit
          Venture flow below. Beyond the layout benefit that flow already
          gets, this one matters for a real data-loss bug: rendered inline,
          BottomNav stayed fully visible and tappable while a multi-field
          draft was in progress, and since index.tsx only mounts the active
          tab (fully tearing down the previous one on switch), tapping away
          destroyed the whole in-progress application with no warning. A
          modal's own overlay sits on top of BottomNav, so there's nothing
          left to tap away to without first explicitly cancelling (which
          already correctly discards the draft) or finishing. */}
      <AnimatedModal
        open={formOpen}
        onOpenChange={(next) => {
          if (next) return;
          setFormOpen(false);
          if (tribeDraft) onDraftCancelled();
        }}
        title={tribeDraft ? "Turn this plan into a Venture" : "Host a Venture"}
        contentClassName="scroll-panel max-h-[90dvh] overflow-y-auto"
        viewportStyle={visualViewportStyle(hostFormViewport)}
      >
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold leading-tight">
                {tribeDraft ? "Turn this plan into a Venture" : "Host a Venture"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Everyone who taps in sees this exactly as you set it up. Your draft saves on this
                device.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                if (tribeDraft) onDraftCancelled();
              }}
              aria-label="Close"
              className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
          <HostForm
            profile={profile}
            draft={tribeDraft}
            variant="modal"
            onCancel={() => {
              setFormOpen(false);
              if (tribeDraft) onDraftCancelled();
            }}
            onCreated={onCreated}
          />
        </div>
      </AnimatedModal>

      <div className="pb-4">
        {isLoading ? (
          <VentureListSkeleton />
        ) : selectedCount === 0 ? (
          <EmptyPanel
            icon={
              ventureTab === "history" ? (
                <ArrowCounterClockwiseIcon className="h-6 w-6" />
              ) : ownershipTab === "hosted" ? (
                <LightningIcon className="h-6 w-6" />
              ) : (
                <UsersIcon className="h-6 w-6" />
              )
            }
            title={
              ventureTab === "active"
                ? ownershipTab === "hosted"
                  ? "No hosted Ventures."
                  : "No joined Ventures."
                : ownershipTab === "hosted"
                  ? "No hosted memories yet."
                  : "No joined memories yet."
            }
            body={
              ventureTab === "active"
                ? ownershipTab === "hosted"
                  ? "Create a plan and manage its requests here."
                  : "Invitations, requests and confirmed plans will appear here."
                : "Completed Ventures become memories here. Cancelled plans stay as quiet records."
            }
            actionLabel={
              ventureTab === "active"
                ? ownershipTab === "hosted"
                  ? "Create Venture"
                  : "Browse Venture board"
                : ownershipTab === "hosted" && joinedHistoryCount > 0
                  ? "View joined memories"
                  : ownershipTab === "joined" && hostedHistoryCount > 0
                    ? "View hosted memories"
                    : "Back to active"
            }
            onAction={
              ventureTab === "active"
                ? ownershipTab === "hosted"
                  ? openCreator
                  : onBrowse
                : ownershipTab === "hosted" && joinedHistoryCount > 0
                  ? () => setOwnershipTab("joined")
                  : ownershipTab === "joined" && hostedHistoryCount > 0
                    ? () => setOwnershipTab("hosted")
                    : () => setVentureTab("active")
            }
            gradient={ventureTab === "active"}
          />
        ) : ventureTab === "active" ? (
          <div className={cn("flex flex-col", ownershipTab === "hosted" ? "gap-3" : "gap-6")}>
            {ownershipTab === "hosted" && hostedActive.length > 0 && (
              <VentureRoleContent>
                {hostedActive.map((venture) => (
                  <div key={venture.id} id={`venture-${venture.id}`} className="scroll-mt-24">
                    <HostedVentureCard
                      venture={venture}
                      profile={profile}
                      onOpenChat={() => onOpenChat(venture)}
                      onChanged={onChanged}
                    />
                  </div>
                ))}
              </VentureRoleContent>
            )}

            {ownershipTab === "joined" &&
              invitations.length + joinedActive.length + pending.length > 0 && (
                <VentureRoleContent>
                  {invitations.length > 0 && (
                    <VentureStatusGroup title="Needs your reply" count={invitations.length} urgent>
                      {invitations.map((venture) => (
                        <JoinedVentureTicket
                          key={venture.id}
                          venture={venture}
                          onOpenChat={onOpenChat}
                          onOpenDetail={setDetailId}
                          onLeave={withdrawRequest}
                          withdrawingApplicationId={withdrawingApplicationId}
                          respondingApplicationId={respondingApplicationId}
                          onRespond={respondToInvite}
                        />
                      ))}
                    </VentureStatusGroup>
                  )}
                  {joinedActive.length > 0 && (
                    <VentureStatusGroup title="Going" count={joinedActive.length}>
                      {joinedActive.map((venture) => (
                        <JoinedVentureTicket
                          key={venture.id}
                          venture={venture}
                          onOpenChat={onOpenChat}
                          onOpenDetail={setDetailId}
                          onLeave={withdrawRequest}
                          withdrawingApplicationId={withdrawingApplicationId}
                          respondingApplicationId={respondingApplicationId}
                          onRespond={respondToInvite}
                        />
                      ))}
                    </VentureStatusGroup>
                  )}
                  {pending.length > 0 && (
                    <VentureStatusGroup title="Requested" count={pending.length}>
                      {pending.map((venture) => (
                        <JoinedVentureTicket
                          key={venture.id}
                          venture={venture}
                          onOpenChat={onOpenChat}
                          onOpenDetail={setDetailId}
                          onLeave={withdrawRequest}
                          withdrawingApplicationId={withdrawingApplicationId}
                          respondingApplicationId={respondingApplicationId}
                          onRespond={respondToInvite}
                        />
                      ))}
                    </VentureStatusGroup>
                  )}
                </VentureRoleContent>
              )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {ownershipTab === "hosted" && hostedMemories.length + hostedCancelled.length > 0 && (
              <VentureRoleContent>
                {hostedMemories.length > 0 && (
                  <VentureStatusGroup title="Venture memories" count={hostedMemories.length}>
                    {hostedMemories.map((venture) => (
                      <div key={venture.id} id={`venture-${venture.id}`} className="scroll-mt-24">
                        <HostedVentureCard
                          venture={venture}
                          profile={profile}
                          onOpenChat={() => onOpenChat(venture)}
                          onChanged={onChanged}
                        />
                      </div>
                    ))}
                  </VentureStatusGroup>
                )}
                {hostedCancelled.length > 0 && (
                  <VentureStatusGroup title="Cancelled" count={hostedCancelled.length} muted>
                    {hostedCancelled.map((venture) => (
                      <div key={venture.id} id={`venture-${venture.id}`} className="scroll-mt-24">
                        <HostedVentureCard
                          venture={venture}
                          profile={profile}
                          onOpenChat={() => onOpenChat(venture)}
                          onChanged={onChanged}
                        />
                      </div>
                    ))}
                  </VentureStatusGroup>
                )}
              </VentureRoleContent>
            )}

            {ownershipTab === "joined" && joinedMemories.length + joinedCancelled.length > 0 && (
              <VentureRoleContent>
                {joinedMemories.length > 0 && (
                  <VentureStatusGroup title="Venture memories" count={joinedMemories.length}>
                    {joinedMemories.map((venture) => (
                      <JoinedVentureTicket
                        key={venture.id}
                        venture={venture}
                        onOpenChat={onOpenChat}
                        onOpenDetail={setDetailId}
                        onLeave={withdrawRequest}
                        withdrawingApplicationId={withdrawingApplicationId}
                        respondingApplicationId={respondingApplicationId}
                        onRespond={respondToInvite}
                      />
                    ))}
                  </VentureStatusGroup>
                )}
                {joinedCancelled.length > 0 && (
                  <VentureStatusGroup title="Cancelled" count={joinedCancelled.length} muted>
                    {joinedCancelled.map((venture) => (
                      <JoinedVentureTicket
                        key={venture.id}
                        venture={venture}
                        onOpenChat={onOpenChat}
                        onOpenDetail={setDetailId}
                        onLeave={withdrawRequest}
                        withdrawingApplicationId={withdrawingApplicationId}
                        respondingApplicationId={respondingApplicationId}
                        onRespond={respondToInvite}
                      />
                    ))}
                  </VentureStatusGroup>
                )}
              </VentureRoleContent>
            )}
          </div>
        )}
      </div>

      <VentureTicketDetail
        venture={detail}
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        onOpenChat={() => detail && onOpenChat(detail)}
        onLeave={(id) => {
          setDetailId(null);
          withdrawRequest(id);
        }}
        leaving={withdraw.isPending}
      />
    </>
  );
}

function VentureRoleContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function VentureStatusGroup({
  title,
  count,
  urgent = false,
  muted = false,
  children,
}: {
  title: string;
  count: number;
  urgent?: boolean;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.14em]",
            urgent ? "text-primary" : "text-muted-foreground",
            muted && "opacity-70",
          )}
        >
          {title}
        </span>
        <span className="h-px flex-1 bg-border" aria-hidden />
        <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
      </div>
      <div className={cn("flex flex-col gap-3", muted && "opacity-80")}>{children}</div>
    </div>
  );
}

function JoinedVentureTicket({
  venture,
  onOpenChat,
  onOpenDetail,
  onLeave,
  withdrawingApplicationId,
  respondingApplicationId,
  onRespond,
}: {
  venture: VentureParty;
  onOpenChat: (venture: VentureParty) => void;
  onOpenDetail: (id: string) => void;
  onLeave: (applicationId: string) => void;
  withdrawingApplicationId: string | null;
  respondingApplicationId: string | null;
  onRespond: (applicationId: string, status: "accepted" | "declined") => void;
}) {
  return (
    <div id={`venture-${venture.id}`} className="scroll-mt-24">
      <VentureTicket
        venture={venture}
        onOpenChat={() => onOpenChat(venture)}
        onOpenDetail={() => onOpenDetail(venture.id)}
        onLeave={onLeave}
        busy={
          withdrawingApplicationId === venture.my_application?.id ||
          respondingApplicationId === venture.my_application?.id
        }
        onAcceptInvite={() =>
          venture.my_application?.id && onRespond(venture.my_application.id, "accepted")
        }
        onDeclineInvite={() =>
          venture.my_application?.id && onRespond(venture.my_application.id, "declined")
        }
      />
    </div>
  );
}

/**
 * Create a Venture, or edit an open one.
 *
 * One component for both because the fields are identical and a second,
 * near-duplicate form is how the two drift apart — a new field gets added to
 * create and quietly missing from edit. `editing` switches the mutation, the
 * copy and the reset behaviour; everything else is shared.
 */
function preferredDraftTime(draft?: TribeVentureDraft | null) {
  return [...(draft?.timeOptions ?? [])].sort((left, right) => right.votes - left.votes)[0] ?? null;
}

function HostForm({
  profile,
  onCancel,
  onCreated,
  editing,
  variant = "inline",
  draft,
}: {
  profile: Profile;
  onCancel: () => void;
  onCreated: (venture: VentureParty) => void;
  /** When present the form saves changes to this Venture instead of creating one. */
  editing?: VentureParty;
  /** "modal" drops the card chrome, because the dialog already provides it. */
  variant?: "inline" | "modal";
  draft?: TribeVentureDraft | null;
}) {
  const { user } = useAuth();
  const create = useCreateHostedVenture();
  const update = useUpdateHostedVenture();
  const isEditing = Boolean(editing);
  const storedDraft = !editing && !draft ? readStoredHostDraft(user?.id) : null;
  const suggestedTime = preferredDraftTime(draft);
  const [title, setTitle] = useState(editing?.title ?? draft?.title ?? storedDraft?.title ?? "");
  const [intents, setIntents] = useState<string[]>(editing?.intents ?? storedDraft?.intents ?? []);
  const [scope, setScope] = useState<VentureScope>(
    editing?.scope ?? (draft ? "mine" : (storedDraft?.scope ?? "all")),
  );
  // Timing is three pieces of local state that resolve to two timestamps on
  // submit. `day` and `time` are kept apart because they are picked apart —
  // a chip row and a clock — and joining them earlier would mean re-splitting
  // an ISO string every render.
  const [day, setDay] = useState<string>(
    () => suggestedTime?.day ?? storedDraft?.day ?? initialDay(editing),
  );
  const [time, setTime] = useState<string>(() =>
    suggestedTime
      ? periodDefaultTime(suggestedTime.period)
      : (storedDraft?.time ?? initialTime(editing)),
  );
  const [durationMins, setDurationMins] = useState<number>(
    () => durationMinutes(editing ?? {}) ?? storedDraft?.durationMins ?? 180,
  );
  const [durationMode, setDurationMode] = useState<"preset" | "custom">(
    storedDraft?.durationMode ?? "preset",
  );
  const [customEndTime, setCustomEndTime] = useState<string>(
    () =>
      storedDraft?.customEndTime ??
      endTimeForDuration(
        suggestedTime?.day ?? initialDay(editing),
        suggestedTime ? periodDefaultTime(suggestedTime.period) : initialTime(editing),
        durationMinutes(editing ?? {}) ?? 180,
      ),
  );
  const [maxSlots, setMaxSlots] = useState(
    editing?.max_slots ?? draft?.maxSlots ?? storedDraft?.maxSlots ?? 4,
  );
  const [note, setNote] = useState(
    editing?.note ??
      (draft
        ? [draft.note, `${draft.whenLabel} · ${draft.area}`]
            .filter(Boolean)
            .join("\n")
            .slice(0, 280)
        : (storedDraft?.note ?? "")),
  );
  const [venue, setVenue] = useState<PickedVenue | null>(() =>
    editing?.venue
      ? {
          google_place_id: editing.venue.google_place_id,
          host_label: editing.venue.host_label,
          area: editing.venue.area,
          // Coordinates are server-only. Reusing the stable place id preserves
          // the distance source without returning a pin to the browser.
          latitude: null,
          longitude: null,
        }
      : (storedDraft?.venue ?? null),
  );
  const [arrivalDetails, setArrivalDetails] = useState(
    editing?.private_venue?.arrival_details ?? storedDraft?.arrivalDetails ?? "",
  );
  const [imagePath, setImagePath] = useState<string | null>(
    editing?.image_url ?? storedDraft?.imagePath ?? null,
  );
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  /** Which decision is open. One at a time, by construction. */
  const [sheet, setSheet] = useState<"where" | "when" | "room" | "vibe" | "details" | null>(
    draft ? "when" : null,
  );
  const closeSheet = () => setSheet(null);
  const resolvedDurationMins =
    durationMode === "custom" ? minutesUntilEnd(day, time, customEndTime) : durationMins;

  // Resolve a preview for an existing image, including a locally-restored draft.
  useEffect(() => {
    if (!imagePath || imagePreview) return;
    let cancelled = false;
    void signVentureImageUrl(imagePath).then((url) => {
      if (!cancelled) setImagePreview(url);
    });
    return () => {
      cancelled = true;
    };
  }, [imagePath, imagePreview]);

  useEffect(() => {
    if (isEditing || draft || !user?.id) return;
    const hasDraftContent = Boolean(
      title.trim() || intents.length || venue || note.trim() || arrivalDetails.trim() || imagePath,
    );
    const storage = safeLocalStorage();
    const key = ventureDraftStorageKey(user.id);
    if (!hasDraftContent) {
      storage?.removeItem(key);
      return;
    }
    const timer = window.setTimeout(() => {
      const safeVenue = venue ? { ...venue, latitude: null, longitude: null } : null;
      storage?.setItem(
        key,
        JSON.stringify({
          title,
          intents,
          scope,
          day,
          time,
          durationMins,
          durationMode,
          customEndTime,
          maxSlots,
          note,
          venue: safeVenue,
          arrivalDetails,
          imagePath,
        } satisfies StoredVentureDraft),
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    arrivalDetails,
    customEndTime,
    day,
    draft,
    durationMins,
    durationMode,
    imagePath,
    intents,
    isEditing,
    maxSlots,
    note,
    scope,
    time,
    title,
    user?.id,
    venue,
  ]);

  // Audience is locked in the database once anyone has applied, because
  // flipping 'all' -> 'mine' would retroactively revoke access for people from
  // other Tribes who already joined. Reflect that here rather than letting the
  // host try and get an error back.
  const audienceLocked = isEditing && (editing!.applications?.length ?? 0) > 0;
  const occupancy = editing ? editing.filled_slots : 1;

  const myTribes = TRIBES.filter((tribe) => profile.tribeIds.includes(tribe.id));
  // The host's primary Tribe stands in for "Tribe color" wherever a Venture
  // is Tribe-only but the host belongs to more than one - same convention
  // Profile/public-profile use for their own primary-Tribe accents.
  const primaryTribe = myTribes[0] ?? tribeById(profile.tribeIds[0]);
  // A Tribe-only Venture already limits who can even see it, so its Vibe
  // picker narrows to match - general tags (no tribeId, e.g. Food & drink)
  // plus whichever group(s) line up with the host's own Tribe(s). An
  // all-Tribes Venture keeps every group, same as today - narrowing that one
  // would discourage exactly the cross-Tribe mixing Ventures exist for.
  const visibleIntentGroups =
    scope === "mine"
      ? INTEREST_OPTION_GROUPS.filter(
          (group) => !("tribeId" in group) || profile.tribeIds.includes(group.tribeId),
        )
      : INTEREST_OPTION_GROUPS;
  const visibleIntentIds = new Set(
    visibleIntentGroups.flatMap((group) => group.items.map((option) => option.id)),
  );
  const suggestedIntents = INTEREST_OPTIONS.filter(
    (option) => profile.interests.includes(option.id) && visibleIntentIds.has(option.id),
  ).slice(0, 6);
  const canSubmit =
    title.trim().length >= 3 &&
    intents.length > 0 &&
    maxSlots >= 2 &&
    maxSlots <= 20 &&
    // Cannot shrink below the people already in the room. The database refuses
    // this too; saying so here avoids a pointless round trip.
    maxSlots >= occupancy &&
    resolvedDurationMins !== null &&
    // New Ventures must say where. Legacy Ventures remain editable even when
    // they predate the venue tier.
    (isEditing || Boolean(venue)) &&
    !uploading &&
    !update.isPending;

  // Upload immediately on pick rather than on submit. The object lands in the
  // host's own prefix, which the storage policy allows them to read straight
  // away, so the preview works before any Venture row exists to point at it.
  const pickImage = async (file?: File) => {
    if (!file || !user?.id) return;
    setUploading(true);
    try {
      const path = await uploadVentureImage(user.id, file);
      setImagePath(path);
      setImagePreview(await signVentureImageUrl(path));
    } catch (error) {
      toast.error("Could not upload that photo", { description: (error as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const toggleIntent = (intent: string) => {
    setIntents((cur) => {
      if (cur.includes(intent)) return cur.filter((item) => item !== intent);
      return cur.length >= 5 ? cur : [...cur, intent];
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || resolvedDurationMins === null) return;
    const timing = timingPayload(day, time, resolvedDurationMins);
    if (!("starts_at" in timing) || !timing.starts_at || !timing.ends_at) {
      toast.error("Choose a valid Venture date and time.");
      return;
    }

    if (editing) {
      update.mutate(
        {
          venture_id: editing.id,
          title: title.trim(),
          intents,
          // Omitted when locked so the database never sees an unchanged-but-sent
          // scope on a Venture people have already joined.
          ...(audienceLocked ? {} : { scope }),
          ...timing,
          venue,
          private_venue: arrivalDetails.trim() ? { arrival_details: arrivalDetails.trim() } : null,
          max_slots: maxSlots,
          note: note.trim(),
          image_url: imagePath,
        },
        {
          onSuccess: (venture) => {
            toast.success("Venture updated.");
            onCreated(venture);
          },
          onError: (err) => toast.error((err as Error).message),
        },
      );
      return;
    }

    create.mutate(
      {
        title: title.trim(),
        intents,
        scope,
        ...timing,
        venue,
        ...(arrivalDetails.trim()
          ? { private_venue: { arrival_details: arrivalDetails.trim() } }
          : {}),
        max_slots: maxSlots,
        note: note.trim(),
        image_url: imagePath,
      },
      {
        onSuccess: (venture) => {
          clearStoredHostDraft(user?.id);
          toast.success("Venture is live.");
          requestPushPrompt("venture");
          onCreated(venture);
          setTitle("");
          setIntents([]);
          setScope("all");
          setVenue(null);
          setArrivalDetails("");
          setDay(todayKey());
          setTime("19:00");
          setDurationMins(180);
          setMaxSlots(4);
          setNote("");
          setImagePath(null);
          setImagePreview(null);
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  };

  return (
    <form
      onSubmit={submit}
      className={cn(
        variant === "inline" && "mb-4 rounded-2xl border border-border bg-card p-4 animate-rise",
      )}
    >
      {draft && !isEditing && (
        <div className="mb-5 border-l-2 border-primary bg-primary/5 px-3 py-3">
          <p className="label-mono text-primary">From your Tribe Room</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            The idea and room size are carried over. Confirm the exact day, time, and public place
            before it goes live.
          </p>
        </div>
      )}
      <div className="grid gap-3">
        <FieldLabel label="Venture title">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value.slice(0, 80))}
            placeholder="Late coffee in Senopati"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </FieldLabel>

        {/* Everything else is a row that opens a sheet.

            The old form stacked eight labelled field groups down one scroll.
            You could not see what was still missing without scrolling to find
            out, and every decision competed with every other decision for the
            same attention. Four rows fit on one screen: the form becomes a
            summary you can read whole, and the complexity lives one layer down
            where it gets undivided attention.

            Amber keys are the two that must be filled. */}
        <div className="mt-1 flex flex-col">
          <FormRow
            label="Where"
            required
            value={venue?.host_label ?? "Pick a place"}
            empty={!venue}
            hint={
              venue
                ? arrivalDetails.trim()
                  ? "Accepted-member details ready"
                  : venue.area || "Unlisted place"
                : undefined
            }
            onClick={() => setSheet("where")}
          />
          <FormRow
            label="When"
            required
            value={`${dayChoiceLabel(day)}, ${time}`}
            hint={
              resolvedDurationMins
                ? endsAtLabel(day, time, resolvedDurationMins)
                : "Choose an end after the start"
            }
            onClick={() => setSheet("when")}
          />
          <FormRow
            label="Room"
            value={`${maxSlots} people`}
            hint={scope === "mine" ? "Your Tribes only" : "All Tribes"}
            onClick={() => setSheet("room")}
          />
          <FormRow
            label="Vibe"
            required
            value={intents.length ? intents.join(", ") : "Pick at least one"}
            empty={intents.length === 0}
            hint={intents.length ? `${intents.length}/5` : undefined}
            onClick={() => setSheet("vibe")}
          />
          <FormRow
            label="Details"
            value={note.trim() || "Photo and a note"}
            empty={!note.trim()}
            hint={imagePath ? "Photo added" : "Optional"}
            onClick={() => setSheet("details")}
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl border border-border bg-background py-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit || create.isPending || update.isPending}
          className={cn(
            "inline-flex flex-[1.4] items-center justify-center gap-2 rounded-2xl py-3 text-xs font-semibold text-white transition-[transform,filter] active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
            scope === "all" && "bg-meutuals-gradient hover:brightness-110",
          )}
          style={scope === "mine" ? { backgroundColor: primaryTribe.colorVar } : undefined}
        >
          {create.isPending || update.isPending ? (
            <SpinnerGapIcon className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRightIcon className="h-4 w-4" />
          )}
          {isEditing ? "Save changes" : "Go live"}
        </button>
      </div>

      {/* Portaled by AnimatedModal, so none of this sits inside the form in the
          DOM — no stray submits from a chip. */}
      <VentureSheet
        open={sheet === "where"}
        onClose={closeSheet}
        title="Where are we meeting?"
        gradient={scope === "all"}
        accentColor={scope === "mine" ? primaryTribe.colorVar : undefined}
      >
        <div className="space-y-5">
          <VenuePicker
            value={venue}
            onChange={setVenue}
            gradient={scope === "all"}
            accentColor={scope === "mine" ? primaryTribe.colorVar : undefined}
          />
          <section className="space-y-2 border-t border-border pt-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent-readable">
                <LockIcon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold">After acceptance</span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  Add the exact entrance, table, or meeting point. Only you and accepted members can
                  read it.
                </span>
              </span>
            </div>
            <label className="block">
              <span className="sr-only">Private arrival details</span>
              <textarea
                value={arrivalDetails}
                onChange={(event) => setArrivalDetails(event.target.value.slice(0, 280))}
                placeholder="Meet at the north entrance, then ask for Kila's table."
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </label>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Avoid private home addresses.</span>
              <span>{arrivalDetails.length}/280</span>
            </div>
          </section>
        </div>
      </VentureSheet>

      <VentureSheet
        open={sheet === "when"}
        onClose={closeSheet}
        title="When"
        gradient={scope === "all"}
        accentColor={scope === "mine" ? primaryTribe.colorVar : undefined}
      >
        <div className="grid gap-3">
          {draft && (draft.timeOptions?.length ?? 0) > 0 && (
            <FieldLabel label="From the Tribe plan">
              <div className="mt-1 grid gap-2 border-l-2 border-primary/50 pl-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Availability is a guide. Confirm one exact start before this Venture goes live.
                </p>
                <div className="flex flex-wrap gap-2">
                  {draft.timeOptions.map((option) => {
                    const optionTime = periodDefaultTime(option.period);
                    const active = day === option.day && time === optionTime;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setDay(option.day);
                          setTime(optionTime);
                        }}
                        className={cn(
                          "min-h-11 rounded-xl border px-3 py-2 text-left text-xs transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground",
                        )}
                      >
                        <span className="block font-semibold">{option.label}</span>
                        <span
                          className={cn("font-mono text-xs", !active && "text-muted-foreground")}
                        >
                          {option.votes} available · starts at {optionTime}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </FieldLabel>
          )}
          <FieldLabel label="Starts">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {dayChoices().map((choice) => (
                  <ChoiceButton
                    key={choice.value}
                    active={day === choice.value}
                    onClick={() => setDay(choice.value)}
                    title={choice.label}
                    compact
                  />
                ))}
                {/* Anything past the next few days needs a real date, and the
                    native picker is the one control every phone already knows. */}
                <input
                  type="date"
                  aria-label="Venture date"
                  value={day}
                  min={todayKey()}
                  onChange={(event) => event.target.value && setDay(event.target.value)}
                  className="min-h-11 rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
                />
              </div>
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {dayChoiceLabel(day)}
              </p>
              <div className="flex flex-wrap gap-2">
                {PLAN_PERIOD_CHOICES.map((choice) => (
                  <ChoiceButton
                    key={choice.value}
                    active={time === choice.defaultTime}
                    onClick={() => setTime(choice.defaultTime)}
                    title={choice.label}
                    body={choice.defaultTime}
                    compact
                  />
                ))}
                <input
                  type="time"
                  aria-label="Exact Venture start time"
                  value={time}
                  onChange={(event) => event.target.value && setTime(event.target.value)}
                  className="min-h-11 rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
                />
              </div>
            </div>
          </FieldLabel>
          <FieldLabel label="Runs for">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {DURATION_CHOICES.map((choice) => (
                  <ChoiceButton
                    key={choice.minutes}
                    active={durationMode === "preset" && durationMins === choice.minutes}
                    onClick={() => {
                      setDurationMode("preset");
                      setDurationMins(choice.minutes);
                    }}
                    title={choice.label}
                    compact
                  />
                ))}
                <ChoiceButton
                  active={durationMode === "custom"}
                  onClick={() => {
                    setDurationMode("custom");
                    setCustomEndTime(endTimeForDuration(day, time, durationMins));
                  }}
                  title="Custom end"
                  compact
                />
              </div>
              {durationMode === "custom" && (
                <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2">
                  <span className="text-xs font-semibold">Ends at</span>
                  <input
                    type="time"
                    value={customEndTime}
                    onChange={(event) => setCustomEndTime(event.target.value)}
                    className="min-h-11 bg-transparent font-mono text-xs outline-none"
                  />
                </label>
              )}
              {/* Show the computed end. A duration is easier to pick than a second
                  clock, but only if you can see what it resolved to — otherwise
                  "all evening" quietly becomes a Venture that ends at 3am. */}
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {resolvedDurationMins
                  ? endsAtLabel(day, time, resolvedDurationMins)
                  : "End must be after the start · earlier clocks mean next day"}
              </p>
            </div>
          </FieldLabel>
        </div>
      </VentureSheet>

      <VentureSheet
        open={sheet === "room"}
        onClose={closeSheet}
        title="Room"
        gradient={scope === "all"}
        accentColor={scope === "mine" ? primaryTribe.colorVar : undefined}
      >
        <div className="grid gap-3">
          <FieldLabel label="Slots">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2">
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
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
          <FieldLabel label="Audience">
            <div className={cn("grid grid-cols-2 gap-2", audienceLocked && "opacity-50")}>
              <ChoiceButton
                active={scope === "all"}
                onClick={() => !audienceLocked && setScope("all")}
                title="All Tribes"
                body="Members from any Tribe can apply."
                gradient
              />
              <ChoiceButton
                active={scope === "mine"}
                onClick={() => {
                  if (audienceLocked) return;
                  setScope("mine");
                  // Drop any picked Vibe tag that belongs to a group the
                  // narrower picker is about to hide, so a stale selection
                  // never rides along invisibly.
                  const stillVisible = new Set<string>(
                    INTEREST_OPTION_GROUPS.filter(
                      (group) => !("tribeId" in group) || profile.tribeIds.includes(group.tribeId),
                    ).flatMap((group) => group.items.map((option) => option.label)),
                  );
                  setIntents((cur) => cur.filter((intent) => stillVisible.has(intent)));
                }}
                title={myTribes.length > 1 ? "My Tribes" : "My Tribe"}
                body={myTribes.map((tribe) => tribe.name).join(", ") || "Your home base."}
                accentColor={primaryTribe.colorVar}
              />
            </div>
            {audienceLocked && (
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Locked — people have already applied. Narrowing the audience now would cut them out
                of a Venture they already joined.
              </p>
            )}
          </FieldLabel>
        </div>
      </VentureSheet>

      <VentureSheet
        open={sheet === "vibe"}
        onClose={closeSheet}
        title="Vibe"
        gradient={scope === "all"}
        accentColor={scope === "mine" ? primaryTribe.colorVar : undefined}
      >
        <div className="grid gap-3">
          <FieldLabel
            label={`Vibes · ${intents.length}/5`}
            hint={
              scope === "mine"
                ? `Curated for ${myTribes.map((tribe) => tribe.name).join(", ") || "your Tribe"}`
                : undefined
            }
          >
            {/* Scrolls rather than pushing the rest of the form off-screen. The
                chosen chips are pinned above the scroller so the host can always
                see what they've picked and why further taps stop working, which
                is otherwise invisible once the list has scrolled. */}
            {intents.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {intents.map((intent) => (
                  <button
                    key={intent}
                    type="button"
                    onClick={() => toggleIntent(intent)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white",
                      scope === "all" && "bg-meutuals-gradient",
                    )}
                    style={
                      scope === "mine" ? { backgroundColor: primaryTribe.colorVar } : undefined
                    }
                  >
                    <VentureVibeLabel value={intent} />
                    <XIcon className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
            {suggestedIntents.length > 0 && (
              <div className="mb-3 rounded-xl border border-primary/30 bg-primary/[0.06] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="label-mono text-primary">Suggested from your Vibes</p>
                  <span className="text-xs text-muted-foreground">Quick picks</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestedIntents.map((option) => {
                    const active = intents.includes(option.label);
                    const atLimit = !active && intents.length >= 5;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={atLimit}
                        onClick={() => toggleIntent(option.label)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                          active
                            ? "border-transparent bg-meutuals-gradient text-white"
                            : "border-primary/35 bg-background text-foreground",
                          atLimit && "opacity-35",
                        )}
                      >
                        <VentureVibeLabel value={option.label} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* No inner max-height any more. Inside a bounded sheet a second scroller
                  meant the last row of chips sat under the Done button with no way
                  to reach it — the sheet body scrolls, this just lists. */}
            <div className="space-y-3 rounded-xl border border-border bg-background/40 p-3">
              {visibleIntentGroups.map((group) => (
                <div key={group.label}>
                  <p className="label-mono mb-1.5 text-muted-foreground">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((option) => {
                      const intent = option.label;
                      const active = intents.includes(intent);
                      const atLimit = !active && intents.length >= 5;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={atLimit}
                          onClick={() => toggleIntent(intent)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                            active
                              ? cn(
                                  "text-white",
                                  scope === "all"
                                    ? "border-transparent bg-meutuals-gradient"
                                    : "border-transparent",
                                )
                              : "border-border bg-background text-foreground",
                            atLimit && "opacity-35",
                          )}
                          style={
                            active && scope === "mine"
                              ? { backgroundColor: primaryTribe.colorVar }
                              : undefined
                          }
                        >
                          <VentureVibeLabel value={intent} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </FieldLabel>
        </div>
      </VentureSheet>

      <VentureSheet
        open={sheet === "details"}
        onClose={closeSheet}
        title="Details"
        gradient={scope === "all"}
        accentColor={scope === "mine" ? primaryTribe.colorVar : undefined}
      >
        <div className="grid gap-3">
          <FieldLabel label="Host note">
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 280))}
              placeholder="Share the vibe and a public area — save exact details for accepted-member chat."
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <div className="mt-1 flex items-start justify-between gap-3 text-xs text-muted-foreground">
              <span>Don't post a home address, phone number, or exact private location.</span>
              <span className="shrink-0">{note.length}/280</span>
            </div>
          </FieldLabel>
          <FieldLabel label="Photo (optional)">
            <label
              className={cn(
                "relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background transition-colors hover:border-primary/50",
                uploading && "pointer-events-none opacity-60",
              )}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1.5 text-muted-foreground">
                  {uploading ? (
                    <SpinnerGapIcon className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImageIcon className="h-5 w-5" />
                  )}
                  <span className="text-xs font-semibold">
                    {uploading ? "Uploading…" : "Add a photo of the place"}
                  </span>
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void pickImage(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {imagePreview && (
              <button
                type="button"
                onClick={() => {
                  setImagePath(null);
                  setImagePreview(null);
                }}
                className="mt-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Remove photo
              </button>
            )}
          </FieldLabel>
        </div>
      </VentureSheet>
    </form>
  );
}

function HostedVentureCard({
  venture,
  profile,
  onOpenChat,
  onChanged,
}: {
  venture: VentureParty;
  profile: Profile;
  onOpenChat: () => void;
  onChanged: () => void;
}) {
  const decide = useDecideVentureApplication();
  const complete = useCompleteHostedVenture();
  const cancel = useCancelHostedVenture();
  const reopen = useReopenHostedVenture();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [endActionOpen, setEndActionOpen] = useState(false);
  const pending = venture.applications.filter((app) => app.status === "pending");
  const accepted = venture.applications.filter((app) => app.status === "accepted");
  const isClosed = venture.status === "closed";
  const acceptsRequests = ventureAcceptsRequests(venture);
  const canComplete = !venture.starts_at || Date.parse(venture.starts_at) <= Date.now();
  const canReopen =
    isClosed &&
    !!venture.cancelled_at &&
    (!venture.starts_at || Date.parse(venture.starts_at) > Date.now()) &&
    venture.filled_slots < venture.max_slots;
  const stateLabel = ventureStateLabel(venture);
  // The Edit Venture dialog holds a raw text input (Venture title) directly,
  // not just sheet triggers - same iOS keyboard-vs-viewport issue as
  // VentureSheet, needs the same fix.
  const editVisualViewport = useVisualViewport(editOpen && !isClosed);

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

  const completeVenture = () => {
    complete.mutate(venture.id, {
      onSuccess: () => {
        setEndActionOpen(false);
        toast.success("Venture completed and moved to Memories.");
        onChanged();
      },
      onError: (err) => toast.error((err as Error).message),
    });
  };

  const cancelVenture = () => {
    cancel.mutate(venture.id, {
      onSuccess: () => {
        setEndActionOpen(false);
        toast.success("Venture cancelled. Everyone in the party has been notified.");
        onChanged();
      },
      onError: (err) => toast.error((err as Error).message),
    });
  };

  return (
    <VentureCardShell
      path={venture.image_url}
      header={<VentureCardHeader venture={venture} hideHost />}
    >
      <VentureMeta venture={venture} hideHost />
      {stateLabel && (
        <p className="label-mono mt-3 inline-flex rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-primary">
          {stateLabel}
        </p>
      )}

      {/* Closing by mistake used to mean recreating the plan and losing its
          party chat. enforce_venture_host_edits permits closed -> open for
          exactly this. */}
      {canReopen && (
        <button
          type="button"
          onClick={() =>
            reopen.mutate(venture.id, {
              onSuccess: () => {
                toast.success("Venture returned to Active.");
                onChanged();
              },
              onError: (err) => toast.error((err as Error).message),
            })
          }
          disabled={reopen.isPending}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        >
          {reopen.isPending ? (
            <SpinnerGapIcon className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowCounterClockwiseIcon className="h-4 w-4" />
          )}
          Reopen
        </button>
      )}

      <div className={cn("mt-4 grid gap-2", isClosed ? "grid-cols-1" : "grid-cols-2")}>
        {acceptsRequests && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/60 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <PencilIcon className="h-4 w-4" /> Edit
          </button>
        )}
        <button
          type="button"
          onClick={onOpenChat}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/60 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChatCircleIcon className="h-4 w-4" /> Chat
        </button>
        {!isClosed && (
          <button
            type="button"
            onClick={() => setInviteOpen((open) => !open)}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-2xl border py-2.5 text-xs font-semibold transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              inviteOpen
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground",
            )}
          >
            <UserPlusIcon className="h-4 w-4" /> Invite
          </button>
        )}
        {!isClosed && (
          <button
            type="button"
            onClick={() => setEndActionOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            <XIcon className="h-4 w-4" /> End
          </button>
        )}
      </div>

      <AnimatedModal
        open={endActionOpen}
        onOpenChange={setEndActionOpen}
        title="End this Venture"
        contentClassName="max-w-sm"
      >
        <div className="p-5">
          <h2 className="font-display text-xl font-bold">What happened with this plan?</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Complete creates a Venture Memory. Cancel keeps the record visible without counting it
            as a completed meetup.
          </p>
          <div className="mt-5 grid gap-2">
            <button
              type="button"
              onClick={completeVenture}
              disabled={!canComplete || complete.isPending || cancel.isPending}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-meutuals-gradient px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {complete.isPending ? (
                <SpinnerGapIcon className="h-4 w-4 animate-spin" />
              ) : (
                <CheckIcon className="h-4 w-4" />
              )}
              {canComplete ? "It happened · Complete" : "Complete after it starts"}
            </button>
            <button
              type="button"
              onClick={cancelVenture}
              disabled={complete.isPending || cancel.isPending}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {cancel.isPending ? (
                <SpinnerGapIcon className="h-4 w-4 animate-spin" />
              ) : (
                <XIcon className="h-4 w-4" />
              )}
              It didn't happen · Cancel
            </button>
          </div>
        </div>
      </AnimatedModal>

      {inviteOpen && acceptsRequests && (
        <InviteConnectedUsersPanel venture={venture} onInvited={onChanged} />
      )}

      <div className="mt-4 space-y-3">
        <div>
          <p className="label-mono text-muted-foreground">Pending requests</p>
          {pending.length ? (
            <div className="mt-2 space-y-2">
              {!acceptsRequests && (
                <p className="rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
                  Requests closed when this Venture started. You can still decline outstanding
                  requests.
                </p>
              )}
              {pending.map((application) => (
                <ApplicantRow
                  key={application.id}
                  application={application}
                  busy={decide.isPending && decide.variables?.application_id === application.id}
                  onAccept={() => acceptsRequests && decideApp(application, "accepted")}
                  onDecline={() => decideApp(application, "declined")}
                  acceptDisabled={!acceptsRequests}
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
      {/* A dialog, not an inline expansion. The form is a full page of
          controls; unfolding it inside the card pushed everything below it —
          the actions, the applicant list, every other Venture — hundreds of
          pixels down, and the thing being edited scrolled out of view. A sheet
          keeps the card still and puts the form where the eye already is. */}
      <AnimatedModal
        open={editOpen && !isClosed}
        onOpenChange={setEditOpen}
        title={`Edit ${venture.title}`}
        contentClassName="scroll-panel max-h-[90dvh] overflow-y-auto"
        viewportStyle={visualViewportStyle(editVisualViewport)}
      >
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold leading-tight">Edit Venture</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Changes are visible to everyone who has already joined.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              aria-label="Close editor"
              className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
          <HostForm
            profile={profile}
            editing={venture}
            variant="modal"
            onCancel={() => setEditOpen(false)}
            onCreated={() => setEditOpen(false)}
          />
        </div>
      </AnimatedModal>
    </VentureCardShell>
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
            Pick someone from your Tribe, or someone you're Moots with.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-1 text-xs font-semibold text-muted-foreground">
          {venture.filled_slots}/{venture.max_slots}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <MagnifyingGlassIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search Tribe / Moots"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>

      {candidatesQuery.isLoading ? (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-xs text-muted-foreground">
          <SpinnerGapIcon className="h-3.5 w-3.5 animate-spin" /> Loading people
        </div>
      ) : candidatesQuery.isError ? (
        <button
          type="button"
          onClick={() => candidatesQuery.refetch()}
          className="mt-3 w-full rounded-xl border border-border bg-card py-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
            : "Join a Tribe, or become Moots with someone, to invite them here."}
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
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {candidate.handle ? `@${candidate.handle}` : candidate.city || "Connected"}
        </p>
      </div>
      <button
        type="button"
        onClick={onInvite}
        disabled={disabled}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors active:scale-95 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          disabled
            ? "border border-border text-muted-foreground"
            : "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        {busy ? (
          <SpinnerGapIcon className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <UserPlusIcon className="h-3.5 w-3.5" />
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
    relationship === "same_tribe_moot"
      ? "Tribe · Moot"
      : relationship === "moot"
        ? "Moot"
        : "Tribe";
  return (
    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {label}
    </span>
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
  const hostTribe = TRIBES.find((t) => host?.tribe_ids?.includes(t.id));
  return (
    <div className="flex items-start justify-between gap-3">
      {/* The host's face leads, not the Venture's photo.
          The photo is the card's background now, so repeating it here as a
          thumbnail said the same thing twice and pushed the one piece of
          genuinely different information — who is running this — into a
          secondary row. Deciding whether to join a stranger's plan is mostly a
          judgement about the person, so they get the anchor position. */}
      {!hideHost && <Avatar profile={host} size="md" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-display text-lg font-bold">{venture.title}</h3>
          <StatusPill status={venture.status} />
        </div>
        {!hideHost && (
          // Face, name and Tribe in one line, because they are one thing: who
          // is running this. The Tribe used to sit in a separate block further
          // down the card, where it read as a property of the plan rather than
          // of the person — and with one Tribe per member it is now part of how
          // someone introduces themselves.
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-xs font-semibold">{displayName(host)}</span>
            {hostTribe && <TribeBadge tribe={hostTribe} />}
            {host?.city && (
              <span className="truncate text-xs text-muted-foreground">{host.city}</span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-start gap-1">
        <div className="text-right">
          <p className="text-sm font-bold">
            {venture.filled_slots}/{venture.max_slots}
          </p>
          <p className="text-xs text-muted-foreground">slots</p>
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

function VentureMeta({ venture, hideHost = false }: { venture: VentureParty; hideHost?: boolean }) {
  const hostTribes = venture.host?.tribe_ids?.filter(Boolean) as TribeId[] | undefined;
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {venture.intents.slice(0, 5).map((intent) => (
          <span
            key={intent}
            className="label-mono inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2 py-1 text-accent-readable"
          >
            <VentureVibeLabel value={intent} iconClassName="h-3 w-3" />
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {timingLabel(venture) && (
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="h-3.5 w-3.5" /> {timingLabel(venture)}
          </span>
        )}
        <span>{venture.scope === "mine" ? "Host tribes only" : "All tribes"}</span>
      </div>
      {/* Only when the header did not already carry it — on a hosted card the
          header hides the host, so the Tribe belongs here instead. */}
      {hideHost && hostTribes?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {hostTribes.map((tribeId) => {
            const tribe = TRIBES.find((item) => item.id === tribeId);
            if (!tribe) return null;
            return <TribeBadge key={tribe.id} tribe={tribe} />;
          })}
        </div>
      ) : null}
    </div>
  );
}

function ApplicantRow({
  application,
  busy,
  acceptDisabled = false,
  onAccept,
  onDecline,
}: {
  application: VentureApplication;
  busy: boolean;
  acceptDisabled?: boolean;
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
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        >
          <UserMinusIcon className="h-3.5 w-3.5" /> Decline
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={busy || acceptDisabled}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        >
          {busy ? (
            <SpinnerGapIcon className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckIcon className="h-3.5 w-3.5" />
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
        ? "border-accent/40 bg-accent/10 text-accent-readable"
        : "border-border bg-secondary text-muted-foreground";
  return <span className={cn("label-mono rounded-full border px-2 py-1", color)}>{label}</span>;
}

function FieldLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="label-mono text-muted-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * A decision, collapsed to one line.
 *
 * The row shows what is chosen, not what could be. That is the whole point of
 * the restructure: the form reads as a summary of the Venture you are about to
 * publish, rather than as a pile of controls you have to operate to find out.
 */
function FormRow({
  label,
  value,
  hint,
  onClick,
  required = false,
  empty = false,
}: {
  label: string;
  value: string;
  hint?: string;
  onClick: () => void;
  /** Amber key — this one has to be filled before Go live works. */
  required?: boolean;
  /** Nothing chosen yet, so the value is a prompt rather than an answer. */
  empty?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid grid-cols-[4rem_1fr_auto] items-center gap-3 border-b border-border/60 py-3.5 text-left transition-colors active:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    >
      <span className={cn("label-mono", required ? "text-primary" : "text-muted-foreground")}>
        {label}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate text-sm",
            empty ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {value}
        </span>
        {hint && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{hint}</span>
        )}
      </span>
      <CaretRightIcon className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

/**
 * A sheet holding exactly one decision.
 *
 * AnimatedModal renders its `title` visually hidden — it is the accessible
 * name, not a heading. Without one drawn here the sheets opened with no title
 * at all and the first field's little mono label had to stand in as the
 * heading, which is why they read as a floating fragment rather than as a
 * screen you had opened.
 *
 * The body scrolls and Done is pinned. The Vibe sheet has its own scroller for
 * the intent list; without a bounded sheet the two fought and the last row of
 * chips ended up underneath the button.
 */
function VentureSheet({
  open,
  onClose,
  title,
  children,
  gradient,
  accentColor,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Same gradient (all Tribes) vs. Tribe-color (Tribe-only) rule as the
   *  rest of the Venture create/edit form - every sheet's Done button
   *  otherwise stayed the one plain-primary holdout. */
  gradient?: boolean;
  accentColor?: string;
}) {
  // iOS Safari/WebView resizes the layout viewport under a bottom sheet
  // inconsistently once the software keyboard opens - without tracking the
  // actual visual viewport, the sheet (and its pinned Done button) can end
  // up positioned behind the keyboard instead of above it. Same fix already
  // used by ComposerModal/CommentsModal, just not yet wired into this sheet.
  const visualViewport = useVisualViewport(open);

  return (
    <AnimatedModal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={title}
      contentClassName="flex max-h-[86dvh] flex-col"
      viewportStyle={visualViewportStyle(visualViewport)}
    >
      <div className="flex shrink-0 flex-col gap-3 px-5 pt-3">
        <span className="mx-auto h-1 w-9 rounded-full bg-secondary" aria-hidden />
        <h2 className="text-base font-extrabold tracking-tight">{title}</h2>
      </div>

      <div className="scroll-panel min-h-0 flex-1 overflow-y-auto px-5 pb-1 pt-3">{children}</div>

      <div className="shrink-0 border-t border-border/60 p-4">
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "w-full rounded-2xl py-3 text-xs font-semibold transition-[transform,filter] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            gradient || accentColor
              ? "text-white"
              : "bg-primary text-primary-foreground transition-colors hover:bg-primary/90",
            gradient && "bg-meutuals-gradient hover:brightness-110",
          )}
          style={!gradient && accentColor ? { backgroundColor: accentColor } : undefined}
        >
          Done
        </button>
      </div>
    </AnimatedModal>
  );
}

function ChoiceButton({
  active,
  onClick,
  title,
  body,
  compact,
  gradient,
  accentColor,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body?: string;
  compact?: boolean;
  /** Selected state fills solid with the brand gradient instead of the
   *  default tinted-outline look - reserved for the "All Tribes" side of the
   *  Audience choice, mirroring the same rule used on the Vibe chips and the
   *  browse-scope toggle. Everything else (day/time/duration chips) stays
   *  the plain default so this doesn't read as audience-related everywhere. */
  gradient?: boolean;
  /** Selected state fills solid with this Tribe's color instead - the
   *  "My Tribe(s)" side of the same Audience choice. */
  accentColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-xl border text-left transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        compact ? "px-3 py-2.5" : "p-3",
        active
          ? accentColor
            ? "border-transparent text-white"
            : gradient
              ? "border-transparent bg-meutuals-gradient text-white"
              : "border-primary bg-primary/10"
          : "border-border bg-background",
      )}
      style={active && accentColor ? { backgroundColor: accentColor } : undefined}
    >
      <p
        className={cn("text-xs font-semibold", active && (accentColor || gradient) && "text-white")}
      >
        {title}
      </p>
      {body && (
        <p
          className={cn(
            "mt-0.5 line-clamp-2 text-xs",
            active && (accentColor || gradient) ? "text-white/80" : "text-muted-foreground",
          )}
        >
          {body}
        </p>
      )}
    </button>
  );
}

function RetryBlock({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {label}{" "}
      <button
        type="button"
        onClick={onRetry}
        className="rounded font-semibold text-foreground underline transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
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
  gradient = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  /** The brand gradient is a scope signal reserved for hosting a Venture -
   *  the app's other CTAs (browse, close, back) stay on the plain primary
   *  fill so the one action that actually starts something new stands out. */
  gradient?: boolean;
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
        className={cn(
          "mt-4 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold transition-[transform,filter] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          gradient
            ? "bg-meutuals-gradient text-white hover:brightness-110"
            : "bg-primary text-primary-foreground transition-colors hover:bg-primary/90",
        )}
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
