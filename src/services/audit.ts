import type { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";

type SendableChannel = {
  send: (message: string) => Promise<unknown>;
};

function isSendableChannel(channel: unknown): channel is SendableChannel {
  return typeof channel === "object" && channel !== null && "send" in channel && typeof channel.send === "function";
}

export async function audit(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  message: string
): Promise<void> {
  const channelId = process.env.DISCORD_AUDIT_CHANNEL_ID;
  if (!channelId) return;

  const channel = await interaction.client.channels.fetch(channelId);
  if (!isSendableChannel(channel)) return;

  await channel.send(`[ARK audit] ${message}`);
}
