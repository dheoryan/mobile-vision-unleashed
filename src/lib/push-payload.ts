export type PushNotificationKind =
  | "like"
  | "comment"
  | "reply"
  | "mention"
  | "follow"
  | "message"
  | "new_post"
  | "venture_apply"
  | "venture_invite"
  | "venture_accept"
  | "venture_message"
  | "tribe_join"
  | "hello"
  | "hello_accepted"
  | "tribe_pulse"
  | "repost"
  | "quote";

const KIND_TEXT: Record<PushNotificationKind, string> = {
  like: "liked your post",
  comment: "commented on your post",
  reply: "replied to your comment",
  mention: "mentioned you",
  follow: "started following you",
  message: "sent you a message",
  new_post: "shared a new signal",
  venture_apply: "asked to join your Venture",
  venture_invite: "invited you to a Venture",
  venture_accept: "accepted you into a Venture",
  venture_message: "sent a Venture message",
  tribe_join: "joined your Tribe",
  hello: "said hello",
  hello_accepted: "accepted your Hello",
  // Never actually rendered - tribe_pulse has no single actor, so
  // buildPushCopy short-circuits it before this template is used. Kept here
  // so the Record stays total and a future refactor can't silently drop it.
  tribe_pulse: "posted today's Tribevia",
  repost: "reposted your post",
  quote: "quoted your post",
};

const PRIVATE_PREVIEW_KINDS = new Set<PushNotificationKind>([
  "mention",
  "message",
  "hello",
  "hello_accepted",
  "venture_apply",
  "venture_invite",
  "venture_accept",
  "venture_message",
]);

export interface PushCopy {
  title: string;
  body: string;
}

/** Keep private conversation and meetup details off lock screens by default. */
export function buildPushCopy(
  actorName: string,
  kind: PushNotificationKind,
  preview: string | null,
): PushCopy {
  // The whole tribe posts this, not one person - "Someone posted today's
  // Tribevia" reads like a stranger did something, when actually nobody in
  // particular did. Skip the actor template entirely for this one kind.
  if (kind === "tribe_pulse") {
    return { title: "New Tribevia", body: preview?.trim() || "Today's question is up." };
  }
  const safeActor = actorName.trim() || "Someone";
  return {
    title: `${safeActor} ${KIND_TEXT[kind] ?? "sent you an update"}`,
    body: PRIVATE_PREVIEW_KINDS.has(kind) ? "Open MEUTUALS to view it." : (preview?.trim() ?? ""),
  };
}
