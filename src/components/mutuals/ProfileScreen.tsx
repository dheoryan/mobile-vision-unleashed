import { useEffect, useRef, useState } from "react";
import { Menu, Bookmark, Zap, X, Loader2, Check, LocateFixed, MapPin, Grid3x3 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import type { Profile } from "./Onboarding";
import { AppHeader, TribeBadge } from "./Shared";
import { PlusBadge } from "./PlusBadge";
import { useMyPosts, useMySavedPosts } from "@/lib/posts-store";
import { useMyHostedVentures } from "@/lib/ventures-store";
import { useProfileStats } from "@/lib/social-store";
import { PostCard } from "./PostCard";
import { ProfilePostHistory } from "./ProfilePostHistory";
import { timeAgo } from "@/lib/time";
import { intentStore } from "@/lib/intent-store";
import { preferVentureHostingOnNextOpen } from "@/lib/ventures-mode";
import { uploadAvatar } from "@/lib/uploads";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CompactListSkeleton } from "./Skeleton";
import { isPlusEffective, MONETIZATION_ENABLED, showPlusBadge } from "@/lib/feature-flags";
import {
  AVAILABILITY_OPTIONS,
  GENDER_OPTIONS,
  INTEREST_OPTIONS,
  SOCIAL_INTENT_OPTIONS,
  optionLabel,
  toggleSelection,
  type AvailabilityId,
  type GenderId,
  type InterestId,
  type SocialIntentId,
} from "@/lib/profile-options";
import { GenderSelect } from "./GenderSelect";
import { defaultAvatarUrl } from "@/lib/default-avatar";
import { requestBrowserLocation, type LocationRadiusKm } from "@/lib/location";
import { useMyLocationSettings, useSaveMyLocation } from "@/lib/location-store";
import { CitySelect } from "./CitySelect";
import { TribeMark } from "./TribeMark";
import { timingLabel } from "@/lib/venture-time";
import { avatarFileIssue } from "@/lib/avatar-file";
import { AvatarLightbox } from "./AvatarLightbox";

type GridTab = "posts" | "saved" | "ventures";

export function ProfileScreen({
  profile,
  setProfile,
}: {
  profile: Profile;
  setProfile?: (updater: (p: Profile | null) => Profile | null) => void;
}) {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false);
  const [gridTab, setGridTab] = useState<GridTab>("posts");
  const hasPhotoAvatar = Boolean(
    profile.avatar?.startsWith("data:") || profile.avatar?.startsWith("http"),
  );
  const primaryId = profile.tribeIds[0];
  const tribe = tribeById(primaryId);
  const otherTribes = profile.tribeIds.slice(1).map((id) => tribeById(id));
  const isPlus = isPlusEffective(profile.plan);
  const showPlanCard = MONETIZATION_ENABLED;
  const profileStats = useProfileStats();
  const profileCompletion = [
    Boolean(profile.handle),
    Boolean(profile.city),
    Boolean(profile.bio),
    profile.interests.length >= 2,
    profile.socialIntents.length >= 1,
    profile.availability.length >= 1,
    Boolean(profile.gender),
  ].filter(Boolean).length;
  const PROFILE_FIELD_COUNT = 7;

  const myPostsQuery = useMyPosts();
  const myPosts = myPostsQuery.data ?? [];

  const savedQuery = useMySavedPosts();
  const savedPosts = savedQuery.data ?? [];
  const venturesQuery = useMyHostedVentures();
  const ventures = venturesQuery.data ?? [];

  return (
    <div className="bg-habitat min-h-screen pb-28">
      <AppHeader
        title="Profile"
        subtitle="You"
        accent={tribe.colorVar}
        showNotifications={false}
        action={
          <Link
            to="/settings"
            aria-label="Settings"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Menu className="h-5 w-5" />
          </Link>
        }
      />
      <main className="mx-auto max-w-md px-5">
        {/* No card. Identity sits directly on the ground — the gradient panel
            was the softest, most generic element on the screen, and a card
            around the thing that IS the page adds a frame around a frame. */}
        <section className="relative mt-6">
          <div className="flex items-start gap-5">
            <span className="relative shrink-0">
              {hasPhotoAvatar ? (
                <button
                  type="button"
                  onClick={() => setAvatarLightboxOpen(true)}
                  aria-label="View profile photo"
                  className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-card shadow-lg ring-2 focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  style={{ ["--tw-ring-color" as string]: tribe.colorVar }}
                >
                  <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
                </button>
              ) : (
                <span
                  className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-card text-5xl shadow-lg ring-2"
                  style={{ ["--tw-ring-color" as string]: tribe.colorVar }}
                >
                  {profile.avatar}
                </span>
              )}
              {showPlusBadge(profile.plan) && <PlusBadge size="md" />}
            </span>
            <div className="min-w-0 flex-1 pt-2">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-[26px] font-bold leading-tight">
                  {profile.name || "You"}
                </h2>
                {showPlusBadge(profile.plan) && (
                  <span className="label-mono inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-primary">
                    <Zap className="h-3 w-3" fill="currentColor" /> PLUS
                  </span>
                )}
              </div>
              {/* Handle stays directly under the name, no interruption - the
                  pairing every social app trains people to expect. Tribe
                  gets its own line right after instead of wedging between
                  them. */}
              {profile.handle && (
                <p className="mt-1 truncate text-sm font-medium text-muted-foreground">
                  @{profile.handle.replace(/^@/, "")}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className="label-mono inline-flex items-center gap-1 rounded-full px-1.5 py-0.5"
                  style={{
                    backgroundColor: `color-mix(in oklab, ${tribe.colorVar} 20%, transparent)`,
                    color: tribe.colorVar,
                  }}
                >
                  <TribeMark tribe={tribe} size="xs" decorative={false} />
                  {tribe.name}
                </span>
                {otherTribes.map((t) => (
                  <TribeMark key={t.id} tribe={t} size="xs" decorative={false} />
                ))}
              </div>
            </div>
            {/* Edit profile lives beside the identity it edits, not buried
                below bio/tags/stats - the one action on your own profile
                should be the first thing your thumb finds, not the last. */}
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="shrink-0 rounded-full border border-border px-4 py-2 text-xs font-bold hover:bg-card"
            >
              Edit profile
            </button>
          </div>
          {profile.bio && (
            <p className="mt-5 text-sm font-semibold text-foreground">{profile.bio}</p>
          )}

          {/* Quick facts, Twitter/LinkedIn-style: small muted icon+text right
              under the bio, not bold colorful badges - these are things
              people expect to see immediately, not decoration competing
              with the tags below. Tribe lives up by the name instead (see
              above) - it's MEUTUALS' identity concept, not a plain fact
              like these, so a colored outlier here read as a mistake. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {profile.city || "Somewhere"}
            </span>
            {profile.gender && <span>{optionLabel(GENDER_OPTIONS, profile.gender)}</span>}
          </div>

          {/* Bio and facts flow straight into stats, same as the reference -
              nothing else competes for attention between them. Tags (their
              own labeled sections, not more of the same) come after. */}
          <div className="mt-6 flex items-stretch">
            <Stat label="Moots" value={String(profileStats.data?.moots ?? 0)} />
            <Stat label="Hosted" value={String(profileStats.data?.hosted ?? 0)} />
            <Stat label="Joined" value={String(profileStats.data?.joined ?? 0)} />
          </div>

          {(profile.socialIntents.length > 0 || profile.interests.length > 0) && (
            <div className="mt-6 space-y-4">
              {profile.socialIntents.length > 0 && (
                <div>
                  {/* label-mono + muted, same treatment as the Stat labels
                      above - so the heading recedes and the bold, colorful
                      pills below it read as the actual content instead of
                      competing with it in near-equal weight. */}
                  <p className="label-mono text-muted-foreground">Here for</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {profile.socialIntents.map((intent) => (
                      <ProfileTag
                        key={intent}
                        label={optionLabel(SOCIAL_INTENT_OPTIONS, intent)}
                        accent
                      />
                    ))}
                  </div>
                </div>
              )}
              {profile.interests.length > 0 && (
                <div>
                  <p className="label-mono text-muted-foreground">Interests</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {profile.interests.slice(0, 5).map((interest) => (
                      <ProfileTag key={interest} label={optionLabel(INTEREST_OPTIONS, interest)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {profileCompletion < PROFILE_FIELD_COUNT && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="mt-5 w-full rounded-md border border-primary/40 bg-primary/5 p-3 text-left"
            >
              <div className="flex items-center justify-between text-xs">
                {/* A percentage is a number with no verb — it nags without
                    telling you what to do. The bar still shows progress. */}
                <span className="font-semibold">Finish your profile</span>
                <span className="text-primary">{PROFILE_FIELD_COUNT - profileCompletion} left</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${(profileCompletion / PROFILE_FIELD_COUNT) * 100}%` }}
                />
              </div>
            </button>
          )}
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
            icons undecipherable until you tapped one. Word + icon together
            fixes the "undecipherable" half of that without reintroducing the
            redundant-heading half — full width so each tab gets an equal,
            deliberate target instead of a left-packed cluster. */}
        <div className="mb-5 mt-8 flex border-b border-border">
          <TabBtn icon={Grid3x3} active={gridTab === "posts"} onClick={() => setGridTab("posts")}>
            Posts
          </TabBtn>
          <TabBtn icon={Bookmark} active={gridTab === "saved"} onClick={() => setGridTab("saved")}>
            Saved
          </TabBtn>
          <TabBtn icon={Zap} active={gridTab === "ventures"} onClick={() => setGridTab("ventures")}>
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

      {hasPhotoAvatar && (
        <AvatarLightbox
          open={avatarLightboxOpen}
          onClose={() => setAvatarLightboxOpen(false)}
          src={profile.avatar}
          alt={`${profile.name || "Your"} profile photo`}
        />
      )}
    </div>
  );
}

function TabBtn({
  icon: Icon,
  active,
  onClick,
  children,
}: {
  icon: typeof Bookmark;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-h-11 flex-1 items-center justify-center gap-1.5 pb-2.5 text-xs transition-colors",
        active
          ? "font-bold text-primary shadow-[inset_0_-2px_0_var(--color-primary)]"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 text-center">
      <p className="font-display text-2xl font-bold leading-none tracking-tight tabular-nums">
        {value}
      </p>
      <p className="label-mono mt-2 text-muted-foreground">{label}</p>
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
        Tap Update to refresh it now - it also refreshes automatically each time you open MEUTUALS.
        Other members only ever see a distance band, never your exact coordinates.
      </p>
    </div>
  );
}

function ProfileTag({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold",
        accent ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
      )}
    >
      {label}
    </span>
  );
}

export function EditProfileModal({
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
  const [gender, setGender] = useState<GenderId | null>(profile.gender);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
    const issue = avatarFileIssue(file);
    if (issue === "not-image") {
      toast.error("We couldn't open this photo", {
        description: "Choose a JPG, PNG, WebP, GIF, AVIF, HEIC, or HEIF image.",
      });
      return;
    }
    if (issue === "too-large") {
      toast.error("Image too large", { description: "Please pick an image under 5MB." });
      return;
    }
    setCropFile(file);
  };

  const openAvatarPicker = () => {
    if (uploading) return;
    const input = avatarInputRef.current;
    if (!input) {
      toast.error("Photo picker unavailable", {
        description: "Close Edit profile, reopen it, and try again.",
      });
      return;
    }

    // Clearing first means selecting the same photo again still fires change.
    input.value = "";
    input.click();
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
          <button
            type="button"
            onClick={openAvatarPicker}
            disabled={uploading}
            aria-label="Change profile photo"
            className="relative flex h-24 w-24 items-center justify-center overflow-visible rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-card disabled:cursor-wait"
          >
            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-background text-4xl ring-2 ring-background">
              {isImage ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{avatar}</span>
              )}
            </span>
            {uploading && (
              <span className="absolute inset-0 z-20 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-sm">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={openAvatarPicker}
            disabled={uploading}
            className="mt-3 min-h-11 rounded-xl px-4 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Change photo"}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.avif,.heic,.heif"
            aria-hidden="true"
            tabIndex={-1}
            className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
            onChange={(e) => {
              onPickFile(e.target.files?.[0]);
              e.currentTarget.value = "";
            }}
          />
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
        </div>

        {/* Its own group with a bit more room than the text fields above -
            multi-row pill groups read as cramped at the same tight rhythm
            that works fine for single-line inputs. */}
        <div className="space-y-4 pt-4">
          <GenderSelect value={gender} onChange={setGender} locked={Boolean(profile.gender)} />
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
            onClick={() => {
              // Same "never override a real photo" rule as Onboarding, plus:
              // only apply it the moment gender goes from unset to set, so a
              // person who already replaced the illustration with a real
              // photo doesn't get it silently swapped back on some later
              // unrelated edit.
              const isCustomAvatar = avatar.startsWith("data:") || avatar.startsWith("http");
              const justSetGender = !profile.gender && !!gender;
              const resolvedAvatar =
                !isCustomAvatar && justSetGender
                  ? (defaultAvatarUrl(profile.tribeIds[0] ?? null, gender) ?? avatar)
                  : avatar;
              onSave({
                name: name.trim(),
                handle,
                city: city.trim(),
                bio,
                avatar: resolvedAvatar,
                interests,
                socialIntents,
                availability,
                gender,
              });
            }}
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
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const previewSize = 256;

  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    setZoom(1.15);
    setOffset({ x: 0, y: 0 });
    setImageSize(null);
    setImageLoadFailed(false);
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

    if (typeof img.decode === "function") await img.decode();
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
      throw new Error("This photo format cannot be decoded on this device.");
    }

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
                setImageLoadFailed(false);
                setImageSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
                setOffset({ x: 0, y: 0 });
              }}
              onError={() => {
                setImageLoadFailed(true);
                setImageSize(null);
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                width: previewMetrics ? `${previewMetrics.width}px` : "auto",
                height: previewMetrics ? `${previewMetrics.height}px` : "auto",
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            />
            {imageLoadFailed && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/95 px-6 text-center text-sm text-muted-foreground">
                This photo format cannot be opened on this device. Try a JPG, PNG, or WebP image.
              </div>
            )}
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
            disabled={saving || !imageSize || imageLoadFailed}
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
      <legend className="font-display text-sm font-bold text-foreground">{label}</legend>
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
                "min-h-10 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors active:scale-[0.98]",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground hover:bg-secondary/70",
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
