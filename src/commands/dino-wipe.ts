import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  SlashCommandBuilder
} from "discord.js";
import type { Logger } from "pino";
import type { AppConfig } from "../config/env.js";
import type { ServerProvider } from "../types.js";
import { createActionId } from "../discord/action-ids.js";
import { auditSafely } from "../services/audit.js";

export const dinoWipeCommand = new SlashCommandBuilder()
  .setName("dino-wipe")
  .setDescription("Wipe wild dinos after confirmation so fresh spawns repopulate the map")
  .addStringOption((option) =>
    option.setName("reason").setDescription("Why the wild dino wipe is needed").setMaxLength(160)
  );

export async function handleDinoWipeCommand(
  interaction: ChatInputCommandInteraction,
  _provider: ServerProvider,
  config: AppConfig,
  log?: Pick<Logger, "warn">
): Promise<void> {
  const reason = interaction.options.getString("reason") ?? `Requested by ${interaction.user.tag}`;
  await auditSafely(interaction, config, `Dino wipe confirmation requested by ${interaction.user.tag}: ${reason}`, (error) => {
    log?.warn({ error }, "Audit delivery failed");
  });

  await interaction.reply({
    content: [
      "Confirm wild dino wipe.",
      `Reason: **${reason}**.`,
      "This runs `DestroyWildDinos`. It removes wild dinos only; tames should not be affected. New wild spawns repopulate naturally."
    ].join("\n"),
    ephemeral: true,
    components: [confirmRow(interaction.user.id)]
  });
}

function confirmRow(userId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(createActionId({ action: "dino-wipe", decision: "confirm", userId }))
      .setLabel("Confirm Dino Wipe")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(createActionId({ action: "dino-wipe", decision: "cancel", userId }))
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
  );
}
