import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { PostCard } from "@/components/mutuals/PostCard";
import { useAuth } from "@/lib/auth-context";
import { getPostById } from "@/lib/posts.functions";
import { AppBootstrapSkeleton, PostCardSkeleton } from "@/components/mutuals/Skeleton";

export const Route = createFileRoute("/p/$postId")({
  component: SharedPostPage,
});

function SharedPostPage() {
  const { postId } = Route.useParams();
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

  return (
    <div className="bg-habitat min-h-screen pb-12">
      <header className="glass sticky top-0 z-20 border-b border-border pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-md items-center px-5 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <p className="ml-auto font-display text-sm font-bold">Shared signal</p>
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
