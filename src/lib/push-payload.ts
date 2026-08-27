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
  | "hello_accepted";

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
};

const PRIVATE_PREVIEW_KINDS = new Set<PushNotificationKind>([
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
  const safeActor = actorName.trim() || "Someone";
  return {
    title: `${safeActor} ${KIND_TEXT[kind] ?? "sent you an update"}`,
    body: PRIVATE_PREVIEW_KINDS.has(kind) ? "Open MEUTUALS to view it." : (preview?.trim() ?? ""),
  };
}
