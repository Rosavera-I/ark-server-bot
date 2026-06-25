import type {
  BackupSummary,
  ProviderCapabilities,
  RollbackPlan,
  ServerProvider,
  ServerStatus
} from "../types.js";
import { selectRollbackBackup } from "./backup-selection.js";
import { buildBroadcastCommand, requireAllowedRconCommand } from "../services/safety.js";

interface PterodactylBackupAttributes {
  uuid: string;
  name: string;
  bytes?: number;
  created_at: string;
}

interface PterodactylBackupResponse {
  data: Array<{ attributes: PterodactylBackupAttributes }>;
}

export interface PterodactylProviderOptions {
  baseUrl: string;
  apiKey: string;
  serverId: string;
  serverName: string;
  stopBeforeRestore: boolean;
  startAfterRestore: boolean;
}

export class PterodactylProvider implements ServerProvider {
  readonly name = "pterodactyl";

  constructor(private readonly options: PterodactylProviderOptions) {}

  capabilities(): ProviderCapabilities {
    return {
      status: true,
      restart: true,
      backup: true,
      rollback: true,
      rcon: false,
      command: true,
      broadcast: true,
      save: true
    };
  }

  async validateConnection(): Promise<string> {
    const status = await this.getStatus();
    const backups = await this.listBackups();
    return `Panel connected. Server is ${status.state}; ${backups.length} backups visible.`;
  }

  async getStatus(): Promise<ServerStatus> {
    const response = await this.request<{ attributes: { current_state?: string } }>(
      `/api/client/servers/${this.options.serverId}/resources`
    );

    return {
      name: this.options.serverName,
      state: normalizeState(response.attributes.current_state),
      players: [],
      message: "Panel status only. Player list needs RCON or game query support."
    };
  }

  async restart(reason: string): Promise<void> {
    await this.setPower("restart");
    void reason;
  }

  async createBackup(label: string): Promise<BackupSummary> {
    const response = await this.request<
      { attributes: PterodactylBackupAttributes } | { data: { attributes: PterodactylBackupAttributes } }
    >(
      `/api/client/servers/${this.options.serverId}/backups`,
      {
        method: "POST",
        body: JSON.stringify({ name: label })
      }
    );
    return mapBackup("data" in response ? response.data.attributes : response.attributes);
  }

  async listBackups(): Promise<BackupSummary[]> {
    const response = await this.request<PterodactylBackupResponse>(
      `/api/client/servers/${this.options.serverId}/backups`
    );
    return response.data.map((item) => mapBackup(item.attributes));
  }

  async planRollback(targetTime: Date): Promise<RollbackPlan> {
    return selectRollbackBackup(await this.listBackups(), targetTime);
  }

  async restoreBackup(backupId: string, reason: string): Promise<void> {
    if (this.options.stopBeforeRestore) {
      await this.setPower("stop");
    }

    await this.request(`/api/client/servers/${this.options.serverId}/backups/${backupId}/restore`, {
      method: "POST",
      body: JSON.stringify({ truncate: true })
    });

    if (this.options.startAfterRestore) {
      await this.setPower("start");
    }

    void reason;
  }

  async sendCommand(command: string): Promise<string> {
    const safeCommand = requireAllowedRconCommand(command);
    await this.request(`/api/client/servers/${this.options.serverId}/command`, {
      method: "POST",
      body: JSON.stringify({ command: safeCommand })
    });
    return "Command accepted by panel.";
  }

  async broadcast(message: string): Promise<void> {
    await this.sendCommand(buildBroadcastCommand(message));
  }

  async saveWorld(reason: string): Promise<void> {
    await this.sendCommand("SaveWorld");
    void reason;
  }

  private async setPower(signal: "start" | "stop" | "restart"): Promise<void> {
    await this.request(`/api/client/servers/${this.options.serverId}/power`, {
      method: "POST",
      body: JSON.stringify({ signal })
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = new URL(path, this.options.baseUrl);
    const signal = init.signal ?? AbortSignal.timeout(15_000);
    const response = await fetch(url, {
      ...init,
      signal,
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        Accept: "Application/vnd.pterodactyl.v1+json",
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Pterodactyl API ${response.status}: ${body.slice(0, 400)}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}

function mapBackup(attributes: PterodactylBackupAttributes): BackupSummary {
  return {
    id: attributes.uuid,
    label: attributes.name,
    createdAt: new Date(attributes.created_at),
    sizeBytes: attributes.bytes
  };
}

function normalizeState(state: string | undefined): ServerStatus["state"] {
  if (state === "running") return "online";
  if (state === "offline") return "offline";
  if (state === "starting") return "starting";
  if (state === "stopping") return "stopping";
  return "unknown";
}
