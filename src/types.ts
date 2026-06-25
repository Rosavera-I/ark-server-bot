export type ServerState = "online" | "offline" | "starting" | "stopping" | "unknown";

export interface PlayerSummary {
  name: string;
  joinedAt?: Date;
}

export interface BackupSummary {
  id: string;
  label: string;
  createdAt: Date;
  sizeBytes?: number;
}

export interface ServerStatus {
  name: string;
  state: ServerState;
  players: PlayerSummary[];
  message?: string;
}

export interface ProviderCapabilities {
  status: boolean;
  restart: boolean;
  backup: boolean;
  rollback: boolean;
  rcon: boolean;
}

export interface RollbackPlan {
  requestedTime: Date;
  selectedBackup: BackupSummary;
  alternatives: BackupSummary[];
}

export interface ServerProvider {
  readonly name: string;
  capabilities(): ProviderCapabilities;
  getStatus(): Promise<ServerStatus>;
  restart(reason: string): Promise<void>;
  createBackup(label: string): Promise<BackupSummary>;
  listBackups(): Promise<BackupSummary[]>;
  planRollback(targetTime: Date): Promise<RollbackPlan>;
  restoreBackup(backupId: string, reason: string): Promise<void>;
}
