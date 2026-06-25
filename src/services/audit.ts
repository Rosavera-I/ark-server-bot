import type { ButtonInteraction, ChatInputCommandInteraction } from "discord.js";
import type { AppConfig } from "../config/env.js";

type SendableChannel = {
  send: (message: string) => Promise<unknown>;
};

function isSendableChannel(channel: unknown): channel is SendableChannel {
  return typeof channel === "object" && channel !== null && "send" in channel && typeof channel.send === "function";
}

export async function audit(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  config: Pick<AppConfig, "DISCORD_AUDIT_CHANNEL_ID">,
  message: string
): Promise<void> {
  const channelId = config.DISCORD_AUDIT_CHANNEL_ID;
  if (!channelId) return;

  const channel = await interaction.client.channels.fetch(channelId);
  if (!isSendableChannel(channel)) return;

  await channel.send(`[ARK audit] ${message}`);
}

export async function auditSafely(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  config: Pick<AppConfig, "DISCORD_AUDIT_CHANNEL_ID">,
  message: string,
  onFailure?: (error: unknown) => void
): Promise<void> {
  try {
    await audit(interaction, config, message);
  } catch (error) {
    onFailure?.(error);
  }
}
