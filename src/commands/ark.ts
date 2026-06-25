import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  SlashCommandBuilder
} from "discord.js";
import type { ServerProvider } from "../types.js";
import { formatRelative, parseRollbackTime } from "../utils/time.js";
import { audit } from "../services/audit.js";

export const arkCommand = new SlashCommandBuilder()
  .setName("ark")
  .setDescription("Manage the ARK: Survival Ascended server")
  .addSubcommand((subcommand) =>
    subcommand.setName("status").setDescription("Show server status and players")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("backup")
      .setDescription("Create a manual server backup")
      .addStringOption((option) =>
        option.setName("label").setDescription("Backup label").setMaxLength(80)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("restart")
      .setDescription("Restart the server after confirmation")
      .addStringOption((option) =>
        option.setName("reason").setDescription("Why the restart is needed").setMaxLength(160)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("rollback")
      .setDescription("Restore a backup near a requested time after confirmation")
      .addStringOption((option) =>
        option
          .setName("time")
          .setDescription("Example: 30m, 2h, 1d, or 2026-06-25T01:00:00Z")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("reason").setDescription("Why the rollback is needed").setMaxLength(160)
      )
  );

export async function handleArkCommand(
  interaction: ChatInputCommandInteraction,
  provider: ServerProvider
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "status") {
    await handleStatus(interaction, provider);
    return;
  }

  if (subcommand === "backup") {
    await handleBackup(interaction, provider);
    return;
  }

  if (subcommand === "restart") {
    await handleRestart(interaction, provider);
    return;
  }

  if (subcommand === "rollback") {
    await handleRollback(interaction, provider);
    return;
  }

  await interaction.reply({ content: "Unknown ARK command.", ephemeral: true });
}

async function handleStatus(
  interaction: ChatInputCommandInteraction,
  provider: ServerProvider
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const status = await provider.getStatus();
  const capabilities = provider.capabilities();
  const players = status.players.length > 0
    ? status.players.map((player) => player.name).join(", ")
    : "none";

  await interaction.editReply([
    `**${status.name}** is **${status.state}** via \`${provider.name}\`.`,
    `Players: ${players}`,
    `Capabilities: ${Object.entries(capabilities).filter(([, enabled]) => enabled).map(([name]) => name).join(", ") || "none"}`,
    status.message ? `Note: ${status.message}` : ""
  ].filter(Boolean).join("\n"));
}

async function handleBackup(
  interaction: ChatInputCommandInteraction,
  provider: ServerProvider
): Promise<void> {
  if (!provider.capabilities().backup) {
    await interaction.reply({ content: "This provider cannot create backups.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const label = interaction.options.getString("label") ?? `Discord backup by ${interaction.user.username}`;
  const backup = await provider.createBackup(label);
  await audit(interaction, `Backup created: ${backup.label} (${backup.id})`);
  await interaction.editReply(`Backup created: **${backup.label}** at ${backup.createdAt.toISOString()}.`);
}

async function handleRestart(
  interaction: ChatInputCommandInteraction,
  provider: ServerProvider
): Promise<void> {
  if (!provider.capabilities().restart) {
    await interaction.reply({ content: "This provider cannot restart the server.", ephemeral: true });
    return;
  }

  const reason = interaction.options.getString("reason") ?? `Requested by ${interaction.user.tag}`;
  await interaction.reply({
    content: `Confirm restart for **${reason}**.`,
    ephemeral: true,
    components: [confirmRow("restart", interaction.user.id)]
  });
}

async function handleRollback(
  interaction: ChatInputCommandInteraction,
  provider: ServerProvider
): Promise<void> {
  if (!provider.capabilities().rollback) {
    await interaction.reply({ content: "This provider cannot restore backups.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const input = interaction.options.getString("time", true);
  const reason = interaction.options.getString("reason") ?? `Requested by ${interaction.user.tag}`;
  const target = parseRollbackTime(input);
  const plan = await provider.planRollback(target);
  const alternatives = plan.alternatives
    .map((backup) => `- ${backup.label} (${formatRelative(backup.createdAt)})`)
    .join("\n");

  await interaction.editReply({
    content: [
      `Requested rollback target: **${target.toISOString()}**.`,
      `Selected backup: **${plan.selectedBackup.label}** (${formatRelative(plan.selectedBackup.createdAt)}).`,
      alternatives ? `Alternatives:\n${alternatives}` : "",
      `Confirm restore for **${reason}**.`
    ].filter(Boolean).join("\n"),
    components: [confirmRow(`rollback:${plan.selectedBackup.id}`, interaction.user.id)]
  });
}

function confirmRow(action: string, userId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ark:${action}:confirm:${userId}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ark:${action}:cancel:${userId}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
  );
}
