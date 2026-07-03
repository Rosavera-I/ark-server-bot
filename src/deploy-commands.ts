import { REST, Routes } from "discord.js";
import { loadConfig } from "./config/env.js";
import { arkCommand } from "./commands/ark.js";
import { dinoWipeCommand } from "./commands/dino-wipe.js";

const config = loadConfig();
const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
const body = [arkCommand.toJSON(), dinoWipeCommand.toJSON()];

if (config.DISCORD_GUILD_ID) {
  await rest.put(
    Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
    { body }
  );
  console.log(`Registered guild commands for ${config.DISCORD_GUILD_ID}.`);
} else {
  await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body });
  console.log("Registered global commands.");
}
