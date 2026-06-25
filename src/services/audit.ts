import type { ButtonInteraction, ChatInputCommandInteraction, TextBasedChannel } from "discord.js";

export async function audit(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  message: string
): Promise<void> {
  const channelId = process.env.DISCORD_AUDIT_CHANNEL_ID;
  if (!channelId) return;

  const channel = await interaction.client.channels.fetch(channelId);
  if (!channel || !("send" in channel)) return;

  await (channel as TextBasedChannel).send(`[ARK audit] ${message}`);
}
