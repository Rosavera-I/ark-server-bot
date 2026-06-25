import type { ButtonInteraction } from "discord.js";
import type { ServerProvider } from "../types.js";
import { audit } from "../services/audit.js";

export async function handleButton(
  interaction: ButtonInteraction,
  provider: ServerProvider
): Promise<void> {
  const [namespace, action, maybeBackupId, decision, userId] = interaction.customId.split(":");
  if (namespace !== "ark") return;

  const isRollback = action === "rollback";
  const actualDecision = isRollback ? decision : maybeBackupId;
  const actualUserId = isRollback ? userId : decision;

  if (interaction.user.id !== actualUserId) {
    await interaction.reply({ content: "Only the requester can confirm this action.", ephemeral: true });
    return;
  }

  if (actualDecision === "cancel") {
    await interaction.update({ content: "Cancelled.", components: [] });
    return;
  }

  await interaction.deferUpdate();

  if (action === "restart") {
    await provider.restart(`Confirmed by ${interaction.user.tag}`);
    await audit(interaction, `Restart confirmed by ${interaction.user.tag}`);
    await interaction.editReply({ content: "Restart requested.", components: [] });
    return;
  }

  if (isRollback) {
    await provider.restoreBackup(maybeBackupId, `Confirmed by ${interaction.user.tag}`);
    await audit(interaction, `Rollback confirmed by ${interaction.user.tag}: ${maybeBackupId}`);
    await interaction.editReply({ content: `Rollback requested for backup \`${maybeBackupId}\`.`, components: [] });
    return;
  }
}
