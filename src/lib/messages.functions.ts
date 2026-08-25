import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CHAT_REACTIONS,
  emptyChatReactions,
  type ChatReaction,
  type ChatReactionCounts,
} from "@/lib/chat";

export type AuthorLite = {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_emoji: string;
  avatar_url: string | null;
  plan: "free" | "plus";
  city: string;
  tribe_ids: string[];
};

export type DMMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string | null;
  created_at: string;
  read_at: string | null;
  attachment_url: string | null;
  attachment_type: "image" | null;
  reply_to_id: string | null;
  reactions: ChatReactionCounts;
  my_reactions: ChatReaction[];
  reply_to?: Pick<DMMessage, "id" | "sender_id" | "content" | "attachment_type"> | null;
};

export type DMThreadSummary = {
  other_id: string;
  other: AuthorLite | null;
  last_message: DMMessage;
  unread_count: number;
};

const AUTHOR_COLS = "id, display_name, handle, avatar_emoji, avatar_url, plan, city, tribe_ids";
const MESSAGE_COLS =
  "id, sender_id, recipient_id, content, created_at, read_at, attachment_url, attachment_type, reply_to_id";

async function addReactionState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  messages: DMMessage[],
  userId: string,
): Promise<DMMessage[]> {
  const messageIds = messages.map((message) => message.id);
  if (!messageIds.length) return messages;
  const { data, error } = await supabase
    .from("chat_message_reactions")
    .select("message_id, user_id, reaction")
    .eq("channel_kind", "dm")
    .in("message_id", messageIds);
  if (error) throw new Error(error.message);

  const counts = new Map<string, ChatReactionCounts>();
  const mine = new Map<string, ChatReaction[]>();
  for (const row of (data ?? []) as Array<{
    message_id: string;
    user_id: string;
    reaction: ChatReaction;
  }>) {
    if (!CHAT_REACTIONS.includes(row.reaction)) continue;
    const next = counts.get(row.message_id) ?? emptyChatReactions();
    next[row.reaction] += 1;
    counts.set(row.message_id, next);
    if (row.user_id === userId) {
      mine.set(row.message_id, [...(mine.get(row.message_id) ?? []), row.reaction]);
    }
  }

  const byId = new Map(messages.map((message) => [message.id, message]));
  return messages.map((message) => ({
    ...message,
    reactions: counts.get(message.id) ?? emptyChatReactions(),
    my_reactions: mine.get(message.id) ?? [],
    reply_to: message.reply_to_id ? (byId.get(message.reply_to_id) ?? null) : null,
  }));
}

async function fetchProfiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  ids: string[],
): Promise<Map<string, AuthorLite>> {
  const map = new Map<string, AuthorLite>();
  if (!ids.length) return map;
  const { data } = await supabase.from("profiles").select(AUTHOR_COLS).in("id", ids);
  for (const p of (data ?? []) as AuthorLite[]) map.set(p.id, p);
  return map;
}

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("messages")
      .select(MESSAGE_COLS)
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((row) => ({
      ...row,
      reactions: emptyChatReactions(),
      my_reactions: [],
    })) as DMMessage[];

    const byOther = new Map<string, { last: DMMessage; unread: number }>();
    for (const m of rows) {
      const other = m.sender_id === userId ? m.recipient_id : m.sender_id;
      const cur = byOther.get(other);
      if (!cur) byOther.set(other, { last: m, unread: 0 });
      if (m.sender_id !== userId && !m.read_at) {
        const e = byOther.get(other)!;
        e.unread += 1;
      }
    }

    const others = [...byOther.keys()];
    const profiles = await fetchProfiles(supabase, others);
    const out: DMThreadSummary[] = others.map((id) => ({
      other_id: id,
      other: profiles.get(id) ?? null,
      last_message: byOther.get(id)!.last,
      unread_count: byOther.get(id)!.unread,
    }));
    out.sort((a, b) => (a.last_message.created_at < b.last_message.created_at ? 1 : -1));
    return out;
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ other_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("messages")
      .select(MESSAGE_COLS)
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${data.other_id}),and(sender_id.eq.${data.other_id},recipient_id.eq.${userId})`,
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const messages = (rows ?? []).reverse().map((row) => ({
      ...row,
      reactions: emptyChatReactions(),
      my_reactions: [],
    })) as DMMessage[];
    return addReactionState(supabase, messages, userId);
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        recipient_id: z.string().uuid(),
        content: z.string().trim().min(1).max(2000).nullish(),
        attachment_url: z.string().min(1).max(500).nullish(),
        attachment_type: z.literal("image").nullish(),
        reply_to_id: z.string().uuid().nullish(),
      })
      .refine((value) => Boolean(value.content || value.attachment_url), {
        message: "Message text or an attachment is required",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.recipient_id === userId) throw new Error("Can't message yourself");
    if (data.attachment_url && !data.attachment_url.startsWith(`${userId}/dm/`)) {
      throw new Error("Invalid attachment path");
    }
    const { data: row, error } = await supabase
      .from("messages")
      .insert({
        sender_id: userId,
        recipient_id: data.recipient_id,
        content: data.content ?? null,
        attachment_url: data.attachment_url ?? null,
        attachment_type: data.attachment_url ? "image" : null,
        reply_to_id: data.reply_to_id ?? null,
      })
      .select(MESSAGE_COLS)
      .single();
    if (error) throw new Error(error.message);
    return {
      ...(row as Omit<DMMessage, "reactions" | "my_reactions">),
      reactions: emptyChatReactions(),
      my_reactions: [],
    };
  });

export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ other_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("messages")
      .update({ read_at: readAt })
      .eq("recipient_id", userId)
      .eq("sender_id", data.other_id)
      .is("read_at", null);
    if (error) throw new Error(error.message);

    // A DM produces two durable unread records: the message receipt used by
    // Chats and a notification used by the header bell. Reading the thread is
    // the user's acknowledgement of both; leaving the notification unread made
    // the app immediately claim there was still something new to inspect.
    // `message_id is not null` excludes legacy Venture notifications that were
    // once also stored with kind = 'message'.
    const { error: notificationError } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", userId)
      .eq("actor_id", data.other_id)
      .eq("kind", "message")
      .not("message_id", "is", null)
      .is("read_at", null);
    if (notificationError) throw new Error(notificationError.message);

    return { other_id: data.other_id };
  });

export const getProfileById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("profiles")
      .select(AUTHOR_COLS)
      .eq("id", data.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as AuthorLite | null;
  });
