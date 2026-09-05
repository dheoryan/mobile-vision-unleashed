import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { HandIcon } from "@phosphor-icons/react/dist/csr/Hand";
import { ClockIcon } from "@phosphor-icons/react/dist/csr/Clock";
import { MapPinIcon } from "@phosphor-icons/react/dist/csr/MapPin";
import { getProfileByHandle } from "@/lib/profile.functions";
import { usePostsByAuthor, useRepostedPostsByAuthor } from "@/lib/posts-store";
import { useProfileVentureHistory } from "@/lib/ventures-store";
import { useProfileStats, useContactStatus } from "@/lib/social-store";
import { useMyProfile } from "@/lib/profile-store";
import { HelloModal } from "@/components/mutuals/HelloModal";
import { AvatarLightbox } from "@/components/mutuals/AvatarLightbox";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { readableAccentColor, tribeById, type TribeId } from "@/lib/mutuals-data";
import { PlusBadge } from "@/components/mutuals/PlusBadge";
import { SafetyMenu } from "@/components/mutuals/SafetyMenu";
import { showPlusBadge } from "@/lib/feature-flags";
import { intentStore } from "@/lib/intent-store";
import { GENDER_OPTIONS, optionLabel } from "@/lib/profile-options";
import { TribeMark } from "@/components/mutuals/TribeMark";
import {
  AppBootstrapSkeleton,
  CompactListSkeleton,
  FeedSkeleton,
} from "@/components/mutuals/Skeleton";
import {
  ProfileActivityTabs,
  ProfileSignalFilter,
  type ProfileActivityTab,
  type ProfileSignalView,
} from "@/components/mutuals/ProfileActivityTabs";
import { ProfilePostHistory } from "@/components/mutuals/ProfilePostHistory";
import { ProfileVentureHistory } from "@/components/mutuals/ProfileVentureHistory";
import { ProfileVibesPanel } from "@/components/mutuals/ProfileVibesPanel";

export const Route = createFileRoute("/u/$handle")({
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { handle } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const profileFn = useServerFn(getProfileByHandle);

  const profileQ = useQuery({
    queryKey: ["profile-public", handle],
    queryFn: () => profileFn({ data: { handle } }),
    // getProfileByHandle requires auth - without this gate the query fires
    // for a logged-out visitor anyway, fails with an auth error, and
    // profileQ.data comes back undefined exactly like a genuinely unknown
    // handle would, which used to render the same "User not found" for
    // both cases (see the isError check below for the real distinction).
    enabled: !!user && !authLoading,
    staleTime: 30_000,
  });

  const profile = profileQ.data;
  const isMe = !!user && !!profile && profile.id === user.id;

  const postsQ = usePostsByAuthor(profile?.id ?? null);
  const repostsQ = useRepostedPostsByAuthor(profile?.id ?? null);
  const venturesQ = useProfileVentureHistory(profile?.id ?? null);

  const statsQ = useProfileStats(profile?.id ?? null);
  const contact = useContactStatus(isMe ? null : (profile?.id ?? null));
  const [helloOpen, setHelloOpen] = useState(false);
  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false);
  const [activityTab, setActivityTab] = useState<ProfileActivityTab>("signals");
  const [signalView, setSignalView] = useState<ProfileSignalView>("original");
  const myProfile = useMyProfile();
  const sameTribe = !!profile?.tribe_ids?.some((id) => myProfile?.tribeIds.includes(id as TribeId));

  if (authLoading) {
    return <AppBootstrapSkeleton />;
  }

  if (!user) {
    return (
      <div className="bg-habitat flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center">
          <p className="label-mono text-muted-foreground">Shared profile</p>
          <h1 className="mt-2 font-display text-2xl font-bold">Sign in to view this profile.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            MEUTUALS is an 18+ community. Sign in first so profile visibility rules can be applied.
          </p>
          <Link
            to="/login"
            onClick={() =>
              window.sessionStorage.setItem("meutuals:post-login-path", `/u/${handle}`)
            }
            className="mt-5 inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (profileQ.isLoading) {
    return <AppBootstrapSkeleton />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-habitat px-4 text-center">
        <p className="font-display text-xl">
          {profileQ.isError ? "Couldn't load this profile" : "User not found"}
        </p>
        {profileQ.isError && (
          <p className="max-w-xs text-sm text-muted-foreground">
            Something went wrong loading this page. Try again in a moment.
          </p>
        )}
        <Link
          to="/"
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Go home
        </Link>
      </div>
    );
  }

  const primaryId = (profile.tribe_ids?.[0] ?? "wolf") as TribeId;
  const tribe = tribeById(primaryId);
  const otherTribes = (profile.tribe_ids ?? []).slice(1).map((id) => tribeById(id as TribeId));
  const avatar = profile.avatar_url || profile.avatar_emoji || "🌿";
  const isImg = avatar.startsWith("data:") || avatar.startsWith("http");

  return (
    <div className="bg-habitat min-h-screen pb-24">
      <header className="glass sticky top-0 z-20 border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="mx-auto grid min-h-14 max-w-md grid-cols-[1fr_auto_1fr] items-center px-3">
          <Link
            to="/"
            aria-label="Back to MEUTUALS"
            className="flex h-11 w-11 shrink-0 items-center justify-center justify-self-start rounded-full text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <CaretLeftIcon className="h-5 w-5" />
          </Link>
          <p className="truncate text-center font-display text-sm font-bold">
            @{profile.handle?.replace(/^@/, "") ?? "user"}
          </p>
          <div className="flex justify-end">
            {isMe ? (
              <span className="h-11 w-11" aria-hidden />
            ) : (
              <SafetyMenu
                targetName={profile.display_name || profile.handle || "this user"}
                targetUserId={profile.id}
              />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5">
        <section className="relative mt-6">
          <div className="flex items-start gap-5">
            <span className="relative shrink-0">
              {isImg ? (
                <button
                  type="button"
                  onClick={() => setAvatarLightboxOpen(true)}
                  aria-label="View profile photo"
                  className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-card shadow-lg ring-2 focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  style={{ ["--tw-ring-color" as string]: tribe.colorVar }}
                >
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                </button>
              ) : (
                <span
                  className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-card text-5xl shadow-lg ring-2"
                  style={{ ["--tw-ring-color" as string]: tribe.colorVar }}
                >
                  {avatar}
                </span>
              )}
              {showPlusBadge(profile.plan) && <PlusBadge size="md" />}
            </span>
            <div className="min-w-0 flex-1 pt-2">
              <h2 className="font-display text-[26px] font-bold leading-tight">
                {profile.display_name || "Someone"}
              </h2>
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
                    color: readableAccentColor(tribe.colorVar),
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
          </div>
          {profile.bio && (
            <p className="mt-5 text-sm font-semibold text-foreground">{profile.bio}</p>
          )}

          {/* Quick facts, Twitter/LinkedIn-style: small muted icon+text right
              under the bio, not bold colorful badges. Tribe lives up by the
              name instead (see above). Same treatment as your own Profile. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="h-3.5 w-3.5" />
              {profile.city || "Somewhere"}
            </span>
            {profile.gender && <span>{optionLabel(GENDER_OPTIONS, profile.gender)}</span>}
          </div>

          {/* Bio and facts flow straight into stats, same as the reference -
              nothing else competes for attention between them. Tags (their
              own labeled sections) come after the contact action. */}
          <div className="mt-6 flex items-stretch">
            <Stat label="Moots" value={String(statsQ.data?.moots ?? 0)} />
            <Stat label="Hosted" value={String(statsQ.data?.hosted ?? 0)} />
            <Stat label="Joined" value={String(statsQ.data?.joined ?? 0)} />
          </div>

          {!isMe && (
            <div className="mt-4 flex gap-2">
              {/* Private contact outside your Tribe is earned, not assumed.
                  If a DM isn't open yet, the action is a rationed Hello rather
                  than a dead button — showing someone and then hiding them
                  reads as broken. */}
              {contact.data?.can_message !== false ? (
                <button
                  onClick={() => {
                    intentStore.push({ kind: "openThreadWith", userId: profile.id });
                    navigate({ to: "/" });
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border py-3 text-xs font-bold hover:bg-background/60"
                >
                  <ChatCircleIcon className="h-3.5 w-3.5" /> Message
                </button>
              ) : contact.data?.hello_status === "pending" ? (
                <button
                  disabled
                  className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border py-3 text-xs font-bold text-muted-foreground disabled:opacity-70"
                >
                  <ClockIcon className="h-3.5 w-3.5" />
                  {contact.data.awaiting_my_answer ? "Hello received" : "Hello sent"}
                </button>
              ) : contact.data?.hello_status === "declined" ? (
                <button
                  disabled
                  className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border py-3 text-xs font-bold text-muted-foreground disabled:opacity-60"
                >
                  <ChatCircleIcon className="h-3.5 w-3.5" /> Not accepting
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!user) {
                      navigate({ to: "/login" });
                      return;
                    }
                    setHelloOpen(true);
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-primary bg-primary/10 py-2.5 text-xs font-semibold text-primary hover:bg-primary/15"
                >
                  <HandIcon className="h-3.5 w-3.5" /> Say hello
                </button>
              )}
            </div>
          )}
        </section>

        <ProfileActivityTabs value={activityTab} onChange={setActivityTab} />

        {activityTab === "signals" && (
          <>
            <ProfileSignalFilter value={signalView} onChange={setSignalView} />
            {signalView === "original" ? (
              postsQ.isLoading ? (
                <FeedSkeleton count={2} />
              ) : postsQ.isError ? (
                <ProfileActivityError
                  copy="Couldn't load these signals."
                  onRetry={postsQ.refetch}
                />
              ) : (postsQ.data?.length ?? 0) === 0 ? (
                <ProfileActivityEmpty copy="No signals yet." />
              ) : (
                <ProfilePostHistory
                  posts={postsQ.data!}
                  searchPlaceholder="Search signals"
                  noMatchesCopy="No signals match those filters."
                />
              )
            ) : repostsQ.isLoading ? (
              <FeedSkeleton count={2} />
            ) : repostsQ.isError ? (
              <ProfileActivityError
                copy="Couldn't load these reposts."
                onRetry={repostsQ.refetch}
              />
            ) : (repostsQ.data?.length ?? 0) === 0 ? (
              <ProfileActivityEmpty copy="Nothing reposted yet." />
            ) : (
              <ProfilePostHistory
                posts={repostsQ.data!}
                searchPlaceholder="Search reposts"
                noMatchesCopy="No reposts match those filters."
              />
            )}
          </>
        )}

        {activityTab === "ventures" &&
          (venturesQ.isLoading ? (
            <CompactListSkeleton label="Loading Venture history" />
          ) : venturesQ.isError ? (
            <ProfileActivityError
              copy="Couldn't load this Venture history."
              onRetry={venturesQ.refetch}
            />
          ) : (venturesQ.data?.length ?? 0) === 0 ? (
            <ProfileActivityEmpty copy="No Venture history is visible to you yet." />
          ) : (
            <ProfileVentureHistory
              ventures={venturesQ.data!}
              onSelect={() => {
                intentStore.push({ kind: "openTab", tab: "ventures" });
                void navigate({ to: "/" });
              }}
            />
          ))}

        {activityTab === "vibes" && (
          <ProfileVibesPanel
            tribeId={primaryId}
            socialIntents={profile.social_intents}
            interests={profile.interests}
          />
        )}
      </main>

      {profile && (
        <HelloModal
          open={helloOpen}
          onClose={() => setHelloOpen(false)}
          recipientId={profile.id}
          recipientName={profile.display_name?.trim() || "them"}
          hellosLeft={contact.data?.hellos_left_this_month}
          sameTribe={sameTribe}
        />
      )}

      {isImg && (
        <AvatarLightbox
          open={avatarLightboxOpen}
          onClose={() => setAvatarLightboxOpen(false)}
          src={avatar}
          alt={`${profile.display_name || "Their"} profile photo`}
        />
      )}
    </div>
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

function ProfileActivityEmpty({ copy }: { copy: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
      {copy}
    </p>
  );
}

function ProfileActivityError({ copy, onRetry }: { copy: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center">
      <p className="text-xs text-muted-foreground">{copy}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Retry
      </button>
    </div>
  );
}
