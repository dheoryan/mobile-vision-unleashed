import { useSyncExternalStore } from "react";
import { POSTS, type Post, type TribeId } from "./mutuals-data";

export interface Comment {
  id: string;
  authorId: string; // person id or "me"
  text: string;
  time: string;
}

interface State {
  posts: Post[];
  liked: Set<string>;          // post ids the user has liked
  comments: Record<string, Comment[]>;
  following: Set<string>;      // user ids the current user follows
}

let state: State = {
  posts: POSTS.slice(),
  liked: new Set(),
  comments: {
    p1: [{ id: "c1", authorId: "u7", text: "I'll be there 6am sharp.", time: "5m" }],
    p3: [
      { id: "c1", authorId: "u8", text: "I'm in. Sundays?", time: "10m" },
      { id: "c2", authorId: "u5", text: "Save me a slot.", time: "8m" },
    ],
    p4: [{ id: "c1", authorId: "u5", text: "Pulling up around 9.", time: "20m" }],
  },
  following: new Set(),
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const socialStore = {
  get: () => state,
  subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },

  toggleLike: (postId: string) => {
    const liked = new Set(state.liked);
    const posts = state.posts.map((p) => {
      if (p.id !== postId) return p;
      if (liked.has(postId)) {
        liked.delete(postId);
        return { ...p, likes: p.likes - 1, liked: false };
      } else {
        liked.add(postId);
        return { ...p, likes: p.likes + 1, liked: true };
      }
    });
    state = { ...state, liked, posts };
    emit();
  },

  addComment: (postId: string, text: string) => {
    const c: Comment = { id: `c-${Date.now()}`, authorId: "me", text, time: "now" };
    const comments = { ...state.comments, [postId]: [...(state.comments[postId] ?? []), c] };
    const posts = state.posts.map((p) => p.id === postId ? { ...p, replies: p.replies + 1 } : p);
    state = { ...state, comments, posts };
    emit();
  },

  addPost: (tribeId: TribeId, content: string, authorId = "me", imageUrl?: string) => {
    const post: Post = {
      id: `p-${Date.now()}`,
      authorId,
      tribeId,
      time: "now",
      content,
      likes: 0,
      replies: 0,
      ...(imageUrl ? { imageUrl } : {}),
    };
    state = { ...state, posts: [post, ...state.posts] };
    emit();
  },

  editPost: (postId: string, content: string, imageUrl?: string | null) => {
    const posts = state.posts.map((p) => {
      if (p.id !== postId) return p;
      const next: Post = { ...p, content };
      if (imageUrl === null) delete next.imageUrl;
      else if (typeof imageUrl === "string") next.imageUrl = imageUrl;
      return next;
    });
    state = { ...state, posts };
    emit();
  },

  deletePost: (postId: string) => {
    const posts = state.posts.filter((p) => p.id !== postId);
    const { [postId]: _drop, ...comments } = state.comments;
    void _drop;
    const liked = new Set(state.liked); liked.delete(postId);
    state = { ...state, posts, comments, liked };
    emit();
  },

  toggleFollow: (userId: string) => {
    const following = new Set(state.following);
    following.has(userId) ? following.delete(userId) : following.add(userId);
    state = { ...state, following };
    emit();
  },
};

export function useSocial() {
  return useSyncExternalStore(socialStore.subscribe, socialStore.get, socialStore.get);
}
