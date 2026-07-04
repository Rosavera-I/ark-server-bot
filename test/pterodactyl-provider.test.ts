import assert from "node:assert/strict";
import test from "node:test";
import { PterodactylProvider } from "../src/providers/pterodactyl-provider.js";

test("restore preserves live save, writes selected snapshot, and restarts", async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  const states = ["running", "stopping", "offline", "offline", "running"];

  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url === "https://node.example/live") {
      calls.push("download:live");
      return new Response(Buffer.from("live-save"));
    }
    if (url === "https://node.example/snapshot") {
      calls.push("download:snapshot");
      return new Response(Buffer.from("snapshot-save"));
    }
    if (url.includes("/files/list")) {
      calls.push("list:snapshots");
      return jsonResponse({
        data: [{
          attributes: {
            name: "Ragnarok_WP_03.07.2026_14.47.11.ark",
            size: 98_271_232,
            is_file: true
          }
        }]
      });
    }
    if (url.includes("/files/download")) {
      const file = new URL(url).searchParams.get("file");
      calls.push(`signed:${file}`);
      return jsonResponse({
        attributes: {
          url: file?.endsWith("Ragnarok_WP.ark") ? "https://node.example/live" : "https://node.example/snapshot"
        }
      });
    }
    if (url.includes("/files/write")) {
      const file = new URL(url).searchParams.get("file");
      const body = Buffer.from(init?.body as Buffer).toString();
      calls.push(`write:${file}:${body}`);
      return jsonResponse(undefined, 204);
    }
    if (url.endsWith("/command")) {
      calls.push(`command:${JSON.parse(init?.body as string).command}`);
      return jsonResponse(undefined, 204);
    }
    if (url.endsWith("/power")) {
      calls.push(`power:${JSON.parse(init?.body as string).signal}`);
      return jsonResponse(undefined, 204);
    }
    if (url.endsWith("/resources")) {
      const state = states.shift() ?? "running";
      calls.push(`state:${state}`);
      return jsonResponse({ attributes: { current_state: state } });
    }

    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;

  try {
    const provider = new PterodactylProvider({
      baseUrl: "https://panel.example",
      apiKey: "key",
      serverId: "server",
      serverName: "ARK",
      saveDirectory: "/ShooterGame/Saved/SavedArks/Ragnarok_WP",
      mapName: "Ragnarok_WP",
      safetyPrefix: "discord-restore-safety",
      stopBeforeRestore: true,
      startAfterRestore: true,
      pollIntervalMs: 0,
      restoreTimeoutMs: 1_000
    });

    await provider.restoreBackup("Ragnarok_WP_03.07.2026_14.47.11.ark", "test");

    const normalizedCalls = calls.map((call) =>
      call.replace(/discord-restore-safety-\d{8}T\d{6}Z-Ragnarok_WP\.ark/, "discord-restore-safety-TIMESTAMP-Ragnarok_WP.ark")
    );

    assert.deepEqual(normalizedCalls, [
      "list:snapshots",
      "state:running",
      "command:ServerChat Server rollback starting: restoring Ragnarok_WP_03.07.2026_14.47.11.ark",
      "power:stop",
      "state:stopping",
      "state:offline",
      "signed:/ShooterGame/Saved/SavedArks/Ragnarok_WP/Ragnarok_WP.ark",
      "download:live",
      "write:/ShooterGame/Saved/SavedArks/Ragnarok_WP/discord-restore-safety-TIMESTAMP-Ragnarok_WP.ark:live-save",
      "signed:/ShooterGame/Saved/SavedArks/Ragnarok_WP/Ragnarok_WP_03.07.2026_14.47.11.ark",
      "download:snapshot",
      "write:/ShooterGame/Saved/SavedArks/Ragnarok_WP/Ragnarok_WP.ark:snapshot-save",
      "power:start",
      "state:offline",
      "state:running"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("restore timeout reports the last observed server state", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url.includes("/files/list")) {
      return jsonResponse({
        data: [{
          attributes: {
            name: "Ragnarok_WP_03.07.2026_14.47.11.ark",
            size: 98_271_232,
            is_file: true
          }
        }]
      });
    }
    if (url.endsWith("/resources")) {
      return jsonResponse({ attributes: { current_state: "stopping" } });
    }
    if (url.endsWith("/power")) {
      return jsonResponse(undefined, 204);
    }
    if (url.endsWith("/command")) {
      return jsonResponse(undefined, 204);
    }

    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;

  try {
    const provider = new PterodactylProvider({
      baseUrl: "https://panel.example",
      apiKey: "key",
      serverId: "server",
      serverName: "ARK",
      saveDirectory: "/ShooterGame/Saved/SavedArks/Ragnarok_WP",
      mapName: "Ragnarok_WP",
      safetyPrefix: "discord-restore-safety",
      stopBeforeRestore: true,
      startAfterRestore: true,
      pollIntervalMs: 0,
      restoreTimeoutMs: 1
    });

    await assert.rejects(
      () => provider.restoreBackup("Ragnarok_WP_03.07.2026_14.47.11.ark", "test"),
      /Timed out waiting for server to stop before restore\. Last observed state: stopping\./
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("restore timeout after stop attempts to start the server again", async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  const states = ["running", "stopping", "offline", "running"];

  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url.includes("/files/list")) {
      calls.push("list:snapshots");
      return jsonResponse({
        data: [{
          attributes: {
            name: "Ragnarok_WP_03.07.2026_14.47.11.ark",
            size: 98_271_232,
            is_file: true
          }
        }]
      });
    }
    if (url.endsWith("/resources")) {
      const state = states.shift() ?? "running";
      calls.push(`state:${state}`);
      return jsonResponse({ attributes: { current_state: state } });
    }
    if (url.endsWith("/power")) {
      calls.push(`power:${JSON.parse(init?.body as string).signal}`);
      return jsonResponse(undefined, 204);
    }
    if (url.endsWith("/command")) {
      calls.push(`command:${JSON.parse(init?.body as string).command}`);
      return jsonResponse(undefined, 204);
    }

    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;

  try {
    const provider = new PterodactylProvider({
      baseUrl: "https://panel.example",
      apiKey: "key",
      serverId: "server",
      serverName: "ARK",
      saveDirectory: "/ShooterGame/Saved/SavedArks/Ragnarok_WP",
      mapName: "Ragnarok_WP",
      safetyPrefix: "discord-restore-safety",
      stopBeforeRestore: true,
      startAfterRestore: true,
      pollIntervalMs: 10,
      restoreTimeoutMs: 1
    });

    await assert.rejects(
      () => provider.restoreBackup("Ragnarok_WP_03.07.2026_14.47.11.ark", "test"),
      /Timed out waiting for server to stop before restore/
    );

    assert.deepEqual(calls, [
      "list:snapshots",
      "state:running",
      "command:ServerChat Server rollback starting: restoring Ragnarok_WP_03.07.2026_14.47.11.ark",
      "power:stop",
      "state:stopping",
      "state:offline",
      "power:start",
      "state:running"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? undefined : JSON.stringify(body), { status });
}
