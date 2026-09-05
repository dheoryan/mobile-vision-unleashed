import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emptyTribeRoomReactions, interestedInviteIds } from "@/lib/tribe-room";
import { SHARED_POST_DEFAULT_CAPTION } from "@/lib/chat";
import { planTimeLabel } from "@/lib/venture-time";
import type {
  TribeRoomAuthor,
  TribeRoomItem,
  TribeRoomKind,
  TribeRoomMetadata,
  TribeRoomReaction,
} from "@/lib/tribe-room";

const tribeSchema = z.object({ tribe_key: z.string().trim().min(1).max(40) });
const roomMessageSchema = z.object({
  tribe_key: z.string().trim().min(1).max(40),
  content: z.string().trim().min(1).max(600),
});
const tribePlanTimeOptionSchema = z.object({
  key: z.enum(["time_1", "time_2", "time_3"]),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => !Number.isNaN(new Date(`${value}T12:00:00`).getTime()), "Invalid plan date"),
  period: z.enum(["morning", "afternoon", "evening"]),
});

async function resolveMemberTribe(
  // TanStack's authenticated Supabase client is structurally typed at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  tribeKey: string,
) {
  const { data: tribe, error: tribeError } = await supabase
    .from("tribes")
    .select("id, key")
    .eq("key", tribeKey)
    .maybeSingle();
  if (tribeError) throw new Error(tribeError.message);
  if (!tribe?.id || !tribe.key) throw new Error("Tribe not found");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tribe_ids")
    .eq("id", userId)
    .single();
  if (profileError) throw new Error(profileError.message);
  if (!Array.isArray(profile?.tribe_ids) || !profile.tribe_ids.includes(tribe.key)) {
    throw new Error("Join this Tribe to use its room");
  }
  return tribe as { id: string; key: string };
}

const TRIBE_MESSAGE_COLS =
  "id, tribe_id, sender_id, content, attachment_url, attachment_type, reply_to_id, mentions, created_at, room_kind, edited_at, deleted_at, shared_post_id";

// shared_post_id/edited_at/deleted_at aren't in the generated Database
// types yet - same "migration is live, types.ts hasn't caught up"
// situation as messagesTable() in messages.functions.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tribeMessagesTable(supabase: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase.from("tribe_messages") as any;
}

const sendTribeMessageSchema = z
  .object({
    tribe_key: z.string().trim().min(1).max(40),
    content: z.string().trim().max(2000).nullish(),
    attachment_url: z.string().min(1).max(500).nullish(),
    attachment_type: z.literal("image").nullish(),
    reply_to_id: z.string().uuid().nullish(),
    mentions: z.array(z.string().uuid()).max(20).optional().default([]),
  })
  .refine((value) => Boolean(value.content?.trim() || value.attachment_url), {
    message: "Message text or an attachment is required",
  });

// Tribe chat's send/edit/unsend used to be raw client-side Supabase calls
// with no server function at all - unlike DM and Venture, which both
// validate content through a Zod schema capped at 2000 characters matching
// their own DB CHECK constraint. Tribe's DB-side constraint has no upper
// bound at all, so before this there was no message-length limit anywhere
// in the stack for this one surface. This app-layer cap is deliberately
// not paired with a matching DB migration: this table's CHECK constraints
// have already diverged from what's tracked in this repo twice this
// session in ways discovered only by production errors (see the
// 20260904020000/20260904030000 unsend fixes) - touching them again on a
// guess is exactly the risk that cost two rounds last time.
export const sendTribeMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sendTribeMessageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tribe = await resolveMemberTribe(supabase, userId, data.tribe_key);
    const { data: row, error } = await tribeMessagesTable(supabase)
      .insert({
        tribe_id: tribe.id,
        sender_id: userId,
        // Empty string, not null - tribe_messages.content is NOT NULL in
        // production (an untracked divergence found this session), and an
        // image-only message with no caption is a real, supported case.
        content: data.content?.trim() ?? "",
        attachment_url: data.attachment_url ?? null,
        attachment_type: data.attachment_url ? "image" : null,
        reply_to_id: data.reply_to_id ?? null,
        mentions: data.mentions ?? [],
        room_kind: null,
      })
      .select(TRIBE_MESSAGE_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const editTribeMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), content: z.string().trim().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // enforce_tribe_message_edit_fields (20260904010000) is the real gate -
    // sender-only, blocks structured Room items and an already-unsent
    // message, stamps edited_at. Same reliance already used by
    // editMessage/unsendMessage in messages.functions.ts.
    const { data: row, error } = await tribeMessagesTable(supabase)
      .update({ content: data.content })
      .eq("id", data.id)
      .select(TRIBE_MESSAGE_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const unsendTribeMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await tribeMessagesTable(supabase)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id)
      .select(TRIBE_MESSAGE_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listTribeRoom = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => tribeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tribe = await resolveMemberTribe(supabase, userId, data.tribe_key);
    const { data: rows, error } = await supabase
      .from("tribe_messages")
      .select("id, tribe_id, sender_id, content, created_at, reply_to_id, room_kind, room_metadata")
      .eq("tribe_id", tribe.id)
      .not("room_kind", "is", null)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);

    const messageRows = (rows ?? []) as Array<{
      id: string;
      tribe_id: string;
      sender_id: string;
      content: string | null;
      created_at: string;
      reply_to_id: string | null;
      room_kind: TribeRoomKind;
      room_metadata: TribeRoomMetadata | null;
    }>;
    const senderIds = [...new Set(messageRows.map((row) => row.sender_id))];
    const messageIds = messageRows.map((row) => row.id);
    const ventureIds = messageRows.flatMap((row) => {
      const id = row.room_metadata?.venture_id;
      return typeof id === "string" ? [id] : [];
    });

    const [profilesResult, reactionsResult, readResult, venturesResult] = await Promise.all([
      senderIds.length
        ? supabase
            .from("profiles")
            .select("id, display_name, handle, avatar_url")
            .in("id", senderIds)
        : Promise.resolve({ data: [], error: null }),
      messageIds.length
        ? supabase
            .from("tribe_room_reactions")
            .select("message_id, user_id, reaction")
            .in("message_id", messageIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("tribe_room_reads")
        .select("last_read_at")
        .eq("tribe_id", tribe.id)
        .eq("user_id", userId)
        .maybeSingle(),
      ventureIds.length
        ? supabase
            .from("ventures")
            .select("id, status, filled_slots, max_slots, starts_at, ended_at, closed_at")
            .in("id", ventureIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error) throw new Error(profilesResult.error.message);
    if (reactionsResult.error) throw new Error(reactionsResult.error.message);
    if (readResult.error) throw new Error(readResult.error.message);
    if (venturesResult.error) throw new Error(venturesResult.error.message);

    const authors = new Map<string, TribeRoomAuthor>();
    for (const profile of (profilesResult.data ?? []) as TribeRoomAuthor[]) {
      authors.set(profile.id, profile);
    }

    const reactionCounts = new Map<string, Record<TribeRoomReaction, number>>();
    const mine = new Map<string, TribeRoomReaction[]>();
    for (const row of (reactionsResult.data ?? []) as Array<{
      message_id: string;
      user_id: string;
      reaction: TribeRoomReaction;
    }>) {
      const counts = reactionCounts.get(row.message_id) ?? emptyTribeRoomReactions();
      counts[row.reaction] += 1;
      reactionCounts.set(row.message_id, counts);
      if (row.user_id === userId) {
        mine.set(row.message_id, [...(mine.get(row.message_id) ?? []), row.reaction]);
      }
    }

    const ventures = new Map<string, TribeRoomMetadata>();
    for (const venture of (venturesResult.data ?? []) as Array<TribeRoomMetadata>) {
      if (typeof venture.id === "string") ventures.set(venture.id, venture);
    }

    const items: TribeRoomItem[] = messageRows.reverse().map((row) => ({
      id: row.id,
      tribe_id: row.tribe_id,
      sender_id: row.sender_id,
      content: row.content ?? "",
      created_at: row.created_at,
      reply_to_id: row.reply_to_id,
      room_kind: row.room_kind,
      room_metadata: (() => {
        const metadata = row.room_metadata ?? {};
        const ventureId = metadata.venture_id;
        const venture = typeof ventureId === "string" ? ventures.get(ventureId) : undefined;
        return venture ? { ...metadata, venture } : metadata;
      })(),
      author: authors.get(row.sender_id) ?? null,
      reactions: reactionCounts.get(row.id) ?? emptyTribeRoomReactions(),
      my_reactions: mine.get(row.id) ?? [],
    }));

    return {
      tribe_id: tribe.id,
      items,
      last_read_at: readResult.data?.last_read_at ?? null,
    };
  });

/**
 * Backs the streak badge. Deliberately returns only a count per prompt id,
 * never the answer content or who wrote it - the generic room feed already
 * carries that, capped at 60 items total across every kind, which is not
 * enough to reliably answer "did the room answer on each of the last N
 * days" once a tribe is chatty. This is its own cheap query so the streak
 * stays correct independent of how much Chat/Plan/Venture traffic pushed
 * older Tribevia answers out of that shared window.
 */
export const getTribePulseStreak = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => tribeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tribe = await resolveMemberTribe(supabase, userId, data.tribe_key);
    const since = new Date();
    since.setDate(since.getDate() - 31);
    const { data: rows, error } = await supabase
      .from("tribe_messages")
      .select("room_metadata")
      .eq("tribe_id", tribe.id)
      .eq("room_kind", "pulse_answer")
      .gte("created_at", since.toISOString());
    if (error) throw new Error(error.message);

    const counts: Record<string, number> = {};
    for (const row of (rows ?? []) as Array<{ room_metadata: TribeRoomMetadata | null }>) {
      const promptId = row.room_metadata?.prompt_id;
      if (typeof promptId === "string") counts[promptId] = (counts[promptId] ?? 0) + 1;
    }
    return { counts };
  });

/**
 * Fires once per tribe per day, whichever member happens to open the room
 * first - there is no cron in this stack, so "a new day started" has no
 * database row to hang a trigger off. The SQL side re-checks membership and
 * de-dupes on the exact prompt id, so a race between several members'
 * devices, or a client retrying, can never fan out twice or reach a tribe
 * this caller isn't in.
 */
export const notifyTribePulse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tribe_key: z.string().trim().min(1).max(40),
        prompt_id: z.string().trim().min(1).max(160),
        preview: z.string().trim().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await resolveMemberTribe(supabase, userId, data.tribe_key);
    const { data: notifiedCount, error } = await supabase.rpc("fan_out_tribe_pulse_notification", {
      p_tribe_key: data.tribe_key,
      p_prompt_id: data.prompt_id,
      p_preview: data.preview,
    });
    if (error) throw new Error(error.message);
    return { notified_count: (notifiedCount as number | null) ?? 0 };
  });

export const answerDailyPulse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    roomMessageSchema
      .extend({
        prompt_id: z.string().trim().min(1).max(120),
        prompt: z.string().trim().min(1).max(240),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tribe = await resolveMemberTribe(supabase, userId, data.tribe_key);

    const { data: existing, error: existingError } = await supabase
      .from("tribe_messages")
      .select("id")
      .eq("tribe_id", tribe.id)
      .eq("sender_id", userId)
      .eq("room_kind", "pulse_answer")
      .contains("room_metadata", { prompt_id: data.prompt_id })
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) throw new Error("You already answered today's Tribevia");

    const { data: row, error } = await supabase
      .from("tribe_messages")
      .insert({
        tribe_id: tribe.id,
        sender_id: userId,
        content: data.content,
        room_kind: "pulse_answer",
        room_metadata: { prompt_id: data.prompt_id, prompt: data.prompt },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const createTribePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tribe_key: z.string().trim().min(1).max(40),
        title: z.string().trim().min(3).max(80),
        note: z.string().trim().max(280).default(""),
        timing_mode: z.enum(["single", "poll"]),
        time_options: z.array(tribePlanTimeOptionSchema).min(1).max(3),
        area: z.string().trim().min(2).max(120),
        max_slots: z.number().int().min(2).max(20),
      })
      .superRefine((value, context) => {
        const expected = value.time_options.map((_option, index) => `time_${index + 1}`);
        if (value.time_options.some((option, index) => option.key !== expected[index])) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["time_options"],
            message: "Time options must use stable ordered keys",
          });
        }
        const distinctTimes = new Set(
          value.time_options.map((option) => `${option.day}:${option.period}`),
        );
        if (distinctTimes.size !== value.time_options.length) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["time_options"],
            message: "Each plan option must use a different date or time window",
          });
        }
        if (value.timing_mode === "single" && value.time_options.length !== 1) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["time_options"],
            message: "A single plan needs one time option",
          });
        }
        if (value.timing_mode === "poll" && value.time_options.length < 2) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["time_options"],
            message: "An availability poll needs at least two options",
          });
        }
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tribe = await resolveMemberTribe(supabase, userId, data.tribe_key);
    const { data: row, error } = await supabase
      .from("tribe_messages")
      .insert({
        tribe_id: tribe.id,
        sender_id: userId,
        content: data.title,
        room_kind: "plan",
        room_metadata: {
          note: data.note,
          timing_mode: data.timing_mode,
          when_label:
            data.timing_mode === "poll"
              ? `${data.time_options.length} times · choose together`
              : planTimeLabel(data.time_options[0].day, data.time_options[0].period),
          time_options: data.time_options,
          area: data.area,
          max_slots: data.max_slots,
        },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, tribe_id: tribe.id };
  });

/**
 * Plans live as `room_kind: "plan"` rows, which the regular Chat tab never
 * shows (it only renders `room_kind IS NULL` rows). This lets the plan's own
 * host drop a plain chat message pointing at it, so members who only check
 * Chat still hear about it. Anyone else calling this for a plan they don't
 * own is rejected - it's an announcement, not a general share button.
 */
export const shareTribePlanToChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tribe_key: z.string().trim().min(1).max(40),
        message_id: z.string().uuid(),
        preview: z.string().trim().min(1).max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tribe = await resolveMemberTribe(supabase, userId, data.tribe_key);
    const { data: source, error: sourceError } = await supabase
      .from("tribe_messages")
      .select("id, sender_id, room_kind")
      .eq("id", data.message_id)
      .eq("tribe_id", tribe.id)
      .single();
    if (sourceError) throw new Error(sourceError.message);
    if (source.room_kind !== "plan" || source.sender_id !== userId) {
      throw new Error("Only the plan's host can share it to chat");
    }

    const { error } = await supabase.from("tribe_messages").insert({
      tribe_id: tribe.id,
      sender_id: userId,
      content: data.preview,
      room_kind: null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sharePostToTribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tribe_key: z.string().trim().min(1).max(40),
        post_id: z.string().uuid(),
        caption: z.string().trim().max(600).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tribe = await resolveMemberTribe(supabase, userId, data.tribe_key);
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id, audience, tribe_id")
      .eq("id", data.post_id)
      .maybeSingle();
    if (postError) throw new Error(postError.message);
    if (!post) throw new Error("This post is no longer available");

    // Same guardrail as sharePostToDM / quoting a post into another post -
    // a Tribe-only post can only be shared within that same Tribe's own
    // chat, never forwarded into a different one.
    if (post.audience === "tribe" && post.tribe_id !== tribe.key) {
      throw new Error("This Tribe-only post can only be shared within its own Tribe");
    }

    const { error } = await tribeMessagesTable(supabase).insert({
      tribe_id: tribe.id,
      sender_id: userId,
      content: data.caption?.trim() || SHARED_POST_DEFAULT_CAPTION,
      shared_post_id: data.post_id,
      room_kind: null,
    });
    if (error) throw new Error(error.message);

    // Same shares_count bookkeeping as sharePostToDM (messages.functions.ts)
    // - a `shares` row per person who has ever shared the post, upserted
    // rather than toggled so a second share never undoes the count, and
    // best-effort since this shouldn't roll back a message that already sent.
    await supabase
      .from("shares")
      .upsert(
        { post_id: data.post_id, user_id: userId },
        { onConflict: "user_id,post_id", ignoreDuplicates: true },
      )
      .then(({ error: shareError }) => {
        if (shareError) console.warn("[sharePostToTribe] shares upsert failed", shareError.message);
      });

    return { ok: true };
  });

export const toggleTribeRoomReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        message_id: z.string().uuid(),
        reaction: z.enum([
          "spark",
          "interested",
          "heart",
          "laugh",
          "wow",
          "sad",
          "like",
          "support",
          "time_1",
          "time_2",
          "time_3",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing, error: readError } = await supabase
      .from("tribe_room_reactions")
      .select("message_id")
      .eq("message_id", data.message_id)
      .eq("user_id", userId)
      .eq("reaction", data.reaction)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    if (existing) {
      const { error } = await supabase
        .from("tribe_room_reactions")
        .delete()
        .eq("message_id", data.message_id)
        .eq("user_id", userId)
        .eq("reaction", data.reaction);
      if (error) throw new Error(error.message);
      return { active: false };
    }

    const { error } = await supabase.from("tribe_room_reactions").insert({
      message_id: data.message_id,
      user_id: userId,
      reaction: data.reaction,
    });
    if (error) throw new Error(error.message);
    return { active: true };
  });

export const markTribeRoomRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => tribeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tribe = await resolveMemberTribe(supabase, userId, data.tribe_key);
    const { error } = await supabase.from("tribe_room_reads").upsert(
      {
        tribe_id: tribe.id,
        user_id: userId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "tribe_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const announceTribeVenture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tribe_key: z.string().trim().min(1).max(40),
        source_message_id: z.string().uuid(),
        venture_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tribe = await resolveMemberTribe(supabase, userId, data.tribe_key);
    const [{ data: source, error: sourceError }, { data: venture, error: ventureError }] =
      await Promise.all([
        supabase
          .from("tribe_messages")
          .select("id, sender_id, room_kind")
          .eq("id", data.source_message_id)
          .eq("tribe_id", tribe.id)
          .single(),
        supabase
          .from("ventures")
          .select("id, user_id, title, starts_at, max_slots")
          .eq("id", data.venture_id)
          .single(),
      ]);
    if (sourceError) throw new Error(sourceError.message);
    if (ventureError) throw new Error(ventureError.message);
    if (
      (source.room_kind !== "plan" && source.room_kind !== "pulse_answer") ||
      source.sender_id !== userId
    ) {
      throw new Error("Only the original author can turn this into a Venture");
    }
    if (venture.user_id !== userId) throw new Error("Only the Venture host can announce it");

    // A plan/pulse-answer converts into at most one announced Venture, ever
    // - checked here, before any invite is written, and keyed on the
    // *source message*, not the venture_id this call was given. That
    // matters for a very real failure mode: if a first announce attempt
    // fails after already inserting invites (network drop between that
    // step and the message-insert below) but the client only shows a
    // generic "Venture is live, but the card wasn't posted" toast with no
    // targeted retry, the only recovery path visible in the UI is redoing
    // the whole flow - which creates a second, brand-new Venture and would
    // call this function again with a *different* venture_id. The old
    // dedupe check here was keyed on room_metadata's venture_id, so it
    // never recognized that retry as a repeat and re-invited everyone who
    // marked Interested a second time, to a second Venture thread. Keying
    // on reply_to_id instead means any retry against the same source stops
    // here, before touching invites, regardless of which venture_id it was
    // called with - the cost is that a genuinely new venture created by
    // that retry stays un-announced, which is a much smaller problem than
    // silently double-inviting real members.
    const { data: existingForSource, error: existingForSourceError } = await supabase
      .from("tribe_messages")
      .select("id")
      .eq("tribe_id", tribe.id)
      .eq("room_kind", "venture")
      .eq("reply_to_id", source.id)
      .maybeSingle();
    if (existingForSourceError) throw new Error(existingForSourceError.message);
    if (existingForSource) return { id: existingForSource.id, invited_count: 0 };

    // "Interested" is explicit consent to receive an invitation, not consent
    // to be joined automatically. Translate those reactions into durable
    // invited applications. Existing applications are never overwritten: a
    // pending request, acceptance, decline, or earlier invite keeps its state.
    //
    // A Tribevia answer never collected an "interested" reaction - "spark" is
    // the only signal it has, so it stands in as the same consent for that
    // source kind rather than requiring a whole second reaction just for this.
    const interestReaction = source.room_kind === "pulse_answer" ? "spark" : "interested";
    const { data: interestRows, error: interestError } = await supabase
      .from("tribe_room_reactions")
      .select("user_id")
      .eq("message_id", source.id)
      .eq("reaction", interestReaction)
      .neq("user_id", userId);
    if (interestError) throw new Error(interestError.message);

    const interestedIds = [
      ...new Set((interestRows ?? []).map((row: { user_id: string }) => row.user_id)),
    ];
    let invitedCount = 0;
    if (interestedIds.length > 0) {
      const { data: existingApplications, error: applicationsError } = await supabase
        .from("venture_applications")
        .select("applicant_id")
        .eq("venture_id", venture.id)
        .in("applicant_id", interestedIds);
      if (applicationsError) throw new Error(applicationsError.message);

      const invitations = interestedInviteIds(
        interestedIds,
        (existingApplications ?? []).map((row: { applicant_id: string }) => row.applicant_id),
        userId,
      ).map((applicantId) => ({
        venture_id: venture.id,
        applicant_id: applicantId,
        status: "invited",
        message: "Interested in the Tribe plan",
      }));

      if (invitations.length > 0) {
        const { error: inviteError } = await supabase
          .from("venture_applications")
          .insert(invitations);
        if (inviteError) throw new Error(inviteError.message);
        invitedCount = invitations.length;
      }
    }

    const { data: row, error } = await supabase
      .from("tribe_messages")
      .insert({
        tribe_id: tribe.id,
        sender_id: userId,
        content: venture.title,
        room_kind: "venture",
        reply_to_id: source.id,
        room_metadata: {
          venture_id: venture.id,
          starts_at: venture.starts_at,
          max_slots: venture.max_slots,
        },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, invited_count: invitedCount };
  });
