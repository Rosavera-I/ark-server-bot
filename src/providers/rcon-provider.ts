import { Rcon } from "rcon-client";
import type {
  BackupSummary,
  ProviderCapabilities,
  RollbackPlan,
  ServerProvider,
  ServerStatus
} from "../types.js";

export interface RconProviderOptions {
  host: string;
  port: number;
  password: string;
  serverName: string;
}

export class RconProvider implements ServerProvider {
  readonly name = "rcon";

  constructor(private readonly options: RconProviderOptions) {}

  capabilities(): ProviderCapabilities {
    return { status: true, restart: false, backup: false, rollback: false, rcon: true };
  }

  async getStatus(): Promise<ServerStatus> {
    const response = await this.command("ListPlayers");
    const players = response
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.toLowerCase().includes("no players"))
      .map((name) => ({ name }));

    return {
      name: this.options.serverName,
      state: "online",
      players,
      message: "RCON connected. Backup and rollback require hosting panel or file access."
    };
  }

  async restart(): Promise<void> {
    throw new Error("RCON provider does not support safe restart yet.");
  }

  async createBackup(): Promise<BackupSummary> {
    throw new Error("RCON cannot create hosting-panel backups.");
  }

  async listBackups(): Promise<BackupSummary[]> {
    return [];
  }

  async planRollback(): Promise<RollbackPlan> {
    throw new Error("RCON cannot restore backups. Use a panel/filesystem provider.");
  }

  async restoreBackup(): Promise<void> {
    throw new Error("RCON cannot restore backups. Use a panel/filesystem provider.");
  }

  private async command(command: string): Promise<string> {
    const client = await Rcon.connect({
      host: this.options.host,
      port: this.options.port,
      password: this.options.password
    });

    try {
      return await client.send(command);
    } finally {
      client.end();
    }
  }
}
