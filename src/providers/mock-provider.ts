import type {
  BackupSummary,
  ProviderCapabilities,
  RollbackPlan,
  ServerProvider,
  ServerStatus
} from "../types.js";
import { selectRollbackBackup } from "./backup-selection.js";

export class MockProvider implements ServerProvider {
  readonly name = "mock";
  private backups: BackupSummary[];

  constructor(private readonly serverName: string) {
    const now = Date.now();
    this.backups = [
      { id: "mock-15m", label: "Automatic backup - 15m ago", createdAt: new Date(now - 15 * 60_000) },
      { id: "mock-1h", label: "Automatic backup - 1h ago", createdAt: new Date(now - 60 * 60_000) },
      { id: "mock-6h", label: "Automatic backup - 6h ago", createdAt: new Date(now - 6 * 60 * 60_000) }
    ];
  }

  capabilities(): ProviderCapabilities {
    return { status: true, restart: true, backup: true, rollback: true, rcon: false };
  }

  async getStatus(): Promise<ServerStatus> {
    return {
      name: this.serverName,
      state: "online",
      players: [{ name: "DemoSurvivor" }],
      message: "Mock provider is active. No real server action was taken."
    };
  }

  async restart(): Promise<void> {
    return;
  }

  async createBackup(label: string): Promise<BackupSummary> {
    const backup = {
      id: `mock-${Date.now()}`,
      label,
      createdAt: new Date()
    };
    this.backups.unshift(backup);
    return backup;
  }

  async listBackups(): Promise<BackupSummary[]> {
    return [...this.backups];
  }

  async planRollback(targetTime: Date): Promise<RollbackPlan> {
    return selectRollbackBackup(this.backups, targetTime);
  }

  async restoreBackup(): Promise<void> {
    return;
  }
}
