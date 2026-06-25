import assert from "node:assert/strict";
import test from "node:test";
import {
  createConfirmationToken,
  ensureBroadcastSafe,
  findNearestBackup,
  requireAllowedRconCommand
} from "../src/services/safety.js";
import type { BackupSummary } from "../src/types.js";

test("confirmation tokens are stable and uppercase", () => {
  assert.equal(createConfirmationToken("rollback", "backup-1"), "ROLLBACK:BACKUP1");
});

test("nearest backup returns latest restorable backup before target", () => {
  const backups: BackupSummary[] = [
    { id: "future", createdAt: new Date("2026-01-03T00:00:00Z"), label: "future" },
    { id: "old", createdAt: new Date("2026-01-01T00:00:00Z"), label: "old" },
    { id: "best", createdAt: new Date("2026-01-02T00:00:00Z"), label: "best" }
  ];

  assert.equal(findNearestBackup(backups, new Date("2026-01-02T18:00:00Z"))?.id, "best");
});

test("rcon commands are allowlisted", () => {
  assert.doesNotThrow(() => requireAllowedRconCommand("SaveWorld"));
  assert.throws(() => requireAllowedRconCommand("DestroyWildDinos"));
});

test("broadcasts are bounded", () => {
  assert.equal(ensureBroadcastSafe(" server restart in 5 "), "server restart in 5");
  assert.throws(() => ensureBroadcastSafe(""));
  assert.throws(() => ensureBroadcastSafe("x".repeat(181)));
});
