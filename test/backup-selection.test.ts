import assert from "node:assert/strict";
import test from "node:test";
import { selectRollbackBackup } from "../src/providers/backup-selection.js";

test("selectRollbackBackup chooses newest backup before requested time", () => {
  const backups = [
    { id: "late", label: "late", createdAt: new Date("2026-06-25T01:00:00.000Z") },
    { id: "target", label: "target", createdAt: new Date("2026-06-25T00:30:00.000Z") },
    { id: "old", label: "old", createdAt: new Date("2026-06-24T20:00:00.000Z") }
  ];

  const plan = selectRollbackBackup(backups, new Date("2026-06-25T00:45:00.000Z"));
  assert.equal(plan.selectedBackup.id, "target");
});
