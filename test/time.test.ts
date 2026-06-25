import assert from "node:assert/strict";
import test from "node:test";
import { parseRollbackTime } from "../src/utils/time.js";

test("parseRollbackTime handles minute durations", () => {
  const now = new Date("2026-06-25T01:00:00.000Z");
  assert.equal(parseRollbackTime("30m", now).toISOString(), "2026-06-25T00:30:00.000Z");
});

test("parseRollbackTime handles hour durations", () => {
  const now = new Date("2026-06-25T01:00:00.000Z");
  assert.equal(parseRollbackTime("2h", now).toISOString(), "2026-06-24T23:00:00.000Z");
});

test("parseRollbackTime handles timestamps", () => {
  assert.equal(
    parseRollbackTime("2026-06-24T23:00:00.000Z").toISOString(),
    "2026-06-24T23:00:00.000Z"
  );
});
