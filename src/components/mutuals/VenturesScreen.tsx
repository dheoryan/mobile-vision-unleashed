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
  ImagePlus,
  Pencil,
  RotateCcw,
  ChevronRight,
  Ticket,
  LocateFixed,
} from "lucide-react";
import { toast } from "sonner";
import { INTENT_GROUPS, TRIBES, type Person, type TribeId } from "@/lib/mutuals-data";
import { AppHeader, SectionTitle, TribeBadge } from "./Shared";
import { PlusBadge } from "./PlusBadge";
import { SafetyMenu } from "./SafetyMenu";
import { UpsellModal } from "./UpsellModal";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { FeatureIllustration } from "./FeatureIllustration";
import venturesArt from "@/assets/app-illustrations/ventures.webp";
import { VentureSwipeDeck } from "./VentureSwipeDeck";
import { VentureCardShell } from "./VentureImage";
import { VentureSearching } from "./VentureSearching";
import { ChevronLeft, Layers, List } from "lucide-react";
import { readStoredVentureMode, saveStoredVentureMode } from "@/lib/ventures-mode";
import { useBlocked } from "@/lib/blocked-store";
import { requestPushPrompt } from "@/lib/push-prompt-events";
import { uploadVentureImage, signVentureImageUrl } from "@/lib/uploads";
import { useAuth } from "@/lib/auth-context";
import {
  useApplyToVenture,
  useWithdrawVentureApplication,
  useReopenHostedVenture,
  useCloseHostedVenture,
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
  endsAtLabel,
  initialDay,
  initialTime,
  timingLabel,
  dayChoiceLabel,
  timingPayload,
  todayKey,
} from "@/lib/venture-time";
import { VentureBoard } from "./VentureBoard";
import { VentureTicket, VentureTicketDetail } from "./VentureTicket";
import { VenuePicker, type PickedVenue } from "./VenuePicker";
import { useMyLocationSettings, useSaveMyLocation } from "@/lib/location-store";
import { requestBrowserLocation } from "@/lib/location";

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

type Mode = "look" | "yours" | "host";
type VentureStage = "intro" | "role" | "feature";

// Kept "This week evenings" and "This weekend" verbatim so Ventures created
// before this list grew still match a chip when their host opens the editor.
// Free text in the database, so this can grow again without a migration.

export function VenturesScreen({
  profile,
  setProfile,
  onOpenVentureChat,
  onSendHello: _onSendHello,
  onLaunchVenture,
}: {
  profile: Profile;
  setProfile?: (updater: (p: Profile | null) => Profile | null) => void;
  onOpenVentureChat: (venture: VentureParty) => void;
  onSendHello?: (person: Person, message: string) => void;
  onLaunchVenture?: () => void;
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
    persistMode(readStoredVentureMode());
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
    saveStoredVentureMode(nextMode);
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
    // Land on your Ventures, not on a blank form. listMyHostedVentures filters
    // only on user_id — every Venture you have ever hosted is in there, closed
    // ones included — so this surface is the history and the edit path. Opening
    // the form on arrival hid all of it behind a field you had not asked for.
    setHostFormOpen(false);
  };

  const handleCreated = (venture: VentureParty) => {
    onLaunchVenture?.();
    setHostFormOpen(false);
    onOpenVentureChat(venture);
  };

  return (
    <div className="bg-habitat min-h-screen pb-32">
      <AppHeader
        title={
          stage !== "feature"
            ? "Ventures"
            : mode === "look"
              ? "Venture board"
              : mode === "yours"
                ? "My tickets"
                : "Hosting"
        }
        subtitle={
          stage === "intro"
            ? "Optional"
            : stage === "role"
              ? "Choose mode"
              : mode === "look"
                ? "Find one plan"
                : mode === "yours"
                  ? "Plans in motion"
                  : "Plans you run"
        }
        accent="var(--color-primary)"
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
            {/* Ventures is a focused surface, not a three-column dashboard.
                Discovery owns the main screen. Tickets are one contextual
                destination and Hosting is reached through the creation action.
                On either secondary screen the only navigation choice is Back. */}
            <div
              className={cn(
                "flex min-h-14 items-center pt-2",
                mode === "look" ? "justify-end" : "justify-start",
              )}
            >
              {mode === "look" ? (
                <button
                  type="button"
                  onClick={() => switchMode("yours")}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <Ticket className="h-3.5 w-3.5 text-primary" />
                  My tickets
                  {joinedVentures.length > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 font-mono text-[9px] font-bold text-primary-foreground">
                      {joinedVentures.length}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => switchMode("look")}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to Venture board
                </button>
              )}
            </div>

            {mode === "yours" ? (
              <YoursView
                joinedVentures={joinedVentures}
                isLoading={joinedQuery.isLoading}
                onOpenChat={onOpenVentureChat}
                onBrowse={() => switchMode("look")}
                onChanged={() => {
                  openQuery.refetch();
                  joinedQuery.refetch();
                }}
              />
            ) : mode === "look" ? (
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

      <UpsellModal open={paywall} onClose={() => setPaywall(false)} used={profile.ventureCount} />
      {/* Same shape and anchoring as the Timeline composer: wrapped in a
          fixed max-w-md column rather than pinned with right-5, so it tracks
          the content instead of the viewport edge — on a wide window right-5
          throws it far off to the side of a max-w-md layout.

          pointer-events-none on the wrapper so the invisible full-width strip
          does not eat taps meant for the card underneath. */}
      {stage === "feature" && mode !== "host" && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 mx-auto flex max-w-md justify-end px-5">
          <button
            type="button"
            onClick={startHosting}
            aria-label="Host a Venture"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground shadow-xl shadow-black/30 transition-transform active:scale-95"
          >
            <Plus className="h-4 w-4" /> Host
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Yours — the Ventures you are holding.
 *
 * Invites first, because they are the only ones that need an answer. Then the
 * ones you are in, then the ones you are waiting on. That order is by urgency,
 * not by status alphabetically.
 *
 * These used to live in two places that both hid them: accepted Ventures were
 * only reachable through Chats, where they read as conversations rather than
 * as plans with a time; invites and pending requests sat behind a small pill in
 * the board header. An invite that needs answering should not be a pill.
 */
function YoursView({
  joinedVentures,
  isLoading,
  onOpenChat,
  onBrowse,
  onChanged,
}: {
  joinedVentures: VentureParty[];
  isLoading: boolean;
  onOpenChat: (venture: VentureParty) => void;
  onBrowse: () => void;
  onChanged: () => void;
}) {
  // The store hook already invalidates the venture queries on success, so this
  // only adds the toast and the caller's refetch.
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

  // Which ticket is turned over. Held here rather than per-ticket so only one
  // back is ever showing.
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = joinedVentures.find((v) => v.id === detailId) ?? null;

  const byStatus = (status: string) =>
    joinedVentures.filter((v) => (v.my_application?.status as string) === status);

  const groups = [
    { key: "invited", label: "Needs an answer", ventures: byStatus("invited") },
    { key: "accepted", label: "You're going", ventures: byStatus("accepted") },
    { key: "pending", label: "Waiting on a host", ventures: byStatus("pending") },
  ].filter((g) => g.ventures.length > 0);

  if (isLoading) return <LoadingBlock label="Loading your Ventures" />;

  if (!groups.length) {
    return (
      <div className="mt-5">
        <EmptyPanel
          icon={<Ticket className="h-6 w-6" />}
          title="Nothing in your pocket yet."
          body="Apply to a Venture on the board and it lands here once the host says yes."
          actionLabel="Browse the board"
          onAction={onBrowse}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-6 pb-4">
      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="label-mono text-primary">{group.label}</span>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>
          {group.ventures.map((venture) => (
            <VentureTicket
              key={venture.id}
              venture={venture}
              onOpenChat={() => onOpenChat(venture)}
              onOpenDetail={() => setDetailId(venture.id)}
              onLeave={withdrawRequest}
              busy={
                (withdraw.isPending && withdraw.variables === venture.my_application?.id) ||
                (respond.isPending &&
                  respond.variables?.applicationId === venture.my_application?.id)
              }
              onAcceptInvite={() =>
                venture.my_application?.id &&
                respond.mutate({ applicationId: venture.my_application.id, status: "accepted" })
              }
              onDeclineInvite={() =>
                venture.my_application?.id &&
                respond.mutate({ applicationId: venture.my_application.id, status: "declined" })
              }
            />
          ))}
        </section>
      ))}

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
          <li>
            Tell someone you trust where you are going. Leave and report anything that feels wrong.
          </li>
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
  // The board by default. It was the deck, back when the alternative was a
  // stack of eight identical cards and one-at-a-time genuinely read better.
  // Grouped by day and led by the clock, the board now answers "what is on
  // tonight" in a glance, which is the question people actually open this tab
  // with. The deck stays for browsing one plan at a time.
  const [boardView, setBoardView] = useState<"deck" | "list">("list");
  const mineLabel = profile.tribeIds.length > 1 ? "My Tribes" : "My Tribe";

  const activeParties = useMemo(
    () =>
      joinedVentures.filter((venture) => (venture.my_application?.status as string) === "accepted"),
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

      {!locationQuery.isLoading && !locationQuery.data && (
        <button
          type="button"
          onClick={enableVenueDistance}
          disabled={locating || saveLocation.isPending}
          className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-left disabled:opacity-50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold">See how far each Venture is</span>
            <span className="block text-[11px] leading-snug text-muted-foreground">
              Uses your approximate area privately. It does not make you discoverable.
            </span>
          </span>
        </button>
      )}

      {/* The three inbox sections that used to sit here — Invites, Your Active
          Ventures, Pending Requests — are gone from the board.

          They were conditionally rendered, so the screen had a different
          skeleton on every visit depending on how many you happened to have,
          and they pushed the deck 446px down a ~780px viewport. Discovery
          started below the fold on the screen whose entire job is discovery.

          Where they went:
            accepted -> Chats. An accepted Venture is a conversation.
            invited  -> the pill in the Open Ventures header, below. Accept and
                        decline must stay reachable, so they moved rather than
                        disappearing.
            pending  -> the same pill. Nothing to act on but withdraw.

          The header is always rendered, so the pill appearing or vanishing
          inside it does not move anything else. That is the point. */}

      <SectionTitle
        title="Open Ventures"
        hint={isLoading ? "Loading parties" : `${joinableVentures.length} joinable`}
        action={
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-full bg-card p-1 text-muted-foreground">
              <button
                onClick={() => setBoardView("deck")}
                aria-label="One at a time"
                aria-pressed={boardView === "deck"}
                className={cn(
                  "rounded-full p-1.5",
                  boardView === "deck" && "bg-primary text-primary-foreground",
                )}
              >
                <Layers className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setBoardView("list")}
                aria-label="List"
                aria-pressed={boardView === "list"}
                className={cn(
                  "rounded-full p-1.5",
                  boardView === "list" && "bg-primary text-primary-foreground",
                )}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        }
      />

      {isLoading ? (
        <VentureSearching />
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
          /* The board. Rows grouped by day, led by the clock — see
             VentureBoard for why this stopped being a stack of cards. */
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
        )
      ) : (
        <EmptyPanel
          icon={<Search className="h-6 w-6" />}
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
        title="Your Ventures"
        hint={
          isLoading
            ? "Loading"
            : `${hostedVentures.filter((v) => v.status !== "closed").length} live · ${hostedVentures.length} all time`
        }
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
              profile={profile}
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

/**
 * Create a Venture, or edit an open one.
 *
 * One component for both because the fields are identical and a second,
 * near-duplicate form is how the two drift apart — a new field gets added to
 * create and quietly missing from edit. `editing` switches the mutation, the
 * copy and the reset behaviour; everything else is shared.
 */
function HostForm({
  profile,
  onCancel,
  onCreated,
  editing,
  variant = "inline",
}: {
  profile: Profile;
  onCancel: () => void;
  onCreated: (venture: VentureParty) => void;
  /** When present the form saves changes to this Venture instead of creating one. */
  editing?: VentureParty;
  /** "modal" drops the card chrome, because the dialog already provides it. */
  variant?: "inline" | "modal";
}) {
  const create = useCreateHostedVenture();
  const update = useUpdateHostedVenture();
  const isEditing = Boolean(editing);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [intents, setIntents] = useState<string[]>(editing?.intents ?? []);
  const [scope, setScope] = useState<VentureScope>(editing?.scope ?? "all");
  // Timing is three pieces of local state that resolve to two timestamps on
  // submit. `day` and `time` are kept apart because they are picked apart —
  // a chip row and a clock — and joining them earlier would mean re-splitting
  // an ISO string every render.
  const [day, setDay] = useState<string>(() => initialDay(editing));
  const [time, setTime] = useState<string>(() => initialTime(editing));
  const [durationMins, setDurationMins] = useState<number>(
    () => durationMinutes(editing ?? {}) ?? 180,
  );
  const [maxSlots, setMaxSlots] = useState(editing?.max_slots ?? 4);
  const [note, setNote] = useState(editing?.note ?? "");
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
      : null,
  );
  const [arrivalDetails, setArrivalDetails] = useState(
    editing?.private_venue?.arrival_details ?? "",
  );
  const [imagePath, setImagePath] = useState<string | null>(editing?.image_url ?? null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  /** Which decision is open. One at a time, by construction. */
  const [sheet, setSheet] = useState<"where" | "when" | "room" | "vibe" | "details" | null>(null);
  const closeSheet = () => setSheet(null);
  const { user } = useAuth();

  // Resolve a preview for a photo that already exists on the Venture.
  useEffect(() => {
    if (!editing?.image_url) return;
    let cancelled = false;
    void signVentureImageUrl(editing.image_url).then((url) => {
      if (!cancelled) setImagePreview(url);
    });
    return () => {
      cancelled = true;
    };
  }, [editing?.image_url]);

  // Audience is locked in the database once anyone has applied, because
  // flipping 'all' -> 'mine' would retroactively revoke access for people from
  // other Tribes who already joined. Reflect that here rather than letting the
  // host try and get an error back.
  const audienceLocked = isEditing && (editing!.applications?.length ?? 0) > 0;
  const occupancy = editing ? editing.filled_slots : 1;

  const myTribes = TRIBES.filter((tribe) => profile.tribeIds.includes(tribe.id));
  const canSubmit =
    title.trim().length >= 3 &&
    intents.length > 0 &&
    maxSlots >= 2 &&
    maxSlots <= 20 &&
    // Cannot shrink below the people already in the room. The database refuses
    // this too; saying so here avoids a pointless round trip.
    maxSlots >= occupancy &&
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
    if (!canSubmit) return;

    if (editing) {
      update.mutate(
        {
          venture_id: editing.id,
          title: title.trim(),
          intents,
          // Omitted when locked so the database never sees an unchanged-but-sent
          // scope on a Venture people have already joined.
          ...(audienceLocked ? {} : { scope }),
          ...timingPayload(day, time, durationMins),
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
        ...timingPayload(day, time, durationMins),
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
            hint={endsAtLabel(day, time, durationMins)}
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
          className="flex-1 rounded-2xl border border-border bg-background py-3 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit || create.isPending || update.isPending}
          className="inline-flex flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {create.isPending || update.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {isEditing ? "Save changes" : "Go live"}
        </button>
      </div>

      {/* Portaled by AnimatedModal, so none of this sits inside the form in the
          DOM — no stray submits from a chip. */}
      <VentureSheet open={sheet === "where"} onClose={closeSheet} title="Where are we meeting?">
        <div className="space-y-5">
          <VenuePicker value={venue} onChange={setVenue} />
          <section className="space-y-2 border-t border-border pt-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Lock className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold">After acceptance</span>
                <span className="block text-[11px] leading-relaxed text-muted-foreground">
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
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Avoid private home addresses.</span>
              <span>{arrivalDetails.length}/280</span>
            </div>
          </section>
        </div>
      </VentureSheet>

      <VentureSheet open={sheet === "when"} onClose={closeSheet} title="When">
        <div className="grid gap-3">
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
                  value={day}
                  min={todayKey()}
                  onChange={(event) => event.target.value && setDay(event.target.value)}
                  className="rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
                />
                <input
                  type="time"
                  value={time}
                  onChange={(event) => event.target.value && setTime(event.target.value)}
                  className="rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
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
                    active={durationMins === choice.minutes}
                    onClick={() => setDurationMins(choice.minutes)}
                    title={choice.label}
                    compact
                  />
                ))}
              </div>
              {/* Show the computed end. A duration is easier to pick than a second
                  clock, but only if you can see what it resolved to — otherwise
                  "all evening" quietly becomes a Venture that ends at 3am. */}
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {endsAtLabel(day, time, durationMins)}
              </p>
            </div>
          </FieldLabel>
        </div>
      </VentureSheet>

      <VentureSheet open={sheet === "room"} onClose={closeSheet} title="Room">
        <div className="grid gap-3">
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
          <FieldLabel label="Audience">
            <div className={cn("grid grid-cols-2 gap-2", audienceLocked && "opacity-50")}>
              <ChoiceButton
                active={scope === "all"}
                onClick={() => !audienceLocked && setScope("all")}
                title="All Tribes"
                body="Anyone nearby can apply."
              />
              <ChoiceButton
                active={scope === "mine"}
                onClick={() => !audienceLocked && setScope("mine")}
                title={myTribes.length > 1 ? "My Tribes" : "My Tribe"}
                body={myTribes.map((tribe) => tribe.name).join(", ") || "Your home base."}
              />
            </div>
            {audienceLocked && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                Locked — people have already applied. Narrowing the audience now would cut them out
                of a Venture they already joined.
              </p>
            )}
          </FieldLabel>
        </div>
      </VentureSheet>

      <VentureSheet open={sheet === "vibe"} onClose={closeSheet} title="Vibe">
        <div className="grid gap-3">
          <FieldLabel label={`Intents · ${intents.length}/5`}>
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
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                  >
                    {intent}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
            {/* No inner max-height any more. Inside a bounded sheet a second scroller
                  meant the last row of chips sat under the Done button with no way
                  to reach it — the sheet body scrolls, this just lists. */}
            <div className="space-y-3 rounded-xl border border-border bg-background/40 p-3">
              {INTENT_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="label-mono mb-1.5 text-muted-foreground">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((intent) => {
                      const active = intents.includes(intent);
                      const atLimit = !active && intents.length >= 5;
                      return (
                        <button
                          key={intent}
                          type="button"
                          disabled={atLimit}
                          onClick={() => toggleIntent(intent)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-foreground",
                            atLimit && "opacity-35",
                          )}
                        >
                          {intent}
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

      <VentureSheet open={sheet === "details"} onClose={closeSheet} title="Details">
        <div className="grid gap-3">
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
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                  <span className="text-[11px] font-semibold">
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
                className="mt-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
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
  onInvited,
}: {
  venture: VentureParty;
  profile: Profile;
  onOpenChat: () => void;
  onInvited: () => void;
}) {
  const decide = useDecideVentureApplication();
  const close = useCloseHostedVenture();
  const reopen = useReopenHostedVenture();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
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
    <VentureCardShell
      path={venture.image_url}
      header={<VentureCardHeader venture={venture} hideHost />}
    >
      <VentureMeta venture={venture} hideHost />

      {/* Closing by mistake used to mean recreating the plan and losing its
          party chat. enforce_venture_host_edits permits closed -> open for
          exactly this. */}
      {isClosed && (
        <button
          type="button"
          onClick={() =>
            reopen.mutate(venture.id, {
              onSuccess: () => toast.success("Venture reopened."),
              onError: (err) => toast.error((err as Error).message),
            })
          }
          disabled={reopen.isPending}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 py-2.5 text-xs font-semibold text-primary disabled:opacity-50"
        >
          {reopen.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Reopen
        </button>
      )}

      <div className={cn("mt-4 grid gap-2", isClosed ? "grid-cols-1" : "grid-cols-2")}>
        {!isClosed && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background py-2.5 text-xs font-semibold text-foreground"
          >
            <Pencil className="h-4 w-4" /> Edit
          </button>
        )}
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
              className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
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
              <span className="truncate text-[11px] text-muted-foreground">{host.city}</span>
            )}
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

function VentureMeta({ venture, hideHost = false }: { venture: VentureParty; hideHost?: boolean }) {
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
        {timingLabel(venture) && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {timingLabel(venture)}
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
      className="grid grid-cols-[4rem_1fr_auto] items-center gap-3 border-b border-border/60 py-3.5 text-left transition-colors active:bg-secondary/40"
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
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{hint}</span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatedModal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={title}
      contentClassName="flex max-h-[86dvh] flex-col"
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
          className="w-full rounded-2xl bg-primary py-3 text-xs font-semibold text-primary-foreground"
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
