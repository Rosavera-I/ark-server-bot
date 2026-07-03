import type { BackupSummary } from "../types.js";

export const RCON_ALLOWLIST = new Set(["SaveWorld", "ListPlayers", "GetGameLog", "serverchat", "DestroyWildDinos"]);

export function createConfirmationToken(action: string, id: string): string {
  return `${action}:${id}`.toUpperCase().replace(/[^A-Z0-9:]/g, "");
}

export function requireAllowedRconCommand(command: string): string {
  const trimmed = command.trim();
  if (containsControlCharacter(trimmed)) {
    throw new Error("RCON command cannot contain control characters");
  }

  const [name] = trimmed.split(/\s+/, 1);
  const allowed = [...RCON_ALLOWLIST].some((allowedName) => allowedName.toLowerCase() === name.toLowerCase());
  if (!allowed) {
    throw new Error(`RCON command '${name}' is not allowlisted`);
  }
  return trimmed;
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
  if (containsControlCharacter(trimmed)) {
    throw new Error("Broadcast message cannot contain control characters");
  }
  if (trimmed.length > 180) {
    throw new Error("Broadcast message must be 180 characters or fewer");
  }
  return trimmed;
}

export function buildBroadcastCommand(message: string): string {
  return `ServerChat ${ensureBroadcastSafe(message)}`;
}

function containsControlCharacter(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}
