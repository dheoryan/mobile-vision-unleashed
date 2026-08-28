import assert from "node:assert/strict";
import test from "node:test";
import {
  allowsPushKind,
  DEFAULT_PUSH_PREFERENCES,
  pushPreferenceForKind,
} from "../src/lib/push-preferences.ts";

test("every push kind maps to a stable member-facing category", () => {
  assert.deepEqual(
    {
      message: pushPreferenceForKind("message"),
      mention: pushPreferenceForKind("mention"),
      hello: pushPreferenceForKind("hello"),
      hello_accepted: pushPreferenceForKind("hello_accepted"),
      venture_apply: pushPreferenceForKind("venture_apply"),
      venture_invite: pushPreferenceForKind("venture_invite"),
      venture_accept: pushPreferenceForKind("venture_accept"),
      venture_message: pushPreferenceForKind("venture_message"),
      like: pushPreferenceForKind("like"),
      comment: pushPreferenceForKind("comment"),
      reply: pushPreferenceForKind("reply"),
      follow: pushPreferenceForKind("follow"),
      tribe_join: pushPreferenceForKind("tribe_join"),
      new_post: pushPreferenceForKind("new_post"),
    },
    {
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
    },
  );
});

test("high-intent categories default on while noisy new-post push defaults off", () => {
  assert.equal(allowsPushKind("message", DEFAULT_PUSH_PREFERENCES), true);
  assert.equal(allowsPushKind("venture_apply", DEFAULT_PUSH_PREFERENCES), true);
  assert.equal(allowsPushKind("reply", DEFAULT_PUSH_PREFERENCES), true);
  assert.equal(allowsPushKind("new_post", DEFAULT_PUSH_PREFERENCES), false);
});

test("a member preference suppresses only its mapped category", () => {
  const preferences = { ...DEFAULT_PUSH_PREFERENCES, social_activity: false };
  assert.equal(allowsPushKind("like", preferences), false);
  assert.equal(allowsPushKind("comment", preferences), false);
  assert.equal(allowsPushKind("message", preferences), true);
});
