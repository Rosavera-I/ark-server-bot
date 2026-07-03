import type { ButtonInteraction } from "discord.js";
import type { Logger } from "pino";
import type { AppConfig } from "../config/env.js";
import type { ServerProvider } from "../types.js";
import { ActionLock } from "../services/action-lock.js";
import { auditSafely } from "../services/audit.js";
import { parseActionId } from "./action-ids.js";

const destructiveActionLock = new ActionLock();

export async function handleButton(
  interaction: ButtonInteraction,
  provider: ServerProvider,
  config: AppConfig,
  log?: Pick<Logger, "warn">
): Promise<void> {
  const parsed = parseActionId(interaction.customId);
  if (!parsed) return;

  if (interaction.user.id !== parsed.userId) {
    await interaction.reply({ content: "Only the requester can confirm this action.", ephemeral: true });
    return;
  }

  if (parsed.decision === "cancel") {
    await interaction.update({ content: "Cancelled.", components: [] });
    return;
  }

  await interaction.deferUpdate();
  const lockKey = `${parsed.action}:${parsed.targetId ?? "server"}:${parsed.userId}`;

  if (!destructiveActionLock.acquire(lockKey)) {
    await interaction.editReply({ content: "That ARK action is already in progress.", components: [] });
    return;
  }

  await interaction.editReply({ content: "Working on the confirmed ARK action...", components: [] });

  if (parsed.action === "restart") {
    try {
      await provider.restart(`Confirmed by ${interaction.user.tag}`);
    } finally {
      destructiveActionLock.release(lockKey);
    }
    await auditSafely(interaction, config, `Restart confirmed by ${interaction.user.tag}`, (error) => {
      log?.warn({ error }, "Audit delivery failed");
    });
    await interaction.editReply({ content: "Restart requested.", components: [] });
    return;
  }

  if (parsed.action === "rollback" || parsed.action === "restore") {
    if (!parsed.targetId) {
      destructiveActionLock.release(lockKey);
      await interaction.editReply({ content: "Missing ARK save snapshot for restore.", components: [] });
      return;
    }

    try {
      await provider.restoreBackup(parsed.targetId, `Confirmed by ${interaction.user.tag}`);
    } finally {
      destructiveActionLock.release(lockKey);
    }
    await auditSafely(interaction, config, `${parsed.action} confirmed by ${interaction.user.tag}: ${parsed.targetId}`, (error) => {
      log?.warn({ error }, "Audit delivery failed");
    });
    await interaction.editReply({
      content: `${parsed.action === "rollback" ? "Rollback" : "Restore"} requested for snapshot \`${parsed.targetId}\`.`,
      components: []
    });
    return;
  }
}
