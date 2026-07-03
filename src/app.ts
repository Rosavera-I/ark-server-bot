import { Client, GatewayIntentBits } from "discord.js";
import pino from "pino";
import { handleArkCommand } from "./commands/ark.js";
import { handleDinoWipeCommand } from "./commands/dino-wipe.js";
import { loadConfig } from "./config/env.js";
import { handleButton } from "./discord/buttons.js";
import { canUseArkCommand, rejectUnauthorized } from "./discord/permissions.js";
import { createProvider } from "./providers/index.js";
import { userSafeErrorMessage } from "./services/errors.js";

const log = pino({
  name: "ark-server-bot",
  serializers: {
    err: pino.stdSerializers.err
  }
});
const config = loadConfig();
const provider = createProvider(config);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  log.info({ bot: client.user?.tag, provider: provider.name }, "ARK server bot ready");
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && (interaction.commandName === "ark" || interaction.commandName === "dino-wipe")) {
      if (!canUseArkCommand(interaction, config)) {
        await rejectUnauthorized(interaction);
        return;
      }

      if (interaction.commandName === "ark") {
        await handleArkCommand(interaction, provider, config, log);
      } else {
        await handleDinoWipeCommand(interaction, provider, config, log);
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("ark:")) {
      await handleButton(interaction, provider, config, log);
    }
  } catch (error) {
    log.error({ err: error }, "Interaction failed");
    const content = userSafeErrorMessage(error);

    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content, ephemeral: true });
      } else {
        await interaction.reply({ content, ephemeral: true });
      }
    }
  }
});

await client.login(config.DISCORD_TOKEN);
