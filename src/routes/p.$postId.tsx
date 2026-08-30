import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft } from "lucide-react";
import { PostCard } from "@/components/mutuals/PostCard";
import { useAuth } from "@/lib/auth-context";
import { getPostById } from "@/lib/posts.functions";
import { AppBootstrapSkeleton, PostCardSkeleton } from "@/components/mutuals/Skeleton";

interface SharedPostSearch {
  from?: "notifications";
}

export const Route = createFileRoute("/p/$postId")({
  validateSearch: (search: Record<string, unknown>): SharedPostSearch => ({
    from: search.from === "notifications" ? "notifications" : undefined,
  }),
  component: SharedPostPage,
});

function SharedPostPage() {
  const { postId } = Route.useParams();
  const { from } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const getPost = useServerFn(getPostById);
  const postQuery = useQuery({
    queryKey: ["shared-post", postId, user?.id ?? null],
    queryFn: () => getPost({ data: { post_id: postId } }),
    enabled: !!user && !authLoading,
    retry: 1,
  });

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
            MEUTUALS is a 21+ community. Sign in first so post visibility rules can be applied.
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

  const goBack = () => {
    void navigate({ to: from === "notifications" ? "/notifications" : "/" });
  };

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
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="truncate text-center font-display text-sm font-bold">Shared signal</h1>
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
          <PostCard post={postQuery.data} showTribe />
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
