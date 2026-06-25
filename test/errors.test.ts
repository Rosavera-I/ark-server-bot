import assert from "node:assert/strict";
import test from "node:test";
import { userSafeErrorMessage, UserSafeError } from "../src/services/errors.js";

test("raw provider errors are replaced with a generic user-safe message", () => {
  const message = userSafeErrorMessage(new Error("Pterodactyl API 500: {\"errors\":[{\"detail\":\"secret\"}]}"));

  assert.equal(message, "The ARK request failed. Check the bot logs for details.");
  assert.equal(message.includes("secret"), false);
});

test("explicit user-safe errors are preserved", () => {
  assert.equal(userSafeErrorMessage(new UserSafeError("This provider cannot restart the server.")), "This provider cannot restart the server.");
});
