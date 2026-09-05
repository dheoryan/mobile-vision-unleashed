import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { useEffect } from "react";
import { PostCard } from "@/components/mutuals/PostCard";
import { CommentsThread } from "@/components/mutuals/CommentsModal";
import { useAuth } from "@/lib/auth-context";
import { getPostById } from "@/lib/posts.functions";
import { AppBootstrapSkeleton, PostCardSkeleton } from "@/components/mutuals/Skeleton";
import type { TribeId } from "@/lib/mutuals-data";

interface SharedPostSearch {
  from?: "feed" | "notifications";
  comment?: string;
}

export const Route = createFileRoute("/p/$postId")({
  validateSearch: (search: Record<string, unknown>): SharedPostSearch => ({
    from: search.from === "feed" || search.from === "notifications" ? search.from : undefined,
    comment: typeof search.comment === "string" ? search.comment : undefined,
  }),
  component: SharedPostPage,
});

function SharedPostPage() {
  const { postId } = Route.useParams();
  const { from, comment } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const getPost = useServerFn(getPostById);
  const postQuery = useQuery({
    queryKey: ["shared-post", postId, user?.id ?? null],
    queryFn: () => getPost({ data: { post_id: postId } }),
    enabled: !!user && !authLoading,
    retry: 1,
  });

  useEffect(() => {
    if (from !== "feed" || !postQuery.data) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("comments")?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [from, postQuery.data]);

  // A tap on the back button already knew to fall back to an explicit
  // navigate() when there's nothing real to go back to (a shared link
  // opened fresh, or arriving from notifications) - but that logic only
  // ran on click, so a native swipe-back / Android back gesture bypassed it
  // entirely and fell through to the browser's raw default, which could
  // exit the installed app when there was no prior in-app history at all.
  // Injecting a synthetic "parent" entry up front, once, means a plain
  // history.back() lands in the same place either way - the gesture and
  // the button now share one mechanism instead of two that could drift.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (from === "feed" && window.history.length > 1) return;
    const postUrl = window.location.href;
    const parentUrl = from === "notifications" ? "/notifications" : "/";
    window.history.replaceState(window.history.state, "", parentUrl);
    window.history.pushState(window.history.state, "", postUrl);
  }, [postId, from]);

  if (authLoading) {
    return <AppBootstrapSkeleton />;
  }

  if (!user) {
    return (
      <div className="bg-habitat flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center">
          <p className="label-mono text-muted-foreground">Shared signal</p>
          <h1 className="mt-2 font-display text-2xl font-bold">Sign in to view this post.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            MEUTUALS is an 18+ community. Sign in first so post visibility rules can be applied.
          </p>
          <Link
            to="/login"
            onClick={() =>
              window.sessionStorage.setItem("meutuals:post-login-path", `/p/${postId}`)
            }
            className="mt-5 inline-flex rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  // The mount effect above guarantees there's always a sane entry to land
  // on, so a plain back() now does exactly what the old from/length branch
  // used to build by hand - and does it the same way a swipe-back would.
  const goBack = () => window.history.back();

  return (
    <div className="bg-habitat min-h-screen pb-12">
      <header className="glass sticky top-0 z-20 border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="mx-auto grid min-h-14 max-w-md grid-cols-[3rem_1fr_3rem] items-center px-2">
          <button
            type="button"
            onClick={goBack}
            aria-label={from === "notifications" ? "Back to notifications" : "Back to MEUTUALS"}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <CaretLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="truncate text-center font-display text-sm font-bold">Signal Thread</h1>
          <span aria-hidden />
        </div>
      </header>
      <main className="mx-auto max-w-md px-5 pt-4">
        {postQuery.isLoading ? (
          <PostCardSkeleton />
        ) : postQuery.isError ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm">This signal couldn't be loaded.</p>
            <button
              onClick={() => postQuery.refetch()}
              className="mt-3 text-xs font-semibold text-primary underline"
            >
              Try again
            </button>
          </div>
        ) : !postQuery.data ? (
          <CenteredMessage text="This signal is unavailable or outside your audience." />
        ) : (
          <div className="space-y-4">
            <PostCard post={postQuery.data} showTribe commentsInline />
            <CommentsThread
              postId={postQuery.data.id}
              sourceAudience={postQuery.data.audience}
              sourceTribeId={postQuery.data.tribe_id as TribeId}
              highlightCommentId={comment}
              isPostOwner={postQuery.data.author_id === user.id}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
