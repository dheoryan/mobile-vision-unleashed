import type { PushNotificationKind } from "@/lib/push-payload";

export const PUSH_PREFERENCE_KEYS = [
  "messages_mentions",
  "venture_activity",
  "social_activity",
  "tribe_activity",
  "new_posts",
] as const;

export type PushPreferenceKey = (typeof PUSH_PREFERENCE_KEYS)[number];

export interface PushPreferences {
  messages_mentions: boolean;
  venture_activity: boolean;
  social_activity: boolean;
  tribe_activity: boolean;
  new_posts: boolean;
}

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  messages_mentions: true,
  venture_activity: true,
  social_activity: true,
  tribe_activity: true,
  // This is the highest-volume category. Members explicitly opt in instead
  // of receiving a push for every post their Tribe can see.
  new_posts: false,
};

const KIND_CATEGORY: Record<PushNotificationKind, PushPreferenceKey> = {
  message: "messages_mentions",
  mention: "messages_mentions",
  hello: "messages_mentions",
  hello_accepted: "messages_mentions",
  venture_apply: "venture_activity",
  venture_invite: "venture_activity",
  venture_accept: "venture_activity",
  venture_message: "venture_activity",
  like: "social_activity",
  comment: "social_activity",
  reply: "social_activity",
  follow: "social_activity",
  tribe_join: "tribe_activity",
  new_post: "new_posts",
  tribe_pulse: "tribe_activity",
  repost: "social_activity",
  quote: "social_activity",
};

export function pushPreferenceForKind(kind: PushNotificationKind): PushPreferenceKey {
  return KIND_CATEGORY[kind];
}

export function allowsPushKind(kind: PushNotificationKind, preferences: PushPreferences): boolean {
  return preferences[pushPreferenceForKind(kind)];
}
