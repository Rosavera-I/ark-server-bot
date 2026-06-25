import assert from "node:assert/strict";
import test from "node:test";
import { auditSafely } from "../src/services/audit.js";

test("auditSafely isolates audit channel delivery failures", async () => {
  const errors: unknown[] = [];
  const interaction = {
    client: {
      channels: {
        fetch: async () => {
          throw new Error("Discord API unavailable");
        }
      }
    }
  };

  await assert.doesNotReject(async () => {
    await auditSafely(interaction as never, { DISCORD_AUDIT_CHANNEL_ID: "audit-channel" }, "message", (error) => {
      errors.push(error);
    });
  });

  assert.equal(errors.length, 1);
});
