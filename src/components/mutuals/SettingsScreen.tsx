import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { BellIcon } from "@phosphor-icons/react/dist/csr/Bell";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { BookOpenTextIcon } from "@phosphor-icons/react/dist/csr/BookOpenText";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { CrosshairIcon } from "@phosphor-icons/react/dist/csr/Crosshair";
import { DeviceMobileIcon } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { EnvelopeIcon } from "@phosphor-icons/react/dist/csr/Envelope";
import { KeyIcon } from "@phosphor-icons/react/dist/csr/Key";
import { LifebuoyIcon } from "@phosphor-icons/react/dist/csr/Lifebuoy";
import { MapPinIcon } from "@phosphor-icons/react/dist/csr/MapPin";
import { MapPinLineIcon } from "@phosphor-icons/react/dist/csr/MapPinLine";
import { ProhibitIcon } from "@phosphor-icons/react/dist/csr/Prohibit";
import { ScalesIcon } from "@phosphor-icons/react/dist/csr/Scales";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { SignOutIcon } from "@phosphor-icons/react/dist/csr/SignOut";
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { UserIcon } from "@phosphor-icons/react/dist/csr/User";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import { toast } from "sonner";
import safetyArt from "@/assets/app-illustrations/safety-privacy.webp";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-context";
import { useBlockedProfiles, useUnblockUser } from "@/lib/blocked-store";
import { requestBrowserLocation, type LocationRadiusKm } from "@/lib/location";
import {
  useDeleteMyLocation,
  useMyLocationSettings,
  useSaveMyLocation,
  useUpdateMyLocationSettings,
} from "@/lib/location-store";
import { profileToPatch, rowToProfile, useProfileRow, useUpdateProfile } from "@/lib/profile-store";
import { useMySavedPosts } from "@/lib/posts-store";
import { cn } from "@/lib/utils";
import { AddTribeSheet } from "./AddTribeSheet";
import { DeleteAccountModal } from "./DeleteAccountModal";
import { DiscoveryRadiusSlider } from "./DiscoveryRadiusSlider";
import { FeatureIllustration } from "./FeatureIllustration";
import { PushSettingsRow } from "./EnablePushBanner";
import { PushCategorySettings } from "./PushCategorySettings";
import { PwaInstallRow } from "./PwaInstallRow";
import { EditProfileModal } from "./ProfileScreen";
import { ProfilePostHistory } from "./ProfilePostHistory";
import { AppBootstrapSkeleton, FeedSkeleton, FlatUserListSkeleton, Skeleton } from "./Skeleton";
import { TribeMark } from "./TribeMark";
import { tribeById } from "@/lib/mutuals-data";

export type SettingsView =
  | "main"
  | "account"
  | "notifications"
  | "nearby"
  | "installation"
  | "safety"
  | "blocked"
  | "savedPosts";

const VIEW_TITLES: Record<SettingsView, string> = {
  main: "Settings",
  account: "Account",
  notifications: "Notifications",
  nearby: "Nearby discovery",
  installation: "Install MEUTUALS",
  safety: "Privacy & safety",
  blocked: "Blocked accounts",
  savedPosts: "Saved posts",
};

export function SettingsScreen({
  view,
  onViewChange,
}: {
  view: SettingsView;
  onViewChange: (view: SettingsView) => void;
}) {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const profileQuery = useProfileRow();
  const updateProfile = useUpdateProfile();
  const profile = rowToProfile(profileQuery.data ?? null);
  const [editOpen, setEditOpen] = useState(false);
  const [tribeOpen, setTribeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) void navigate({ to: "/login" });
  }, [authLoading, navigate, user]);

  if (authLoading || (user && profileQuery.isLoading)) return <AppBootstrapSkeleton />;
  if (!user || !profile) return null;

  const goBack = () => {
    // Internal panel switches (account/notifications/etc back to "main")
    // stay on this same mounted route via a search param, so they don't
    // get a push/pop animation - only true entrance/exit into Settings
    // does. Mirror the slide-in on mount with a slide-out here: play it,
    // then let the browser actually navigate once it's done.
    if (view !== "main") {
      window.history.back();
      return;
    }
    setClosing(true);
    window.setTimeout(() => window.history.back(), 200);
  };

  return (
    <div
      className={cn(
        "min-h-dvh bg-habitat text-foreground motion-safe:duration-200 motion-safe:ease-out motion-reduce:animate-none",
        closing
          ? "motion-safe:animate-out motion-safe:slide-out-to-right"
          : "motion-safe:animate-in motion-safe:slide-in-from-right",
      )}
    >
      <header className="glass sticky top-0 z-30 border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="mx-auto grid min-h-14 max-w-md grid-cols-[3rem_1fr_3rem] items-center px-2">
          <button
            type="button"
            onClick={goBack}
            aria-label={view === "main" ? "Back to profile" : "Back to settings"}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 text-center">
            <p className="label-mono text-primary">MEUTUALS</p>
            <h1 className="truncate font-display text-base font-bold">{VIEW_TITLES[view]}</h1>
          </div>
          <span aria-hidden />
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5">
        {view === "main" && (
          <SettingsHome
            email={user.email ?? "Signed-in account"}
            profileName={profile.name}
            onOpen={onViewChange}
            onLogout={() => {
              void signOut().then(() => navigate({ to: "/login" }));
            }}
            onDelete={() => setDeleteOpen(true)}
          />
        )}
        {view === "account" && (
          <AccountSettings
            email={user.email ?? "Signed-in account"}
            profile={profile}
            onEdit={() => setEditOpen(true)}
            onManageTribe={() => setTribeOpen(true)}
          />
        )}
        {view === "notifications" && <NotificationsSettings />}
        {view === "nearby" && <NearbySettings />}
        {view === "installation" && <InstallationSettings />}
        {view === "safety" && <SafetySettings onBlocked={() => onViewChange("blocked")} />}
        {view === "blocked" && <BlockedSettings />}
        {view === "savedPosts" && <SavedPostsSettings />}
      </main>

      <EditProfileModal
        open={editOpen}
        profile={profile}
        onClose={() => setEditOpen(false)}
        onSave={(patch) => {
          updateProfile.mutate(profileToPatch({ ...profile, ...patch }), {
            onSuccess: () => {
              setEditOpen(false);
              toast.success("Profile updated.");
            },
            onError: (error) => toast.error((error as Error).message),
          });
        }}
      />
      <AddTribeSheet
        open={tribeOpen}
        onClose={() => setTribeOpen(false)}
        profile={profile}
        onJoined={() => setTribeOpen(false)}
      />
      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => void navigate({ to: "/login" })}
      />
    </div>
  );
}

function SettingsHome({
  email,
  profileName,
  onOpen,
  onLogout,
  onDelete,
}: {
  email: string;
  profileName: string;
  onOpen: (view: SettingsView) => void;
  onLogout: () => void;
  onDelete: () => void;
}) {
  return (
    <div>
      <div className="mb-6">
        <p className="font-display text-2xl font-bold">Your space, your rules.</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Manage how {profileName || "you"} appears, connects, and gets discovered.
        </p>
      </div>

      <SettingsGroup label="You">
        <SettingsRow
          icon={UserIcon}
          title="Account & identity"
          detail={email}
          onClick={() => onOpen("account")}
        />
        <SettingsRow
          icon={BellIcon}
          title="Notifications"
          detail="Push alerts and activity"
          onClick={() => onOpen("notifications")}
        />
        <SettingsRow
          icon={BookmarkSimpleIcon}
          title="Saved posts"
          detail="Posts you've bookmarked"
          onClick={() => onOpen("savedPosts")}
        />
      </SettingsGroup>

      <SettingsGroup label="Discovery">
        <SettingsRow
          icon={MapPinIcon}
          title="Nearby discovery"
          detail="Approximate area and mutual radius"
          onClick={() => onOpen("nearby")}
        />
        <SettingsRow
          icon={ShieldCheckIcon}
          title="Privacy & safety"
          detail="Policies, controls, and blocked accounts"
          onClick={() => onOpen("safety")}
        />
      </SettingsGroup>

      <SettingsGroup label="MEUTUALS">
        <SettingsRow
          icon={DeviceMobileIcon}
          title="Install the app"
          detail="Add MEUTUALS to this device"
          onClick={() => onOpen("installation")}
        />
        <CheckForUpdatesRow />
      </SettingsGroup>

      <div className="mt-8 border-t border-border pt-4">
        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <SignOutIcon className="h-4 w-4" /> Log out
        </button>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={onDelete}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 active:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
        >
          <TrashIcon className="h-4 w-4" /> Delete account
        </button>
      </div>
    </div>
  );
}

function AccountSettings({
  email,
  profile,
  onEdit,
  onManageTribe,
}: {
  email: string;
  profile: NonNullable<ReturnType<typeof rowToProfile>>;
  onEdit: () => void;
  onManageTribe: () => void;
}) {
  const tribe = tribeById(profile.tribeIds[0]);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 border-b border-border pb-5">
        <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-card text-2xl ring-1 ring-border">
          {profile.avatar.startsWith("data:") || profile.avatar.startsWith("http") ? (
            <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            profile.avatar
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold">{profile.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {profile.handle ? `@${profile.handle}` : email}
          </p>
        </div>
      </div>
      <SettingsGroup label="Profile">
        <SettingsRow
          icon={UserIcon}
          title="Edit profile"
          detail="Photo, bio, home city, and social signals"
          onClick={onEdit}
        />
        <button
          type="button"
          onClick={onManageTribe}
          className="flex min-h-16 w-full items-center gap-3 border-t border-border px-3 text-left transition-colors hover:bg-secondary/60 active:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <TribeMark tribe={tribe} size="xs" decorative={false} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Your Tribe</span>
            <span className="block truncate text-xs text-muted-foreground">
              {tribe.name} · View movement timing and choices
            </span>
          </span>
          <CaretRightIcon className="h-4 w-4 text-muted-foreground" />
        </button>
      </SettingsGroup>
      <SettingsGroup label="Sign-in">
        <div className="flex min-h-16 items-center gap-3 px-3">
          <EnvelopeIcon className="h-4 w-4 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Email</span>
            <span className="block truncate text-xs text-muted-foreground">{email}</span>
          </span>
        </div>
        <Link
          to="/reset-password"
          className="flex min-h-16 items-center gap-3 border-t border-border px-3 transition-colors hover:bg-secondary/60 active:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <KeyIcon className="h-4 w-4 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Change password</span>
            <span className="block text-xs text-muted-foreground">Send a secure reset link</span>
          </span>
          <CaretRightIcon className="h-4 w-4 text-muted-foreground" />
        </Link>
      </SettingsGroup>
    </div>
  );
}

function NotificationsSettings() {
  return (
    <div>
      <PageIntro
        title="Stay in the loop, not overwhelmed."
        detail="Choose whether MEUTUALS can reach you when the app is closed."
      />
      <PushSettingsRow />
      <PushCategorySettings />
    </div>
  );
}

function InstallationSettings() {
  return (
    <div>
      <PageIntro
        title="MEUTUALS, one tap away."
        detail="Install the complete PWA for a full-screen experience and faster return visits."
      />
      <PwaInstallRow />
    </div>
  );
}

function NearbySettings() {
  const locationQuery = useMyLocationSettings();
  const saveLocation = useSaveMyLocation();
  const updateLocation = useUpdateMyLocationSettings();
  const deleteLocation = useDeleteMyLocation();
  const [locating, setLocating] = useState(false);
  const location = locationQuery.data;

  const refreshLocation = async () => {
    setLocating(true);
    try {
      const browserLocation = await requestBrowserLocation();
      const saved = await saveLocation.mutateAsync({
        ...browserLocation,
        radius_km: (location?.radius_km ?? 15) as LocationRadiusKm,
        discoverable: location?.discoverable ?? true,
      });
      toast.success(saved.city ? `Current area updated — ${saved.city}` : "Current area updated.");
    } catch (error) {
      toast.error("Location unavailable", { description: (error as Error).message });
    } finally {
      setLocating(false);
    }
  };

  return (
    <div>
      <PageIntro
        title="Nearby without the exact pin."
        detail="Your coordinates stay private. Other members only see mutual distance bands."
      />
      <div className="border-y border-border py-5">
        {locationQuery.isLoading ? (
          <div role="status" aria-label="Loading location settings" className="space-y-3">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ) : !location ? (
          <div>
            <div className="flex items-start gap-3">
              <MapPinLineIcon className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">City-only discovery</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Add an approximate location to see mutually nearby members.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={refreshLocation}
              disabled={locating || saveLocation.isPending}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-meutuals-gradient text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
            >
              {locating ? (
                <SpinnerGapIcon className="h-4 w-4 animate-spin" />
              ) : (
                <CrosshairIcon className="h-4 w-4" />
              )}{" "}
              Use my current area
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <ShieldCheckIcon className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Approximate area saved</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Your area changes only when you update it.
                  </p>
                </div>
              </div>
              <Switch
                checked={location.discoverable}
                disabled={updateLocation.isPending}
                aria-label={
                  location.discoverable ? "Pause nearby discovery" : "Enable nearby discovery"
                }
                onCheckedChange={(discoverable) =>
                  updateLocation.mutate(
                    {
                      discoverable,
                      radius_km: location.radius_km as LocationRadiusKm,
                    },
                    {
                      onError: (error) =>
                        toast.error("Could not update nearby discovery", {
                          description: (error as Error).message,
                        }),
                    },
                  )
                }
              />
            </div>
            <div className="mt-5">
              <DiscoveryRadiusSlider
                value={location.radius_km as LocationRadiusKm}
                disabled={updateLocation.isPending}
                onChange={(radiusKm) =>
                  updateLocation.mutate({
                    discoverable: location.discoverable,
                    radius_km: radiusKm,
                  })
                }
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={refreshLocation}
                disabled={locating}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-semibold"
              >
                <ArrowClockwiseIcon className={cn("h-3.5 w-3.5", locating && "animate-spin")} />{" "}
                Update area
              </button>
              <button
                type="button"
                onClick={() =>
                  deleteLocation.mutate(undefined, {
                    onSuccess: () => toast.success("Approximate location removed."),
                  })
                }
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground"
              >
                <MapPinLineIcon className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SafetySettings({ onBlocked }: { onBlocked: () => void }) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <FeatureIllustration src={safetyArt} size="sm" className="shrink-0" />
        <div>
          <p className="font-display text-xl font-bold">You control what you share.</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Nearby uses your last confirmed approximate area—never background tracking.
          </p>
        </div>
      </div>
      <SettingsGroup label="Controls">
        <SettingsRow
          icon={UsersIcon}
          title="Blocked accounts"
          detail="Review and unblock people"
          onClick={onBlocked}
        />
      </SettingsGroup>
      <SettingsGroup label="Policies">
        <SettingsLink
          icon={BookOpenTextIcon}
          title="Community Guidelines"
          to="/community-guidelines"
        />
        <SettingsLink icon={ShieldCheckIcon} title="Privacy Policy" to="/privacy" />
        <SettingsLink icon={ScalesIcon} title="Terms of Service" to="/terms" />
      </SettingsGroup>
      <div className="mt-6 flex items-start gap-3 border-t border-border pt-5">
        <LifebuoyIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Need help with a safety issue? Report the member or content from its own menu so the
          review includes the right context.
        </p>
      </div>
    </div>
  );
}

function BlockedSettings() {
  const blockedProfilesQuery = useBlockedProfiles();
  const unblockUser = useUnblockUser();
  const blockedPeople = blockedProfilesQuery.data ?? [];
  if (blockedProfilesQuery.isLoading) return <FlatUserListSkeleton count={4} />;
  if (blockedPeople.length === 0)
    return (
      <div className="py-16 text-center">
        <ProhibitIcon className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-4 font-display text-lg font-bold">No blocked accounts</p>
        <p className="mt-1 text-sm text-muted-foreground">People you block will appear here.</p>
      </div>
    );
  return (
    <ul className="divide-y divide-border border-y border-border">
      {blockedPeople.map((person) => (
        <li key={person.id} className="flex min-h-16 items-center gap-3 py-3">
          {person.avatar_url ? (
            <img src={person.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-lg">
              {person.avatar_emoji || "🙂"}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{person.display_name || "Unnamed"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {person.handle ? `@${person.handle}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              unblockUser.mutate(person.id, {
                onSuccess: () => toast.success(`Unblocked ${person.display_name || "user"}.`),
                onError: (error) => toast.error((error as Error).message),
              })
            }
            className="min-h-10 rounded-full border border-border px-4 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            Unblock
          </button>
        </li>
      ))}
    </ul>
  );
}

function SavedPostsSettings() {
  const savedQuery = useMySavedPosts();
  const savedPosts = savedQuery.data ?? [];
  if (savedQuery.isLoading) return <FeedSkeleton />;
  if (savedPosts.length === 0)
    return (
      <div className="py-16 text-center">
        <BookmarkSimpleIcon className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-4 font-display text-lg font-bold">No saved posts</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap the bookmark on any post to save it here.
        </p>
      </div>
    );
  return <ProfilePostHistory posts={savedPosts} />;
}

function PageIntro({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mb-6">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

function SettingsGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="label-mono mb-2 px-1 text-muted-foreground">{label}</h2>
      <div className="overflow-hidden border-y border-border sm:rounded-2xl sm:border">
        {children}
      </div>
    </section>
  );
}

function SettingsRow({
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  icon: typeof LifebuoyIcon;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-3 border-b border-border px-3 text-left transition-colors last:border-b-0 hover:bg-secondary/60 active:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <CaretRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/**
 * Manually pokes the same service-worker registration that PwaLifecycle
 * already checks automatically (on an hourly timer and on visibility
 * change) - deliberately doesn't handle applying the update itself. Calling
 * `registration.update()` fires the exact same `updatefound` event PwaLifecycle
 * is already listening for, so if a newer version exists its bottom banner
 * (with the actual reload-safe apply flow: SKIP_WAITING then a
 * controllerchange-driven reload) takes over from there. Reimplementing
 * that here would mean two places able to apply an update independently -
 * this just triggers the check and reports the result.
 */
function CheckForUpdatesRow() {
  const [checking, setChecking] = useState(false);

  const check = async () => {
    if (checking) return;
    setChecking(true);
    try {
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
        toast.error("Updates aren't available here", {
          description: "This only works on the installed or deployed app.",
        });
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        toast.error("Updates aren't available here", {
          description: "This only works on the installed or deployed app.",
        });
        return;
      }
      await registration.update();
      if (registration.waiting || registration.installing) {
        toast.success("Update found", {
          description: "Look for the update banner at the bottom of the screen to apply it.",
        });
      } else {
        toast.success("You're up to date.");
      }
    } catch (error) {
      toast.error("Couldn't check for updates", { description: (error as Error).message });
    } finally {
      setChecking(false);
    }
  };

  return (
    <button
      type="button"
      onClick={check}
      disabled={checking}
      className="flex min-h-16 w-full items-center gap-3 border-b border-border px-3 text-left transition-colors last:border-b-0 hover:bg-secondary/60 active:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:opacity-60"
    >
      <ArrowClockwiseIcon
        className={cn("h-4 w-4 shrink-0 text-muted-foreground", checking && "animate-spin")}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Check for updates</span>
        <span className="block truncate text-xs text-muted-foreground">
          {checking ? "Checking…" : "See if a newer version is available"}
        </span>
      </span>
    </button>
  );
}

function SettingsLink({
  icon: Icon,
  title,
  to,
}: {
  icon: typeof LifebuoyIcon;
  title: string;
  to: "/community-guidelines" | "/privacy" | "/terms";
}) {
  return (
    <Link
      to={to}
      className="flex min-h-16 items-center gap-3 border-b border-border px-3 transition-colors last:border-b-0 hover:bg-secondary/60 active:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 text-sm font-semibold">{title}</span>
      <CaretRightIcon className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
