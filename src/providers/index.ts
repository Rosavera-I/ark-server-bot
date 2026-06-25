import type { AppConfig } from "../config/env.js";
import type { ServerProvider } from "../types.js";
import { MockProvider } from "./mock-provider.js";
import { PterodactylProvider } from "./pterodactyl-provider.js";
import { RconProvider } from "./rcon-provider.js";

export function createProvider(config: AppConfig): ServerProvider {
  if (config.SERVER_PROVIDER === "mock") {
    return new MockProvider(config.SERVER_NAME);
  }

  if (config.SERVER_PROVIDER === "pterodactyl") {
    assertPresent(config.PTERODACTYL_BASE_URL, "PTERODACTYL_BASE_URL");
    assertPresent(config.PTERODACTYL_API_KEY, "PTERODACTYL_API_KEY");
    assertPresent(config.PTERODACTYL_SERVER_ID, "PTERODACTYL_SERVER_ID");
    return new PterodactylProvider({
      baseUrl: config.PTERODACTYL_BASE_URL,
      apiKey: config.PTERODACTYL_API_KEY,
      serverId: config.PTERODACTYL_SERVER_ID,
      serverName: config.SERVER_NAME
    });
  }

  assertPresent(config.RCON_HOST, "RCON_HOST");
  assertPresent(config.RCON_PASSWORD, "RCON_PASSWORD");
  return new RconProvider({
    host: config.RCON_HOST,
    port: config.RCON_PORT,
    password: config.RCON_PASSWORD,
    serverName: config.SERVER_NAME
  });
}

function assertPresent(value: string | undefined, name: string): asserts value is string {
  if (!value) {
    throw new Error(`${name} is required for the selected server provider.`);
  }
}
