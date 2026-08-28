import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MessageCircle, UserPlus, UserCheck, Loader2, Hand, Clock } from "lucide-react";
import { getProfileByHandle } from "@/lib/profile.functions";
import { listPostsByAuthor } from "@/lib/posts.functions";
import { getFollowCounts } from "@/lib/social.functions";
import {
  useMyFollowing as useFollowing,
  useToggleFollow,
  useContactStatus,
} from "@/lib/social-store";
import { HelloModal } from "@/components/mutuals/HelloModal";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { PostCard } from "@/components/mutuals/PostCard";
import { PlusBadge } from "@/components/mutuals/PlusBadge";
import { SafetyMenu } from "@/components/mutuals/SafetyMenu";
import { showPlusBadge } from "@/lib/feature-flags";
import { intentStore } from "@/lib/intent-store";
import { toast } from "sonner";
import { INTEREST_OPTIONS, SOCIAL_INTENT_OPTIONS, optionLabel } from "@/lib/profile-options";
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
  const countsFn = useServerFn(getFollowCounts);

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

  const countsQ = useQuery({
    queryKey: ["social", "follow-counts", profile?.id ?? "none"],
    queryFn: () => countsFn({ data: { user_id: profile!.id } }),
    enabled: !!profile?.id,
    staleTime: 30_000,
  });

  const followingQ = useFollowing();
  const isFollowing = !!profile && (followingQ.data?.has(profile.id) ?? false);
  const toggleFollow = useToggleFollow();
  const contact = useContactStatus(isMe ? null : (profile?.id ?? null));
  const [helloOpen, setHelloOpen] = useState(false);

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
      <header className="glass sticky top-0 z-20 border-b border-border">
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
        <section className="relative mt-5">
          <div className="flex items-center gap-4">
            <span className="relative">
              <span
                className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md bg-card text-4xl ring-2"
                style={{ ["--tw-ring-color" as string]: tribe.colorVar }}
              >
                {isImg ? (
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  avatar
                )}
              </span>
              {showPlusBadge(profile.plan) && <PlusBadge size="md" />}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-bold leading-tight">
                {profile.display_name || "Someone"}
              </h2>
              {profile.handle && (
                <p className="mt-1 truncate text-sm font-medium text-muted-foreground">
                  @{profile.handle.replace(/^@/, "")}
                </p>
              )}
              {/* Same treatment as your own Profile: one mono line instead of
                  a location paragraph plus a pill. */}
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
          {(profile.social_intents.length > 0 || profile.interests.length > 0) && (
            <div className="mt-4 space-y-2">
              {profile.social_intents.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {profile.social_intents.map((intent) => (
                    <SignalTag
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
                    <SignalTag key={interest} label={optionLabel(INTEREST_OPTIONS, interest)} />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex items-stretch border-y border-border">
            <Stat label="Following" value={String(countsQ.data?.following ?? 0)} />
            <span aria-hidden className="w-px bg-border" />
            <Stat label="Followers" value={String(countsQ.data?.followers ?? 0)} />
            <span aria-hidden className="w-px bg-border" />
            <Stat label="Posts" value={String(postsQ.data?.length ?? 0)} />
          </div>

          {!isMe && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  if (!user) {
                    navigate({ to: "/login" });
                    return;
                  }
                  toggleFollow.mutate(profile.id, {
                    onError: (e) => toast.error((e as Error).message),
                  });
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-3 text-xs font-bold ${isFollowing ? "border border-border bg-background/40 text-foreground" : "bg-primary text-primary-foreground"}`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="h-3.5 w-3.5" /> Following
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3.5 w-3.5" /> Follow
                  </>
                )}
              </button>
              {/* Private contact outside your Tribe is earned, not assumed.
                  If a DM isn't open yet, the action is a one-time Hello rather
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
        />
      )}
    </div>
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

function SignalTag({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${accent ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background/50 text-muted-foreground"}`}
    >
      {label}
    </span>
  );
}
