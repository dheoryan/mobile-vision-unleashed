import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_PUSH_PREFERENCES,
  PUSH_PREFERENCE_KEYS,
  type PushPreferenceKey,
  type PushPreferences,
} from "@/lib/push-preferences";

const preferenceKeySchema = z.enum(PUSH_PREFERENCE_KEYS);

function toPreferences(row: Partial<PushPreferences> | null): PushPreferences {
  return { ...DEFAULT_PUSH_PREFERENCES, ...row };
}

export const getMyPushPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.undefined().parse(input))
  .handler(async ({ context }): Promise<PushPreferences> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("push_notification_preferences")
      .select("messages_mentions, venture_activity, social_activity, tribe_activity, new_posts")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return toPreferences(data);
  });

export const updateMyPushPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ key: preferenceKeySchema, enabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<PushPreferences> => {
    const { supabase, userId } = context;
    const patch: { user_id: string } & Partial<Record<PushPreferenceKey, boolean>> = {
      user_id: userId,
      [data.key]: data.enabled,
    };
    const { data: row, error } = await supabase
      .from("push_notification_preferences")
      .upsert(patch, { onConflict: "user_id" })
      .select("messages_mentions, venture_activity, social_activity, tribe_activity, new_posts")
      .single();
    if (error) throw new Error(error.message);
    return toPreferences(row);
  });
