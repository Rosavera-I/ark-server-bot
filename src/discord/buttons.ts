import type { ButtonInteraction } from "discord.js";
import type { ServerProvider } from "../types.js";
import { audit } from "../services/audit.js";
import { parseActionId } from "./action-ids.js";

export async function handleButton(
  interaction: ButtonInteraction,
  provider: ServerProvider
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

  if (parsed.action === "restart") {
    await provider.restart(`Confirmed by ${interaction.user.tag}`);
    await audit(interaction, `Restart confirmed by ${interaction.user.tag}`);
    await interaction.editReply({ content: "Restart requested.", components: [] });
    return;
  }

  if (parsed.action === "rollback" || parsed.action === "restore") {
    if (!parsed.targetId) {
      await interaction.editReply({ content: "Missing backup id for restore.", components: [] });
      return;
    }

    await provider.restoreBackup(parsed.targetId, `Confirmed by ${interaction.user.tag}`);
    await audit(interaction, `${parsed.action} confirmed by ${interaction.user.tag}: ${parsed.targetId}`);
    await interaction.editReply({
      content: `${parsed.action === "rollback" ? "Rollback" : "Restore"} requested for backup \`${parsed.targetId}\`.`,
      components: []
    });
    return;
  }
}
