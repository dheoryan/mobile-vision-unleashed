import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MessageCircle, Hand, Clock, MapPin } from "lucide-react";
import { getProfileByHandle } from "@/lib/profile.functions";
import { listPostsByAuthor } from "@/lib/posts.functions";
import { useProfileStats, useContactStatus } from "@/lib/social-store";
import { useMyProfile } from "@/lib/profile-store";
import { HelloModal } from "@/components/mutuals/HelloModal";
import { AvatarLightbox } from "@/components/mutuals/AvatarLightbox";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { PostCard } from "@/components/mutuals/PostCard";
import { PlusBadge } from "@/components/mutuals/PlusBadge";
import { SafetyMenu } from "@/components/mutuals/SafetyMenu";
import { showPlusBadge } from "@/lib/feature-flags";
import { intentStore } from "@/lib/intent-store";
import {
  GENDER_OPTIONS,
  INTEREST_OPTIONS,
  SOCIAL_INTENT_OPTIONS,
  optionLabel,
} from "@/lib/profile-options";
import { TribeMark } from "@/components/mutuals/TribeMark";
import { AppBootstrapSkeleton, FeedSkeleton } from "@/components/mutuals/Skeleton";

export const Route = createFileRoute("/u/$handle")({
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { handle } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const profileFn = useServerFn(getProfileByHandle);
  const postsFn = useServerFn(listPostsByAuthor);

  const profileQ = useQuery({
    queryKey: ["profile-public", handle],
    queryFn: () => profileFn({ data: { handle } }),
    staleTime: 30_000,
  });

  const profile = profileQ.data;
  const isMe = !!user && !!profile && profile.id === user.id;

  const postsQ = useQuery({
    queryKey: ["posts", "by-author", profile?.id ?? "none"],
    queryFn: () => postsFn({ data: { author_id: profile!.id } }),
    enabled: !!profile?.id,
    staleTime: 15_000,
  });

  const statsQ = useProfileStats(profile?.id ?? null);
  const contact = useContactStatus(isMe ? null : (profile?.id ?? null));
  const [helloOpen, setHelloOpen] = useState(false);
  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false);
  const myProfile = useMyProfile();
  const sameTribe = !!profile?.tribe_ids?.some((id) => myProfile?.tribeIds.includes(id as TribeId));

  if (profileQ.isLoading) {
    return <AppBootstrapSkeleton />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-habitat px-4 text-center">
        <p className="font-display text-xl">User not found</p>
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
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <p className="font-display text-sm font-bold">@{profile.handle ?? "user"}</p>
          {isMe ? (
            <span className="w-10" />
          ) : (
            <SafetyMenu
              targetName={profile.display_name || profile.handle || "this user"}
              targetUserId={profile.id}
            />
          )}
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
          </div>
          {profile.bio && (
            <p className="mt-5 text-sm font-semibold text-foreground">{profile.bio}</p>
          )}

          {/* Quick facts, Twitter/LinkedIn-style: small muted icon+text right
              under the bio, not bold colorful badges. Tribe lives up by the
              name instead (see above). Same treatment as your own Profile. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
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
                  <MessageCircle className="h-3.5 w-3.5" /> Message
                </button>
              ) : contact.data?.hello_status === "pending" ? (
                <button
                  disabled
                  className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border py-3 text-xs font-bold text-muted-foreground disabled:opacity-70"
                >
                  <Clock className="h-3.5 w-3.5" />
                  {contact.data.awaiting_my_answer ? "Hello received" : "Hello sent"}
                </button>
              ) : contact.data?.hello_status === "declined" ? (
                <button
                  disabled
                  className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border py-3 text-xs font-bold text-muted-foreground disabled:opacity-60"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Not accepting
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
                  <Hand className="h-3.5 w-3.5" /> Say hello
                </button>
              )}
            </div>
          )}

          {/* Tags get their own labeled sections after the contact action,
              same as your own Profile - distinct from the facts row above,
              not more of the same. */}
          {(profile.social_intents.length > 0 || profile.interests.length > 0) && (
            <div className="mt-6 space-y-4">
              {profile.social_intents.length > 0 && (
                <div>
                  {/* label-mono + muted, same treatment as the Stat labels
                      above - heading recedes, the bold colorful pills below
                      it read as the content. */}
                  <p className="label-mono text-muted-foreground">Here for</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {profile.social_intents.map((intent) => (
                      <SignalTag
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
                      <SignalTag key={interest} label={optionLabel(INTEREST_OPTIONS, interest)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <h3 className="label-mono mb-5 mt-8">Posts</h3>
        {postsQ.isLoading ? (
          <FeedSkeleton count={2} />
        ) : (postsQ.data?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No posts yet.
          </div>
        ) : (
          <div className="space-y-3">
            {postsQ.data!.map((p) => (
              <PostCard key={p.id} post={p} showTribe />
            ))}
          </div>
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

function SignalTag({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${accent ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}
    >
      {label}
    </span>
  );
}
