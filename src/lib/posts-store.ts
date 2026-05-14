import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  editPost,
  listComments,
  listFeed,
  listMyPosts,
  type CommentRow,
  type FeedPost,
} from "@/lib/posts.functions";
import { useAuth } from "@/lib/auth-context";

export type { FeedPost, CommentRow } from "@/lib/posts.functions";

const FEED_KEY = ["posts", "feed"] as const;
const MINE_KEY = ["posts", "mine"] as const;
const COMMENTS_KEY = (postId: string) => ["comments", postId] as const;

export function useFeedPosts(tribeId?: string) {
  const fn = useServerFn(listFeed);
  return useQuery({
    queryKey: [...FEED_KEY, tribeId ?? "all"],
    queryFn: () => fn({ data: tribeId ? { tribe_id: tribeId } : {} }),
    staleTime: 15_000,
  });
}

export function useMyPosts() {
  const fn = useServerFn(listMyPosts);
  const { user } = useAuth();
  return useQuery({
    queryKey: [...MINE_KEY, user?.id ?? null],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 15_000,
  });
}

function invalidateAllPostLists(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["posts"] });
}

function patchListsWith(
  qc: ReturnType<typeof useQueryClient>,
  fn: (rows: FeedPost[]) => FeedPost[],
) {
  qc.getQueriesData<FeedPost[]>({ queryKey: ["posts"] }).forEach(([key, data]) => {
    if (!data) return;
    qc.setQueryData(key, fn(data));
  });
}

export function useCreatePost() {
  const fn = useServerFn(createPost);
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: { tribe_id: string; content: string; image_url?: string | null }) =>
      fn({ data: input }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["posts"] });
      const tempId = `tmp-${Date.now()}`;
      const optimistic: FeedPost = {
        id: tempId,
        author_id: user?.id ?? "me",
        tribe_id: input.tribe_id,
        content: input.content,
        image_url: input.image_url ?? null,
        tag: null,
        likes_count: 0,
        replies_count: 0,
        shares_count: 0,
        created_at: new Date().toISOString(),
        author: null,
      };
      patchListsWith(qc, (rows) => [optimistic, ...rows]);
      return { tempId };
    },
    onSuccess: (saved, _input, ctx) => {
      patchListsWith(qc, (rows) =>
        rows.map((p) => (p.id === ctx?.tempId ? saved : p)),
      );
    },
    onError: (_e, _i, ctx) => {
      if (ctx?.tempId) {
        patchListsWith(qc, (rows) => rows.filter((p) => p.id !== ctx.tempId));
      }
    },
    onSettled: () => invalidateAllPostLists(qc),
  });
}

export function useEditPost() {
  const fn = useServerFn(editPost);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; content: string; image_url?: string | null }) =>
      fn({ data: input }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["posts"] });
      const snapshot: FeedPost[] = [];
      patchListsWith(qc, (rows) =>
        rows.map((p) => {
          if (p.id !== input.id) return p;
          snapshot.push(p);
          return {
            ...p,
            content: input.content,
            image_url: input.image_url === undefined ? p.image_url : input.image_url,
          };
        }),
      );
      return { snapshot };
    },
    onError: (_e, _i, ctx) => {
      if (!ctx) return;
      patchListsWith(qc, (rows) =>
        rows.map((p) => ctx.snapshot.find((s) => s.id === p.id) ?? p),
      );
    },
    onSettled: () => invalidateAllPostLists(qc),
  });
}

export function useDeletePost() {
  const fn = useServerFn(deletePost);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }) => fn({ data: input }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["posts"] });
      const removed: FeedPost[] = [];
      patchListsWith(qc, (rows) =>
        rows.filter((p) => {
          if (p.id === input.id) {
            removed.push(p);
            return false;
          }
          return true;
        }),
      );
      return { removed };
    },
    onError: (_e, _i, ctx) => {
      if (!ctx?.removed.length) return;
      patchListsWith(qc, (rows) => [...ctx.removed, ...rows]);
    },
    onSettled: () => invalidateAllPostLists(qc),
  });
}

export function useComments(postId: string | null) {
  const fn = useServerFn(listComments);
  return useQuery({
    queryKey: COMMENTS_KEY(postId ?? "none"),
    queryFn: () => fn({ data: { post_id: postId! } }),
    enabled: !!postId && !postId.startsWith("tmp-"),
    staleTime: 10_000,
  });
}

export function useAddComment(postId: string) {
  const fn = useServerFn(addComment);
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (content: string) => fn({ data: { post_id: postId, content } }),
    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey: COMMENTS_KEY(postId) });
      const tempId = `tmp-${Date.now()}`;
      const optimistic: CommentRow = {
        id: tempId,
        post_id: postId,
        author_id: user?.id ?? "me",
        content,
        created_at: new Date().toISOString(),
        author: null,
      };
      qc.setQueryData<CommentRow[]>(COMMENTS_KEY(postId), (cur) => [
        ...(cur ?? []),
        optimistic,
      ]);
      patchListsWith(qc, (rows) =>
        rows.map((p) => (p.id === postId ? { ...p, replies_count: p.replies_count + 1 } : p)),
      );
      return { tempId };
    },
    onSuccess: (saved, _i, ctx) => {
      qc.setQueryData<CommentRow[]>(COMMENTS_KEY(postId), (cur) =>
        (cur ?? []).map((c) => (c.id === ctx?.tempId ? saved : c)),
      );
      patchListsWith(qc, (rows) =>
        rows.map((p) => (p.id === postId ? { ...p, replies_count: saved.replies_count } : p)),
      );
    },
    onError: (_e, _i, ctx) => {
      qc.setQueryData<CommentRow[]>(COMMENTS_KEY(postId), (cur) =>
        (cur ?? []).filter((c) => c.id !== ctx?.tempId),
      );
      patchListsWith(qc, (rows) =>
        rows.map((p) =>
          p.id === postId ? { ...p, replies_count: Math.max(p.replies_count - 1, 0) } : p,
        ),
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: COMMENTS_KEY(postId) });
    },
  });
}

export function useDeleteComment(postId: string) {
  const fn = useServerFn(deleteComment);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: COMMENTS_KEY(postId) });
      let removed: CommentRow | undefined;
      qc.setQueryData<CommentRow[]>(COMMENTS_KEY(postId), (cur) =>
        (cur ?? []).filter((c) => {
          if (c.id === id) { removed = c; return false; }
          return true;
        }),
      );
      patchListsWith(qc, (rows) =>
        rows.map((p) =>
          p.id === postId ? { ...p, replies_count: Math.max(p.replies_count - 1, 0) } : p,
        ),
      );
      return { removed };
    },
    onError: (_e, _i, ctx) => {
      if (!ctx?.removed) return;
      const r = ctx.removed;
      qc.setQueryData<CommentRow[]>(COMMENTS_KEY(postId), (cur) => [...(cur ?? []), r]);
      patchListsWith(qc, (rows) =>
        rows.map((p) => (p.id === postId ? { ...p, replies_count: p.replies_count + 1 } : p)),
      );
    },
    onSuccess: (result) => {
      patchListsWith(qc, (rows) =>
        rows.map((p) =>
          p.id === result.post_id ? { ...p, replies_count: result.replies_count } : p,
        ),
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: COMMENTS_KEY(postId) });
    },
  });
}
