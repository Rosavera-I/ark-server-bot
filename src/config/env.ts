import { z } from "zod";

const envBoolean = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return value;
}, z.boolean());

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1).optional(),
  DISCORD_AUDIT_CHANNEL_ID: z.string().optional(),
  SERVER_NAME: z.string().default("Friend ARK"),
  ARK_ADMIN_ROLE_IDS: z.string().optional().default(""),
  SERVER_PROVIDER: z.enum(["mock", "pterodactyl", "rcon"]).default("mock"),
  PTERODACTYL_BASE_URL: z.string().optional(),
  PTERODACTYL_API_KEY: z.string().optional(),
  PTERODACTYL_SERVER_ID: z.string().optional(),
  PTERODACTYL_STOP_BEFORE_RESTORE: envBoolean.default(true),
  PTERODACTYL_START_AFTER_RESTORE: envBoolean.default(true),
  RCON_HOST: z.string().optional(),
  RCON_PORT: z.coerce.number().int().positive().default(27020),
  RCON_PASSWORD: z.string().optional()
});

export type AppConfig = z.infer<typeof envSchema> & {
  adminRoleIds: Set<string>;
};

export function loadConfig(env = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  return {
    ...parsed,
    adminRoleIds: new Set(
      parsed.ARK_ADMIN_ROLE_IDS.split(",")
        .map((role) => role.trim())
        .filter(Boolean)
    )
  };
}
