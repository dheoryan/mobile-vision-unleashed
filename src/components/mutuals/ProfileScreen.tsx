import { useEffect, useRef, useState } from "react";
import {
  Settings,
  Edit3,
  Bookmark,
  Zap,
  Trash2,
  LogOut,
  X,
  Camera,
  Ban,
  Loader2,
  Check,
  LocateFixed,
  MapPinOff,
  RefreshCw,
  ShieldCheck,
  UserRound,
  KeyRound,
  ChevronRight,
  Scale,
  BookOpenCheck,
  LifeBuoy,
  Mail,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import type { Profile } from "./Onboarding";
import { AppHeader, TribeBadge } from "./Shared";
import { PlusBadge } from "./PlusBadge";
import { DeleteAccountModal } from "./DeleteAccountModal";
import { useMyPosts, useMySavedPosts } from "@/lib/posts-store";
import { useMyHostedVentures } from "@/lib/ventures-store";
import { useFollowCounts } from "@/lib/social-store";
import { PostCard } from "./PostCard";
import { ProfilePostHistory } from "./ProfilePostHistory";
import { timeAgo } from "@/lib/time";
import { intentStore } from "@/lib/intent-store";
import { preferVentureHostingOnNextOpen } from "@/lib/ventures-mode";
import { useBlockedProfiles, useUnblockUser } from "@/lib/blocked-store";
import { uploadAvatar } from "@/lib/uploads";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CompactListSkeleton, PeopleSkeleton, Skeleton } from "./Skeleton";
import { isPlusEffective, MONETIZATION_ENABLED, showPlusBadge } from "@/lib/feature-flags";
import { PushSettingsRow } from "./EnablePushBanner";
import {
  AVAILABILITY_OPTIONS,
  INTEREST_OPTIONS,
  SOCIAL_INTENT_OPTIONS,
  optionLabel,
  toggleSelection,
  type AvailabilityId,
  type InterestId,
  type SocialIntentId,
} from "@/lib/profile-options";
import { requestBrowserLocation, type LocationRadiusKm } from "@/lib/location";
import {
  useDeleteMyLocation,
  useMyLocationSettings,
  useSaveMyLocation,
  useUpdateMyLocationSettings,
} from "@/lib/location-store";
import { CitySelect } from "./CitySelect";
import { DiscoveryRadiusSlider } from "./DiscoveryRadiusSlider";
import { Switch } from "@/components/ui/switch";
import { AnimatedModal } from "@/components/ui/animated-modal";
import { TribeMark } from "./TribeMark";
import { FeatureIllustration } from "./FeatureIllustration";
import safetyArt from "@/assets/app-illustrations/safety-privacy.webp";
import { timingLabel } from "@/lib/venture-time";
import { PwaInstallRow } from "./PwaInstallRow";

type GridTab = "posts" | "saved" | "ventures";

export function ProfileScreen({
  profile,
  setProfile,
}: {
  profile: Profile;
  setProfile?: (updater: (p: Profile | null) => Profile | null) => void;
}) {
  const { user } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gridTab, setGridTab] = useState<GridTab>("posts");
  const primaryId = profile.tribeIds[0];
  const tribe = tribeById(primaryId);
  const otherTribes = profile.tribeIds.slice(1).map((id) => tribeById(id));
  const isPlus = isPlusEffective(profile.plan);
  const showPlanCard = MONETIZATION_ENABLED;
  const followCounts = useFollowCounts();
  const profileCompletion = [
    Boolean(profile.handle),
    Boolean(profile.city),
    Boolean(profile.bio),
    profile.interests.length >= 2,
    profile.socialIntents.length >= 1,
    profile.availability.length >= 1,
  ].filter(Boolean).length;

  const myPostsQuery = useMyPosts();
  const myPosts = myPostsQuery.data ?? [];

  const savedQuery = useMySavedPosts();
  const savedPosts = savedQuery.data ?? [];
  const venturesQuery = useMyHostedVentures();
  const ventures = venturesQuery.data ?? [];

  return (
    <div className="bg-habitat min-h-screen pb-28">
      <AppHeader title="Profile" subtitle="You" accent={tribe.colorVar} />
      <main className="mx-auto max-w-md px-5">
        {/* No card. Identity sits directly on the ground — the gradient panel
            was the softest, most generic element on the screen, and a card
            around the thing that IS the page adds a frame around a frame. */}
        <section className="relative mt-5">
          <button
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
            className="absolute -top-1 right-0 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-4">
            <span className="relative">
              <span
                className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md bg-card text-4xl ring-2"
                style={{ ["--tw-ring-color" as string]: tribe.colorVar }}
              >
                {profile.avatar?.startsWith("data:") || profile.avatar?.startsWith("http") ? (
                  <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  profile.avatar
                )}
              </span>
              {showPlusBadge(profile.plan) && <PlusBadge size="md" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-bold leading-tight">
                  {profile.name || "You"}
                </h2>
                {showPlusBadge(profile.plan) && (
                  <span className="label-mono inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-primary">
                    <Zap className="h-3 w-3" fill="currentColor" /> PLUS
                  </span>
                )}
              </div>
              {/* One mono line instead of a location paragraph plus a pill.
                  Space Mono was already the strongest thing in the type stack;
                  this gives it structural work rather than decoration. */}
              <p className="label-mono mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground">
                <span>{profile.city || "Somewhere"}</span>
                <span aria-hidden>·</span>
                <span style={{ color: tribe.colorVar }}>{tribe.name}</span>
                {otherTribes.map((t) => (
                  <TribeMark key={t.id} tribe={t} size="xs" decorative={false} />
                ))}
              </p>
            </div>
          </div>
          {profile.bio && <p className="mt-4 text-sm text-muted-foreground">{profile.bio}</p>}

          {(profile.socialIntents.length > 0 || profile.interests.length > 0) && (
            <div className="mt-4 space-y-2">
              {profile.socialIntents.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {profile.socialIntents.map((intent) => (
                    <ProfileTag
                      key={intent}
                      label={optionLabel(SOCIAL_INTENT_OPTIONS, intent)}
                      accent
                    />
                  ))}
                </div>
              )}
              {profile.interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.slice(0, 5).map((interest) => (
                    <ProfileTag key={interest} label={optionLabel(INTEREST_OPTIONS, interest)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {profileCompletion < 6 && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="mt-5 w-full rounded-md border border-primary/40 bg-primary/5 p-3 text-left"
            >
              <div className="flex items-center justify-between text-xs">
                {/* A percentage is a number with no verb — it nags without
                    telling you what to do. The bar still shows progress. */}
                <span className="font-semibold">Finish your profile</span>
                <span className="text-primary">{6 - profileCompletion} left</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${(profileCompletion / 6) * 100}%` }}
                />
              </div>
            </button>
          )}

          {/* Three numbers in three identical rounded boxes was the most
              generic element left. Hairline rules carry the same grouping with
              none of the packaging. Content is unchanged on purpose — which
              three numbers belong here is still open. */}
          <div className="mt-5 flex items-stretch border-y border-border">
            <Stat label="Following" value={String(followCounts.data?.following ?? 0)} />
            <span aria-hidden className="w-px bg-border" />
            <Stat label="Followers" value={String(followCounts.data?.followers ?? 0)} />
            <span aria-hidden className="w-px bg-border" />
            <Stat label="Ventures" value={String(profile.ventureCount)} />
          </div>

          <button
            onClick={() => setEditOpen(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-border py-3 text-xs font-bold hover:bg-card"
          >
            <Edit3 className="h-3.5 w-3.5" /> Edit profile
          </button>
        </section>

        {showPlanCard && (
          <section className="mt-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="label-mono text-muted-foreground">Plan</p>
                <p className="font-display text-lg font-bold">
                  {isPlus ? (
                    <>
                      <span className="text-primary">MEUTUALS+</span>
                    </>
                  ) : (
                    "Free"
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isPlus
                    ? "Unlimited Ventures, unlimited Hellos, full match visibility."
                    : `${Math.max(0, 3 - profile.ventureCount)} of 3 free Ventures left this month.`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isPlus ? (
                    <>
                      You're in{" "}
                      <span className="text-foreground font-semibold">
                        {profile.tribeIds.length}
                      </span>{" "}
                      of 3 Tribes.
                    </>
                  ) : (
                    <>You're in 1 Tribe. Upgrade to join up to 3.</>
                  )}
                </p>
              </div>
              {!isPlus && (
                <Link
                  to="/upgrade"
                  className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"
                >
                  <Zap className="h-3.5 w-3.5" fill="currentColor" /> Upgrade
                </Link>
              )}
            </div>

            {setProfile && (
              <button
                onClick={() =>
                  setProfile((p) =>
                    p
                      ? {
                          ...p,
                          plan: isPlus ? "free" : "plus",
                          tribeIds: isPlus
                            ? [p.tribeIds[0]]
                            : Array.from(new Set([...p.tribeIds, "owl" as const])).slice(0, 3),
                        }
                      : p,
                  )
                }
                className="mt-3 w-full rounded-xl border border-dashed border-border py-2 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Demo: toggle plan to {isPlus ? "Free" : "Plus"}
              </button>
            )}
          </section>
        )}

        {/* Both destinations advertise paid plans, so they stay behind the
            monetization flag. This grid previously sat OUTSIDE the flag check,
            which left a live pricing page reachable while monetization was off. */}
        {MONETIZATION_ENABLED && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              to="/tiers"
              className="rounded-2xl border border-border bg-card p-3 text-center text-xs font-semibold hover:bg-secondary"
            >
              Compare tiers
            </Link>
            <Link
              to="/host"
              className="rounded-2xl border border-border bg-card p-3 text-center text-xs font-semibold hover:bg-secondary"
            >
              Apply to host a Tribe
            </Link>
          </div>
        )}

        {/* The tab row IS the section header. It used to be a dynamic
            SectionTitle ("Your posts" / "Saved" / "Ventures") next to three
            icon-only pills — which both said the same thing twice and left the
            icons undecipherable until you tapped one. Words, underlined, no
            separate heading. */}
        <div className="mb-5 mt-8 flex items-center gap-6 border-b border-border">
          <TabBtn active={gridTab === "posts"} onClick={() => setGridTab("posts")}>
            Posts
          </TabBtn>
          <TabBtn active={gridTab === "saved"} onClick={() => setGridTab("saved")}>
            Saved
          </TabBtn>
          <TabBtn active={gridTab === "ventures"} onClick={() => setGridTab("ventures")}>
            Ventures
          </TabBtn>
        </div>

        {gridTab === "posts" &&
          (myPostsQuery.isLoading ? (
            <CompactListSkeleton label="Loading your posts" />
          ) : myPostsQuery.isError ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <p className="text-xs text-muted-foreground">Couldn't load your posts.</p>
              <button
                onClick={() => myPostsQuery.refetch()}
                className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                Retry
              </button>
            </div>
          ) : myPosts.length === 0 ? (
            /* This used to render up to 6 posts from the hardcoded POSTS demo
               array, so a brand-new user opened their own profile and saw a grid
               of posts they had never written, attributed to themselves. */
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              You haven't posted yet. Share a signal from the Timeline tab.
            </p>
          ) : (
            <ProfilePostHistory posts={myPosts} />
          ))}

        {gridTab === "saved" &&
          (savedQuery.isLoading ? (
            <CompactListSkeleton label="Loading saved posts" />
          ) : savedPosts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No saved posts yet. Tap the bookmark on any post to save it.
            </p>
          ) : (
            /* A list, not a square grid.
             *
             * The grid was a photo-grid pattern applied to text: a third of the
             * width, aspect-square, 10px type, three-line clamp. Photo grids
             * work because the photo IS the content; here the content is words,
             * and at that size they are unreadable, so every tile looked like a
             * bookmark emoji with noise under it.
             *
             * It was also a plain div — you could save a post and then have no
             * way to open it again, which defeats the entire feature. These are
             * buttons now, routed through the same openPost intent the
             * notifications use. */
            <div className="space-y-2">
              {savedPosts.map((p) => {
                const t = tribeById((p.tribe_id as TribeId) || (profile.tribeIds[0] as TribeId));
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => intentStore.push({ kind: "openPost", postId: p.id })}
                    className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40"
                  >
                    <span
                      aria-hidden
                      className="mt-0.5 h-9 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: t.colorVar }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {/* Whose post this was. The grid never said, so a saved
                            collection was a pile of anonymous fragments. */}
                        <span className="truncate font-semibold text-foreground">
                          {p.author?.display_name?.trim() || "Someone"}
                        </span>
                        <span aria-hidden>·</span>
                        <span className="shrink-0">{timeAgo(p.created_at)}</span>
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-foreground/90">
                        {p.content || (p.image_url ? "Photo" : "")}
                      </span>
                    </span>
                    <Bookmark
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                      fill="currentColor"
                    />
                  </button>
                );
              })}
            </div>
          ))}

        {gridTab === "ventures" && (
          <div className="space-y-2">
            {venturesQuery.isLoading ? (
              <CompactListSkeleton label="Loading your Ventures" />
            ) : ventures.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                You haven't launched a Venture yet. Open the Ventures tab when you're ready to meet
                someone in person.
              </div>
            ) : (
              ventures.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    if (user) preferVentureHostingOnNextOpen(user.id);
                    intentStore.push({ kind: "openTab", tab: "ventures" });
                  }}
                  className="w-full rounded-2xl border border-border bg-card p-4 text-left text-sm transition-colors hover:border-primary/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold">
                      {v.title || v.intents.slice(0, 3).join(" · ") || "Open to anything"}
                    </p>
                    <span className="label-mono shrink-0 text-muted-foreground">{v.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {v.scope === "mine" ? "My Tribes" : "All Tribes"} ·{" "}
                    {timingLabel(v) ?? "Any time"} · {v.filled_slots}/{v.max_slots} joined ·{" "}
                    {timeAgo(v.created_at)}
                  </p>
                </button>
              ))
            )}
          </div>
        )}
      </main>

      <EditProfileModal
        open={editOpen}
        profile={profile}
        onClose={() => setEditOpen(false)}
        onSave={(patch) => {
          setProfile?.((p) => (p ? { ...p, ...patch } : p));
          setEditOpen(false);
          toast.success("Profile updated.");
        }}
      />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onEditProfile={() => {
          setSettingsOpen(false);
          setEditOpen(true);
        }}
        onLogout={() => {
          setSettingsOpen(false);
          setProfile?.(() => null);
          toast.success("Signed out.");
        }}
        onDelete={() => {
          setSettingsOpen(false);
          setDeleteOpen(true);
        }}
      />

      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          setDeleteOpen(false);
          setProfile?.(() => null);
        }}
      />
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "min-h-11 pb-2.5 text-xs transition-colors",
        active
          ? "font-bold text-primary shadow-[inset_0_-2px_0_var(--color-primary)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 py-3.5 pl-4 first:pl-0">
      <p className="font-display text-[22px] font-bold leading-none tracking-tight tabular-nums">
        {value}
      </p>
      <p className="label-mono mt-1.5 text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * City derived from the person's last explicit location update.
 *
 * When location is on, the server re-derives the city from the stored
 * coordinates on every save, so typing a different one here would be
 * overwritten the next time the person updates their area. Rather than let
 * that fight happen silently, the picker is replaced with the derived value
 * and a way to refresh it.
 *
 * Turning nearby off hands the field back — someone who does not share
 * location has to be able to say where they are.
 */
function CityField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const locationQuery = useMyLocationSettings();
  const saveLocation = useSaveMyLocation();
  const [refreshing, setRefreshing] = useState(false);
  const derived = Boolean(locationQuery.data);

  if (!derived) return <CitySelect value={value} onChange={onChange} />;

  const refresh = async () => {
    setRefreshing(true);
    try {
      const position = await requestBrowserLocation();
      const saved = await saveLocation.mutateAsync({
        ...position,
        radius_km: (locationQuery.data?.radius_km ?? 15) as LocationRadiusKm,
        discoverable: locationQuery.data?.discoverable ?? true,
      });
      if (saved.city) {
        onChange(saved.city);
        toast.success(`Updated to ${saved.city}`);
      } else {
        toast.message("No nearby city in our list", {
          description: "Your location is saved; the city label is unchanged.",
        });
      }
    } catch (error) {
      toast.error("Could not update location", { description: (error as Error).message });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div>
      <p className="label-mono mb-1 text-muted-foreground">City or local area</p>
      <div className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-background/60 px-4">
        <LocateFixed className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm">{value || "Not set yet"}</span>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="shrink-0 text-[11px] font-semibold text-primary disabled:opacity-50"
        >
          {refreshing ? "Updating…" : "Update"}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        Updates only when you tap Update. MEUTUALS does not track your location in the background.
      </p>
    </div>
  );
}

function ProfileTag({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[10px] font-semibold",
        accent
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-background/50 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function EditProfileModal({
  open,
  profile,
  onClose,
  onSave,
}: {
  open: boolean;
  profile: Profile;
  onClose: () => void;
  onSave: (patch: Partial<Profile>) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(profile.name);
  const [handle, setHandle] = useState((profile.handle ?? "").replace(/^@/, ""));
  const [city, setCity] = useState(profile.city);
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [interests, setInterests] = useState<InterestId[]>(profile.interests);
  const [socialIntents, setSocialIntents] = useState<SocialIntentId[]>(profile.socialIntents);
  const [availability, setAvailability] = useState<AvailabilityId[]>(profile.availability);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);

  const sanitizeHandle = (v: string) =>
    v
      .toLowerCase()
      .replace(/^@/, "")
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 30);
  const handleValid = handle.length >= 3 && handle.length <= 30;

  if (!open) return null;

  const onPickFile = (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large", { description: "Please pick an image under 5MB." });
      return;
    }
    setCropFile(file);
  };

  const onSaveCroppedAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      setAvatar(url);
      setCropFile(null);
      toast.success("Photo ready", { description: "Save changes to update your profile." });
    } catch (err) {
      toast.error("Upload failed", { description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const isImage = avatar.startsWith("data:") || avatar.startsWith("http");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto max-h-[92dvh] w-full max-w-md overflow-y-auto scroll-panel rounded-t-3xl border border-border bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-3xl animate-rise">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-display text-xl font-bold">Edit profile</h2>

        <div className="mt-5 flex flex-col items-center">
          <label className="relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-visible">
            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-background text-4xl ring-2 ring-background">
              {isImage ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{avatar}</span>
              )}
            </span>
            <span className="absolute -bottom-1 -right-1 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-card">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                onPickFile(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
          </label>
          {/* The emoji-avatar strip used to sit here. Removed at the user's
              request: it offered twelve near-identical animal glyphs as a
              parallel identity system next to real photo upload, and the
              defaults are still applied at signup, so nothing is lost by not
              re-offering them on the edit screen. */}
        </div>

        <div className="mt-5 space-y-3">
          <Input label="Display name" value={name} onChange={setName} />
          <Input
            label="@handle"
            value={handle}
            onChange={(v) => setHandle(sanitizeHandle(v))}
            hint={handleValid ? `@${handle}` : "3–30 chars · a–z, 0–9, _"}
          />
          <CityField value={city} onChange={setCity} />
          <Input
            label="Bio"
            value={bio}
            onChange={(v) => setBio(v.slice(0, 140))}
            multiline
            hint={`${bio.length}/140`}
          />
          <ProfileChoiceGroup
            label="Interests"
            options={INTEREST_OPTIONS}
            selected={interests}
            onToggle={(id) => setInterests(toggleSelection(interests, id as InterestId, 8))}
          />
          <ProfileChoiceGroup
            label="Here for"
            options={SOCIAL_INTENT_OPTIONS}
            selected={socialIntents}
            onToggle={(id) =>
              setSocialIntents(toggleSelection(socialIntents, id as SocialIntentId, 3))
            }
          />
          <ProfileChoiceGroup
            label="Usually free"
            options={AVAILABILITY_OPTIONS}
            selected={availability}
            onToggle={(id) =>
              setAvailability(toggleSelection(availability, id as AvailabilityId, 4))
            }
          />
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            disabled={
              !name.trim() ||
              !city.trim() ||
              !handleValid ||
              interests.length < 2 ||
              socialIntents.length < 1 ||
              availability.length < 1 ||
              uploading
            }
            onClick={() =>
              onSave({
                name: name.trim(),
                handle,
                city: city.trim(),
                bio,
                avatar,
                interests,
                socialIntents,
                availability,
              })
            }
            className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {uploading ? "Saving photo…" : "Save changes"}
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>

      <AvatarCropModal
        file={cropFile}
        saving={uploading}
        onClose={() => setCropFile(null)}
        onSave={onSaveCroppedAvatar}
      />
    </div>
  );
}

function AvatarCropModal({
  file,
  saving,
  onClose,
  onSave,
}: {
  file: File | null;
  saving: boolean;
  onClose: () => void;
  onSave: (file: File) => Promise<void> | void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.15);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const previewSize = 256;

  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    setZoom(1.15);
    setOffset({ x: 0, y: 0 });
    setImageSize(null);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!file || !url) return null;

  const getPreviewMetrics = (nextZoom = zoom) => {
    if (!imageSize) return null;
    const baseScale = Math.max(previewSize / imageSize.width, previewSize / imageSize.height);
    const scale = baseScale * nextZoom;
    return {
      width: imageSize.width * scale,
      height: imageSize.height * scale,
    };
  };

  const clampOffset = (next: { x: number; y: number }, nextZoom = zoom) => {
    const metrics = getPreviewMetrics(nextZoom);
    if (!metrics) return next;
    const maxX = Math.max(0, (metrics.width - previewSize) / 2);
    const maxY = Math.max(0, (metrics.height - previewSize) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  };

  const previewMetrics = getPreviewMetrics();

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset(
      clampOffset({
        x: drag.originX + event.clientX - drag.startX,
        y: drag.originY + event.clientY - drag.startY,
      }),
    );
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const createCroppedAvatar = async () => {
    const img = imgRef.current;
    const viewport = viewportRef.current;
    if (!img || !viewport) throw new Error("Image is not ready yet.");

    await img.decode().catch(() => undefined);

    const outputSize = 720;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported in this browser.");

    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, outputSize, outputSize);

    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const baseScale = Math.max(outputSize / naturalWidth, outputSize / naturalHeight);
    const imageScale = baseScale * zoom;
    const renderedWidth = naturalWidth * imageScale;
    const renderedHeight = naturalHeight * imageScale;
    const offsetScale = outputSize / viewport.clientWidth;
    const dx = outputSize / 2 - renderedWidth / 2 + offset.x * offsetScale;
    const dy = outputSize / 2 - renderedHeight / 2 + offset.y * offsetScale;

    ctx.drawImage(img, dx, dy, renderedWidth, renderedHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("Could not export avatar."))),
        "image/jpeg",
        0.92,
      );
    });

    const baseName = file.name.replace(/\.[^/.]+$/, "") || "avatar";
    return new File([blob], `${baseName}-cropped-avatar.jpg`, { type: "image/jpeg" });
  };

  const handleUsePhoto = async () => {
    try {
      const cropped = await createCroppedAvatar();
      await onSave(cropped);
    } catch (err) {
      toast.error("Could not crop photo", { description: (err as Error).message });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-md"
        onClick={saving ? undefined : onClose}
      />
      <div className="relative mx-auto w-full max-w-md rounded-t-3xl border border-border bg-card p-6 shadow-2xl sm:rounded-3xl animate-rise">
        <button
          onClick={onClose}
          disabled={saving}
          aria-label="Close cropper"
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="font-display text-xl font-bold">Adjust profile photo</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Drag to reposition. Use the slider to zoom before saving.
        </p>

        <div className="mt-5 flex justify-center">
          <div
            ref={viewportRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            className="relative h-64 w-64 touch-none overflow-hidden rounded-full border border-primary/40 bg-background shadow-inner ring-4 ring-background"
            style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
          >
            <img
              ref={imgRef}
              src={url}
              alt="Selected profile photo"
              draggable={false}
              onLoad={(event) => {
                setImageSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
                setOffset({ x: 0, y: 0 });
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: previewMetrics ? `${previewMetrics.width}px` : "auto",
                height: previewMetrics ? `${previewMetrics.height}px` : "auto",
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-full border border-white/15" />
          </div>
        </div>

        <label className="mt-5 block">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="label-mono text-muted-foreground">Zoom</span>
            <span className="text-muted-foreground">{Math.round(zoom * 100)}%</span>
          </div>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => {
              const nextZoom = Number(e.target.value);
              setZoom(nextZoom);
              setOffset((current) => clampOffset(current, nextZoom));
            }}
            className="w-full accent-primary"
          />
        </label>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleUsePhoto}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Use photo
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  multiline,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between">
        <span className="label-mono text-muted-foreground">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      )}
    </label>
  );
}

function ProfileChoiceGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="label-mono text-muted-foreground">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.id);
          return (
            <button
              type="button"
              key={option.id}
              aria-pressed={active}
              onClick={() => onToggle(option.id)}
              className={cn(
                "min-h-10 rounded-full border px-3 py-2 text-[11px] font-semibold",
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              {active && <Check className="mr-1 inline h-3 w-3" />}
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SettingsSheet({
  open,
  onClose,
  onEditProfile,
  onLogout,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  onEditProfile: () => void;
  onLogout: () => void;
  onDelete: () => void;
}) {
  const { user } = useAuth();
  const blockedProfilesQuery = useBlockedProfiles();
  const unblockUser = useUnblockUser();
  const blockedPeople = blockedProfilesQuery.data ?? [];
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
    <AnimatedModal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Settings"
      contentClassName="max-h-[92dvh] overflow-y-auto scroll-panel p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <div>
        <button
          onClick={onClose}
          aria-label="Close settings"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-display text-xl font-bold">Settings</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Your account, privacy, safety, and preferences.
        </p>

        <div className="mt-5">
          <p className="label-mono text-muted-foreground">Account</p>
          <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-background">
            <SettingsAction
              icon={UserRound}
              title="Edit profile"
              detail="Photo, bio, home city, and social signals"
              onClick={onEditProfile}
            />
            <div className="border-t border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Email</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {user?.email ?? "Signed-in account"}
                  </p>
                </div>
              </div>
            </div>
            <Link
              to="/reset-password"
              className="flex min-h-14 items-center gap-3 border-t border-border px-4 transition-colors hover:bg-secondary/60"
            >
              <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Change password</p>
                <p className="text-[11px] text-muted-foreground">Send a secure reset link</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </div>

        <div className="mt-5">
          <p className="label-mono text-muted-foreground">Notifications</p>
          <div className="mt-2">
            <PushSettingsRow />
          </div>
        </div>

        <div className="mt-5">
          <p className="label-mono text-muted-foreground">App installation</p>
          <div className="mt-2">
            <PwaInstallRow />
          </div>
        </div>

        <div className="mt-5">
          <p className="label-mono text-muted-foreground">Nearby discovery</p>
          <div className="mt-2 rounded-2xl border border-border bg-background p-4">
            {locationQuery.isLoading ? (
              <div role="status" aria-label="Loading location settings" className="space-y-3">
                <span className="sr-only">Loading location settings</span>
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : !location ? (
              <>
                <div className="flex items-start gap-3">
                  <MapPinOff className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold">City-only discovery</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add an approximate location to see mutually nearby members.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={refreshLocation}
                  disabled={locating || saveLocation.isPending}
                  className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {locating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LocateFixed className="h-4 w-4" />
                  )}{" "}
                  Use my current area
                </button>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">Approximate area saved</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Coordinates remain private. Only distance bands are shared. Your area
                        changes only when you update it.
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
                        { discoverable, radius_km: location.radius_km as LocationRadiusKm },
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
                <div className="mt-4">
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
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={refreshLocation}
                    disabled={locating}
                    className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border text-[11px] font-semibold"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", locating && "animate-spin")} /> Update
                    current area
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      deleteLocation.mutate(undefined, {
                        onSuccess: () => toast.success("Approximate location removed."),
                      })
                    }
                    className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border text-[11px] font-semibold text-muted-foreground"
                  >
                    <MapPinOff className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-5">
          <p className="label-mono text-muted-foreground">Safety & privacy</p>
          {/* Sits with the policy links and nearby controls — deliberately not
              next to the destructive account actions further down. Reinforces
              that location is approximate and under the user's control; makes
              no claim that the app guarantees safety. */}
          <div className="mt-2 flex items-center gap-4 rounded-2xl border border-border bg-background p-4">
            <FeatureIllustration src={safetyArt} size="sm" className="shrink-0" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              You control what you share. Nearby uses your last confirmed approximate area, never an
              exact pin or background tracking.
            </p>
          </div>
          <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-background">
            <Link
              to="/community-guidelines"
              className="flex min-h-14 items-center gap-3 px-4 transition-colors hover:bg-secondary/60"
            >
              <BookOpenCheck className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm font-semibold">Community Guidelines</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              to="/privacy"
              className="flex min-h-14 items-center gap-3 border-t border-border px-4 transition-colors hover:bg-secondary/60"
            >
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm font-semibold">Privacy Policy</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              to="/terms"
              className="flex min-h-14 items-center gap-3 border-t border-border px-4 transition-colors hover:bg-secondary/60"
            >
              <Scale className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm font-semibold">Terms of Service</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </div>

        <div className="mt-5">
          <p className="label-mono text-muted-foreground">Blocked accounts</p>
          {blockedProfilesQuery.isLoading ? (
            <div className="mt-2">
              <PeopleSkeleton count={2} />
            </div>
          ) : blockedPeople.length === 0 ? (
            <p className="mt-2 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              You haven't blocked anyone.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {blockedPeople.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
                >
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-lg">
                      {p.avatar_emoji || "🙂"}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.display_name || "Unnamed"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {p.handle ? `@${p.handle}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      unblockUser.mutate(p.id, {
                        onSuccess: () => toast.success(`Unblocked ${p.display_name || "user"}.`),
                        onError: (e) => toast.error((e as Error).message),
                      })
                    }
                    className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <Ban className="h-3 w-3" /> Unblock
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-sm font-semibold hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
          <button
            onClick={onDelete}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 py-3 text-sm font-semibold text-destructive hover:bg-destructive/20"
          >
            <Trash2 className="h-4 w-4" /> Delete account
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}

function SettingsAction({
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  icon: typeof LifeBuoy;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-secondary/60"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
