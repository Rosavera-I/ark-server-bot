import type { BackupSummary } from "../types.js";

export const RCON_ALLOWLIST = new Set(["SaveWorld", "ListPlayers", "GetGameLog"]);

export function createConfirmationToken(action: string, id: string): string {
  return `${action}:${id}`.toUpperCase().replace(/[^A-Z0-9:]/g, "");
}

export function requireAllowedRconCommand(command: string): void {
  const [name] = command.trim().split(/\s+/, 1);
  if (!RCON_ALLOWLIST.has(name)) {
    throw new Error(`RCON command '${name}' is not allowlisted`);
  }
}

export function findNearestBackup(
  backups: BackupSummary[],
  targetTime: Date
): BackupSummary | undefined {
  return backups
    .filter((backup) => backup.createdAt <= targetTime)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

export function ensureBroadcastSafe(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length < 1) {
    throw new Error("Broadcast message cannot be empty");
  }
  if (trimmed.length > 180) {
    throw new Error("Broadcast message must be 180 characters or fewer");
  }
  return trimmed;
}
