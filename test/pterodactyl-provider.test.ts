import assert from "node:assert/strict";
import test from "node:test";
import { PterodactylProvider } from "../src/providers/pterodactyl-provider.js";

test("restore waits for stop, backup unlock, restore completion, and start", async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  const states = ["stopping", "offline", "offline", "running"];
  const locks = [true, false, true, false];

  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url.endsWith("/power")) {
      calls.push(`power:${JSON.parse(init?.body as string).signal}`);
      return jsonResponse(undefined, 204);
    }

    if (url.endsWith("/resources")) {
      const state = states.shift() ?? "running";
      calls.push(`state:${state}`);
      return jsonResponse({ attributes: { current_state: state } });
    }

    if (url.endsWith("/backups/backup-1/restore")) {
      calls.push("restore");
      return jsonResponse(undefined, 204);
    }

    if (url.endsWith("/backups")) {
      const isLocked = locks.shift() ?? false;
      calls.push(`lock:${isLocked}`);
      return jsonResponse({
        data: [{
          attributes: {
            uuid: "backup-1",
            name: "backup",
            created_at: "2026-06-25T00:00:00.000Z",
            is_locked: isLocked
          }
        }]
      });
    }

    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;

  try {
    const provider = new PterodactylProvider({
      baseUrl: "https://panel.example",
      apiKey: "key",
      serverId: "server",
      serverName: "ARK",
      stopBeforeRestore: true,
      startAfterRestore: true,
      pollIntervalMs: 0,
      restoreTimeoutMs: 1_000
    });

    await provider.restoreBackup("backup-1", "test");

    assert.deepEqual(calls, [
      "power:stop",
      "state:stopping",
      "state:offline",
      "lock:true",
      "lock:false",
      "restore",
      "lock:true",
      "lock:false",
      "power:start",
      "state:offline",
      "state:running"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? undefined : JSON.stringify(body), { status });
}
