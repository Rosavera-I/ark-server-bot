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
  details?: string[];
  message?: string;
}

export interface ProviderCapabilities {
  status: boolean;
  restart: boolean;
  backup: boolean;
  rollback: boolean;
  rcon: boolean;
  command: boolean;
  broadcast: boolean;
  save: boolean;
}

export interface RollbackPlan {
  requestedTime: Date;
  selectedBackup: BackupSummary;
  alternatives: BackupSummary[];
}

export interface ServerProvider {
  readonly name: string;
  capabilities(): ProviderCapabilities;
  validateConnection(): Promise<string>;
  getStatus(): Promise<ServerStatus>;
  start(reason: string): Promise<void>;
  restart(reason: string): Promise<void>;
  createBackup(label: string): Promise<BackupSummary>;
  listBackups(): Promise<BackupSummary[]>;
  planRollback(targetTime: Date): Promise<RollbackPlan>;
  restoreBackup(backupId: string, reason: string): Promise<void>;
  sendCommand(command: string): Promise<string>;
  broadcast(message: string): Promise<void>;
  saveWorld(reason: string): Promise<void>;
  destroyWildDinos(reason: string): Promise<void>;
}
