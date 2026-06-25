import type { BackupSummary, RollbackPlan } from "../types.js";

export function selectRollbackBackup(backups: BackupSummary[], requestedTime: Date): RollbackPlan {
  if (backups.length === 0) {
    throw new Error("No backups are available to restore.");
  }

  const sorted = [...backups].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const olderOrEqual = sorted.filter((backup) => backup.createdAt.getTime() <= requestedTime.getTime());
  const selectedBackup = olderOrEqual[0] ?? sorted[sorted.length - 1];

  return {
    requestedTime,
    selectedBackup,
    alternatives: sorted.filter((backup) => backup.id !== selectedBackup.id).slice(0, 3)
  };
}
