import type { ChatInputCommandInteraction, GuildMember, Interaction } from "discord.js";
import type { AppConfig } from "../config/env.js";

const safeSubcommands = new Set(["status", "validate"]);

export function canUseArkCommand(interaction: Interaction, config: AppConfig): boolean {
  if (!interaction.isChatInputCommand()) {
    return true;
  }

  if (interaction.commandName !== "ark") {
    return true;
  }

  if (safeSubcommands.has(interaction.options.getSubcommand())) {
    return true;
  }

  if (config.adminRoleIds.size === 0) {
    return false;
  }

  const member = interaction.member;
  return hasAllowedRole(member, config);
}

export async function rejectUnauthorized(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({
    content: "You need an allowed admin role for this ARK action.",
    ephemeral: true
  });
}

function hasAllowedRole(member: GuildMember | APIInteractionMember | null, config: AppConfig): boolean {
  if (!member) return false;

  const roles = "roles" in member ? member.roles : undefined;
  if (!roles) return false;

  if (Array.isArray(roles)) {
    return roles.some((roleId) => config.adminRoleIds.has(roleId));
  }

  return roles.cache.some((role) => config.adminRoleIds.has(role.id));
}

interface APIInteractionMember {
  roles: string[];
}
