import assert from "node:assert/strict";
import test from "node:test";
import { ActionLock } from "../src/services/action-lock.js";

test("action locks reject duplicates until expiry", () => {
  let now = 1_000;
  const lock = new ActionLock({ now: () => now, ttlMs: 500 });

  assert.equal(lock.acquire("restart:user"), true);
  assert.equal(lock.acquire("restart:user"), false);

  now = 1_501;
  assert.equal(lock.acquire("restart:user"), true);
});

test("action locks can be released after failed provider work", () => {
  const lock = new ActionLock();

  assert.equal(lock.acquire("restore:backup"), true);
  lock.release("restore:backup");
  assert.equal(lock.acquire("restore:backup"), true);
});
