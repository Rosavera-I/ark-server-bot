import assert from "node:assert/strict";
import test from "node:test";
import { canUseArkCommand } from "../src/discord/permissions.js";

test("status and validate are allowed without admin roles", () => {
  const config = configWithRoles([]);

  assert.equal(canUseArkCommand(commandInteraction("status"), config), true);
  assert.equal(canUseArkCommand(commandInteraction("validate"), config), true);
});

test("destructive commands are rejected when no admin roles are configured", () => {
  assert.equal(canUseArkCommand(commandInteraction("restore"), configWithRoles([])), false);
});

test("destructive commands are allowed for configured admin roles", () => {
  const interaction = commandInteraction("restore", ["role-admin"]);

  assert.equal(canUseArkCommand(interaction, configWithRoles(["role-admin"])), true);
});

function configWithRoles(roleIds: string[]) {
  return {
    adminRoleIds: new Set(roleIds)
  } as never;
}

function commandInteraction(subcommand: string, roles: string[] = []) {
  return {
    isChatInputCommand: () => true,
    commandName: "ark",
    options: {
      getSubcommand: () => subcommand
    },
    member: {
      roles
    }
  } as never;
}
