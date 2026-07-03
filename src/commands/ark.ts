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
import { formatRelative, parseRollbackTime } from "../utils/time.js";
import { auditSafely } from "../services/audit.js";
import { createActionId } from "../discord/action-ids.js";
import { ensureBroadcastSafe } from "../services/safety.js";

export const arkCommand = new SlashCommandBuilder()
  .setName("ark")
  .setDescription("Manage the ARK: Survival Ascended server")
  .addSubcommand((subcommand) =>
    subcommand.setName("status").setDescription("Show server status and players")
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("validate").setDescription("Check provider credentials and reachable operations")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("backup")
      .setDescription("Create a manual ARK save snapshot")
      .addStringOption((option) =>
        option.setName("label").setDescription("Snapshot label for the audit log").setMaxLength(80)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("backups").setDescription("List recent ARK save snapshots")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("restore")
      .setDescription("Restore an exact ARK save snapshot after confirmation")
      .addStringOption((option) =>
        option
          .setName("backup_id")
          .setDescription("Snapshot filename from /ark backups")
          .setRequired(true)
          .setMaxLength(96)
      )
      .addStringOption((option) =>
        option.setName("reason").setDescription("Why the restore is needed").setMaxLength(160)
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
      .setName("broadcast")
      .setDescription("Send a short message to players")
      .addStringOption((option) =>
        option
          .setName("message")
          .setDescription("Message to send in-game")
          .setRequired(true)
          .setMaxLength(180)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("save").setDescription("Ask the server to save the world now")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("rollback")
      .setDescription("Restore a save snapshot near a requested time after confirmation")
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
  provider: ServerProvider,
  config: AppConfig,
  log?: Pick<Logger, "warn">
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const handler = subcommandHandlers[subcommand];

  if (handler) {
    await handler(interaction, provider, config, log);
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
  provider: ServerProvider,
  config: AppConfig,
  log?: Pick<Logger, "warn">
): Promise<void> {
  if (!provider.capabilities().backup) {
    await interaction.reply({ content: "This provider cannot create ARK save snapshots.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const label = interaction.options.getString("label") ?? `Discord save snapshot by ${interaction.user.username}`;
  const backup = await provider.createBackup(label);
  await auditSafely(interaction, config, `ARK save snapshot created: ${backup.label} (${backup.id})`, (error) => {
    log?.warn({ error }, "Audit delivery failed");
  });
  await interaction.editReply(`ARK save snapshot created: \`${backup.id}\` at ${backup.createdAt.toISOString()}.`);
}

async function handleBackups(
  interaction: ChatInputCommandInteraction,
  provider: ServerProvider
): Promise<void> {
  if (!provider.capabilities().backup) {
    await interaction.reply({ content: "This provider cannot list ARK save snapshots.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const backups = (await provider.listBackups()).slice(0, 10);
  const content = backups.length > 0
    ? backups.map((backup) => `- \`${backup.id}\` - ${formatRelative(backup.createdAt)}${backup.sizeBytes === undefined ? "" : `, ${formatBytes(backup.sizeBytes)}`}`).join("\n")
    : "No ARK save snapshots are visible to this provider.";
  await interaction.editReply(content);
}

async function handleRestore(
  interaction: ChatInputCommandInteraction,
  provider: ServerProvider
): Promise<void> {
  if (!provider.capabilities().rollback) {
    await interaction.reply({ content: "This provider cannot restore ARK save snapshots.", ephemeral: true });
    return;
  }

  const backupId = interaction.options.getString("backup_id", true);
  const reason = interaction.options.getString("reason") ?? `Requested by ${interaction.user.tag}`;
  await interaction.reply({
    content: [
      `Confirm exact ARK save snapshot restore: \`${backupId}\`.`,
      `Reason: **${reason}**.`,
      "This will stop the server, preserve the current live save as a safety file, and overwrite the live world save."
    ].join("\n"),
    ephemeral: true,
    components: [confirmRow("restore", interaction.user.id, backupId)]
  });
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

async function handleValidate(
  interaction: ChatInputCommandInteraction,
  provider: ServerProvider
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const message = await provider.validateConnection();
  await interaction.editReply(`Provider \`${provider.name}\` validated: ${message}`);
}

async function handleBroadcast(
  interaction: ChatInputCommandInteraction,
  provider: ServerProvider,
  config: AppConfig,
  log?: Pick<Logger, "warn">
): Promise<void> {
  if (!provider.capabilities().broadcast) {
    await interaction.reply({ content: "This provider cannot broadcast to the server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  const message = ensureBroadcastSafe(interaction.options.getString("message", true));
  await provider.broadcast(message);
  await auditSafely(interaction, config, `Broadcast sent by ${interaction.user.tag}: ${message}`, (error) => {
    log?.warn({ error }, "Audit delivery failed");
  });
  await interaction.editReply("Broadcast sent.");
}

async function handleSave(
  interaction: ChatInputCommandInteraction,
  provider: ServerProvider,
  config: AppConfig,
  log?: Pick<Logger, "warn">
): Promise<void> {
  if (!provider.capabilities().save) {
    await interaction.reply({ content: "This provider cannot trigger a world save.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  await provider.saveWorld(`Requested by ${interaction.user.tag}`);
  await auditSafely(interaction, config, `SaveWorld requested by ${interaction.user.tag}`, (error) => {
    log?.warn({ error }, "Audit delivery failed");
  });
  await interaction.editReply("SaveWorld requested.");
}

async function handleRollback(
  interaction: ChatInputCommandInteraction,
  provider: ServerProvider
): Promise<void> {
  if (!provider.capabilities().rollback) {
    await interaction.reply({ content: "This provider cannot restore ARK save snapshots.", ephemeral: true });
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
      `Selected snapshot: \`${plan.selectedBackup.id}\` (${formatRelative(plan.selectedBackup.createdAt)}).`,
      alternatives ? `Alternatives:\n${alternatives}` : "",
      `Confirm restore for **${reason}**.`
    ].filter(Boolean).join("\n"),
    components: [confirmRow("rollback", interaction.user.id, plan.selectedBackup.id)]
  });
}

function formatBytes(bytes: number): string {
  const mib = bytes / 1024 / 1024;
  return `${mib.toFixed(mib >= 10 ? 0 : 1)} MiB`;
}

function confirmRow(
  action: "restart" | "rollback" | "restore",
  userId: string,
  targetId?: string
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(createActionId({ action, targetId, decision: "confirm", userId }))
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(createActionId({ action, targetId, decision: "cancel", userId }))
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
  );
}

type SubcommandHandler = (
  interaction: ChatInputCommandInteraction,
  provider: ServerProvider,
  config: AppConfig,
  log?: Pick<Logger, "warn">
) => Promise<void>;

const subcommandHandlers: Record<string, SubcommandHandler> = {
  status: handleStatus,
  backup: handleBackup,
  backups: handleBackups,
  restore: handleRestore,
  restart: handleRestart,
  validate: handleValidate,
  broadcast: handleBroadcast,
  save: handleSave,
  rollback: handleRollback
};
