import { loadConfig } from "./config/env.js";
import { createProvider } from "./providers/index.js";

const shouldCreate = process.argv.includes("--create");
const labelArg = process.argv.find((arg) => arg.startsWith("--label="));
const label = labelArg?.slice("--label=".length) || `Discord save snapshot ${new Date().toISOString()}`;

const config = loadConfig({
  ...process.env,
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || "backups",
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || "backups"
});
const provider = createProvider(config);

if (!provider.capabilities().backup) {
  throw new Error(`Provider ${provider.name} does not support ARK save snapshots.`);
}

if (shouldCreate) {
  const backup = await provider.createBackup(label);
  console.log(`Created backup: ${backup.label} (${backup.id}) at ${backup.createdAt.toISOString()}`);
}

const backups = await provider.listBackups();

if (backups.length === 0) {
  console.log("No ARK save snapshots visible to this API key.");
} else {
  for (const backup of backups) {
    const size = backup.sizeBytes === undefined ? "unknown size" : `${backup.sizeBytes} bytes`;
    console.log(`${backup.id} | ${backup.createdAt.toISOString()} | ${size} | ${backup.label}`);
  }
}
