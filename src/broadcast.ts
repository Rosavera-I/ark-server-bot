import { loadConfig } from "./config/env.js";
import { createProvider } from "./providers/index.js";

const message = process.argv.slice(2).join(" ").trim();

if (!message) {
  throw new Error('Usage: npm run broadcast -- "message to send"');
}

const config = loadConfig({
  ...process.env,
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || "broadcast",
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || "broadcast"
});
const provider = createProvider(config);

await provider.broadcast(message);
console.log(`Broadcast sent via ${provider.name}.`);
