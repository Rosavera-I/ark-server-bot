import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config/env.js";

const requiredEnv = {
  DISCORD_TOKEN: "token",
  DISCORD_CLIENT_ID: "client"
};

test("loadConfig parses explicit false boolean env values", () => {
  const config = loadConfig({
    ...requiredEnv,
    PTERODACTYL_STOP_BEFORE_RESTORE: "false",
    PTERODACTYL_START_AFTER_RESTORE: "0"
  });

  assert.equal(config.PTERODACTYL_STOP_BEFORE_RESTORE, false);
  assert.equal(config.PTERODACTYL_START_AFTER_RESTORE, false);
});

test("loadConfig defaults restore lifecycle flags to true", () => {
  const config = loadConfig(requiredEnv);

  assert.equal(config.PTERODACTYL_STOP_BEFORE_RESTORE, true);
  assert.equal(config.PTERODACTYL_START_AFTER_RESTORE, true);
});
