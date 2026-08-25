import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CHAT_REACTIONS } from "@/lib/chat";

export const toggleChatReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        channel_kind: z.enum(["dm", "venture"]),
        message_id: z.string().uuid(),
        reaction: z.enum(CHAT_REACTIONS),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const match = {
      channel_kind: data.channel_kind,
      message_id: data.message_id,
      user_id: userId,
      reaction: data.reaction,
    };
    const { data: existing, error: readError } = await supabase
      .from("chat_message_reactions")
      .select("message_id")
      .match(match)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    if (existing) {
      const { error } = await supabase.from("chat_message_reactions").delete().match(match);
      if (error) throw new Error(error.message);
      return { active: false };
    }

    const { error } = await supabase.from("chat_message_reactions").insert(match);
    if (error) throw new Error(error.message);
    return { active: true };
  });
