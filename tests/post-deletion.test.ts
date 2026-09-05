import assert from "node:assert/strict";
import test from "node:test";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { postDeletionOptions } from "../src/lib/post-deletion.ts";

test("failed delete reports the error after card unmount and restores only affected lists", async () => {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  const post = { id: "target", content: "original" };
  qc.setQueryData(["posts", "feed", "all"], [{ id: "first" }, post]);
  qc.setQueryData(["posts", "mine"], [post]);
  qc.setQueryData(["posts", "feed", "other-tribe"], [{ id: "unrelated" }]);
  qc.setQueryData(["posts", "saved-ids"], ["target"]);
  let rejectDelete!: (error: Error) => void;
  let requestStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    requestStarted = resolve;
  });
  const notices: string[] = [];
  const observer = new MutationObserver(
    qc,
    postDeletionOptions(
      qc,
      () => {
        requestStarted();
        return new Promise((_resolve, reject) => {
          rejectDelete = reject;
        });
      },
      {
        success: () => assert.fail("must not report success"),
        error: (message) => {
          notices.push(message);
        },
      },
    ),
  );
  const unsubscribe = observer.subscribe(() => {});
  const pending = observer.mutate({ id: "target" });
  await started;
  assert.deepEqual(qc.getQueryData(["posts", "mine"]), []);
  // The UI unmounts its observer after optimistic deletion.
  unsubscribe();
  // Another request changes the feed before this delete fails.
  qc.setQueryData(["posts", "feed", "all"], [{ id: "new" }, { id: "first", content: "updated" }]);
  rejectDelete(new Error("database rejected deletion"));
  await assert.rejects(pending, /database rejected deletion/);
  assert.deepEqual(notices, ["database rejected deletion"]);
  assert.deepEqual(qc.getQueryData(["posts", "mine"]), [post]);
  assert.deepEqual(qc.getQueryData(["posts", "feed", "all"]), [
    { id: "new" },
    post,
    { id: "first", content: "updated" },
  ]);
  assert.deepEqual(qc.getQueryData(["posts", "feed", "other-tribe"]), [{ id: "unrelated" }]);
  assert.deepEqual(qc.getQueryData(["posts", "saved-ids"]), ["target"]);
  qc.clear();
});

test("successful delete reports success after card unmount", async () => {
  const qc = new QueryClient({ defaultOptions: { mutations: { gcTime: 0 } } });
  qc.setQueryData(["posts", "mine"], [{ id: "target" }]);
  let resolveDelete!: (value: unknown) => void;
  let requestStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    requestStarted = resolve;
  });
  const notices: string[] = [];
  const observer = new MutationObserver(
    qc,
    postDeletionOptions(
      qc,
      () => {
        requestStarted();
        return new Promise((resolve) => {
          resolveDelete = resolve;
        });
      },
      {
        success: (message) => {
          notices.push(message);
        },
        error: () => assert.fail("must not report failure"),
      },
    ),
  );
  const unsubscribe = observer.subscribe(() => {});
  const pending = observer.mutate({ id: "target" });
  await started;
  unsubscribe();
  resolveDelete({ id: "target" });
  await pending;
  assert.deepEqual(notices, ["Post deleted"]);
  assert.deepEqual(qc.getQueryData(["posts", "mine"]), []);
  qc.clear();
});
