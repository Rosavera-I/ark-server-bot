import assert from "node:assert/strict";
import test from "node:test";
import { createActionId } from "../src/discord/action-ids.js";
import { handleButton } from "../src/discord/buttons.js";
import type { ServerProvider } from "../src/types.js";

const config = {
  DISCORD_AUDIT_CHANNEL_ID: undefined
} as never;

test("restart confirmation removes components before provider call", async () => {
  const edits: unknown[] = [];
  const interaction = buttonInteraction("restart-before-provider", createActionId({
    action: "restart",
    decision: "confirm",
    userId: "restart-before-provider"
  }), edits);

  const provider = providerStub({
    restart: async () => {
      assert.deepEqual(edits[0], {
        content: "Working on the confirmed ARK action...",
        components: []
      });
    }
  });

  await handleButton(interaction, provider, config);

  assert.equal(edits.length, 2);
  assert.deepEqual(edits[1], { content: "Restart requested.", components: [] });
});

test("duplicate restart confirmations are blocked while first action is active", async () => {
  let releaseRestart!: () => void;
  let restartCalls = 0;
  const customId = createActionId({
    action: "restart",
    decision: "confirm",
    userId: "duplicate-restart"
  });
  const firstEdits: unknown[] = [];
  const secondEdits: unknown[] = [];
  const provider = providerStub({
    restart: async () => {
      restartCalls += 1;
      await new Promise<void>((resolve) => {
        releaseRestart = resolve;
      });
    }
  });

  const first = handleButton(buttonInteraction("duplicate-restart", customId, firstEdits), provider, config);
  await waitUntil(() => restartCalls === 1);
  await handleButton(buttonInteraction("duplicate-restart", customId, secondEdits), provider, config);
  releaseRestart();
  await first;

  assert.equal(restartCalls, 1);
  assert.deepEqual(secondEdits[0], { content: "That ARK action is already in progress.", components: [] });
});

function buttonInteraction(userId: string, customId: string, edits: unknown[]) {
  return {
    customId,
    user: {
      id: userId,
      tag: `${userId}#0001`
    },
    client: {
      channels: {
        fetch: async () => undefined
      }
    },
    deferUpdate: async () => undefined,
    editReply: async (payload: unknown) => {
      edits.push(payload);
    },
    reply: async (payload: unknown) => {
      edits.push(payload);
    },
    update: async (payload: unknown) => {
      edits.push(payload);
    }
  } as never;
}

function providerStub(overrides: Partial<ServerProvider>): ServerProvider {
  return {
    name: "stub",
    capabilities: () => ({
      status: true,
      restart: true,
      backup: true,
      rollback: true,
      rcon: false,
      command: true,
      broadcast: true,
      save: true
    }),
    validateConnection: async () => "ok",
    getStatus: async () => ({ name: "stub", state: "online", players: [] }),
    restart: async () => undefined,
    createBackup: async () => ({ id: "backup", label: "backup", createdAt: new Date() }),
    listBackups: async () => [],
    planRollback: async () => ({ requestedTime: new Date(), selectedBackup: { id: "backup", label: "backup", createdAt: new Date() }, alternatives: [] }),
    restoreBackup: async () => undefined,
    sendCommand: async () => "ok",
    broadcast: async () => undefined,
    saveWorld: async () => undefined,
    ...overrides
  };
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("condition was not reached");
}
