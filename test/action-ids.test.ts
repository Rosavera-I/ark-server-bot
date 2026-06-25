import assert from "node:assert/strict";
import test from "node:test";
import { createActionId, parseActionId } from "../src/discord/action-ids.js";

test("action ids round-trip restart confirms", () => {
  const customId = createActionId({ action: "restart", decision: "confirm", userId: "123" });
  assert.deepEqual(parseActionId(customId), {
    action: "restart",
    targetId: undefined,
    decision: "confirm",
    userId: "123"
  });
});

test("action ids preserve backup ids with punctuation", () => {
  const customId = createActionId({
    action: "rollback",
    targetId: "backup:2026-06-25/slot-1",
    decision: "cancel",
    userId: "456"
  });

  assert.deepEqual(parseActionId(customId), {
    action: "rollback",
    targetId: "backup:2026-06-25/slot-1",
    decision: "cancel",
    userId: "456"
  });
});

test("invalid action ids are ignored", () => {
  assert.equal(parseActionId("not-ark"), undefined);
  assert.equal(parseActionId("ark:rollback:x:maybe:123"), undefined);
});
