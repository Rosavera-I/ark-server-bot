import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { Logger } from "pino";
import type { AppConfig } from "../config/env.js";
import type { ServerProvider } from "../types.js";
import { auditSafely } from "../services/audit.js";

export const startCommand = new SlashCommandBuilder()
  .setName("start")
  .setDescription("Start the ARK server if it is offline");

export async function handleStartCommand(
  interaction: ChatInputCommandInteraction,
  provider: ServerProvider,
  config: AppConfig,
  log?: Pick<Logger, "warn">
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const status = await provider.getStatus();

  if (status.state === "online" || status.state === "starting") {
    await interaction.editReply(`Server is already ${status.state}.`);
    return;
  }

  await provider.start(`Requested by ${interaction.user.tag}`);
  await auditSafely(interaction, config, `Server start requested by ${interaction.user.tag}`, (error) => {
    log?.warn({ error }, "Audit delivery failed");
  });
  await interaction.editReply("Server start requested. It is now reporting online.");
}
