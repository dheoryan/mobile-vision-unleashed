import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MessageCircle, UserPlus, UserCheck, Loader2 } from "lucide-react";
import { getProfileByHandle } from "@/lib/profile.functions";
import { listPostsByAuthor } from "@/lib/posts.functions";
import { getFollowCounts } from "@/lib/social.functions";
import { useMyFollowing as useFollowing, useToggleFollow } from "@/lib/social-store";
import { useAuth } from "@/lib/auth-context";
import { tribeById, type TribeId } from "@/lib/mutuals-data";
import { PostCard } from "@/components/mutuals/PostCard";
import { TribeBadge } from "@/components/mutuals/Shared";
import { PlusBadge } from "@/components/mutuals/PlusBadge";
import { showPlusBadge } from "@/lib/feature-flags";
import { intentStore } from "@/lib/intent-store";
import { toast } from "sonner";

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

  if (profileQ.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-habitat">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-habitat px-4 text-center">
        <p className="font-display text-xl">User not found</p>
        <Link to="/" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Go home</Link>
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
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <p className="font-display text-sm font-bold">@{profile.handle ?? "user"}</p>
          <span className="w-10" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-5">
        <section
          className="relative mt-4 overflow-hidden rounded-2xl border border-border p-5"
          style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${tribe.colorVar} 35%, var(--card)) 0%, var(--card) 100%)` }}
        >
          <div className="flex items-center gap-4">
            <span className="relative">
              <span
                className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-card text-4xl ring-2"
                style={{ ["--tw-ring-color" as string]: tribe.colorVar }}
              >
                {isImg ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : avatar}
              </span>
              {showPlusBadge(profile.plan) && <PlusBadge size="md" />}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-bold leading-tight">{profile.display_name || "Someone"}</h2>
              <p className="text-xs text-muted-foreground">{profile.city || "Somewhere"}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <TribeBadge name={tribe.name} color={tribe.colorVar} hosted={tribe.hosted} />
                {otherTribes.map((t) => (
                  <span
                    key={t.id}
                    title={t.name}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-sm"
                    style={{ backgroundColor: `color-mix(in oklab, ${t.colorVar} 28%, transparent)` }}
                  >
                    {t.emoji}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {profile.bio && <p className="mt-4 text-sm text-muted-foreground">{profile.bio}</p>}

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Following" value={String(countsQ.data?.following ?? 0)} />
            <Stat label="Followers" value={String(countsQ.data?.followers ?? 0)} />
            <Stat label="Posts" value={String(postsQ.data?.length ?? 0)} />
          </div>

          {!isMe && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  if (!user) { navigate({ to: "/login" }); return; }
                  toggleFollow.mutate(profile.id, {
                    onError: (e) => toast.error((e as Error).message),
                  });
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-semibold ${isFollowing ? "border border-border bg-background/40 text-foreground" : "bg-primary text-primary-foreground"}`}
              >
                {isFollowing ? (<><UserCheck className="h-3.5 w-3.5" /> Following</>) : (<><UserPlus className="h-3.5 w-3.5" /> Follow</>)}
              </button>
              <button
                onClick={() => {
                  intentStore.push({ kind: "openThreadWith", userId: profile.id });
                  navigate({ to: "/" });
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-background/40 py-2.5 text-xs font-semibold hover:bg-background/60"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Message
              </button>
            </div>
          )}
        </section>

        <h3 className="mt-6 mb-3 font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">Posts</h3>
        {postsQ.isLoading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Loading…</p>
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
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background/40 py-2.5">
      <p className="font-display text-lg font-bold">{value}</p>
      <p className="label-mono text-muted-foreground">{label}</p>
    </div>
  );
}
