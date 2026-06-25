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
  is_locked?: boolean;
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
  pollIntervalMs?: number;
  restoreTimeoutMs?: number;
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
      await this.waitForServerState("offline", "server to stop before restore");
    }

    await this.waitForBackupUnlocked(backupId, "backup to become restorable");
    await this.request(`/api/client/servers/${this.options.serverId}/backups/${backupId}/restore`, {
      method: "POST",
      body: JSON.stringify({ truncate: true })
    });
    await this.waitForBackupUnlocked(backupId, "restore to finish");

    if (this.options.startAfterRestore) {
      await this.setPower("start");
      await this.waitForServerState("online", "server to start after restore");
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

  private async waitForServerState(expected: ServerStatus["state"], action: string): Promise<void> {
    await this.pollUntil(action, async () => {
      const status = await this.getStatus();
      return status.state === expected;
    });
  }

  private async waitForBackupUnlocked(backupId: string, action: string): Promise<void> {
    await this.pollUntil(action, async () => {
      const response = await this.request<PterodactylBackupResponse>(
        `/api/client/servers/${this.options.serverId}/backups`
      );
      const backup = response.data.find((item) => item.attributes.uuid === backupId);
      return backup ? backup.attributes.is_locked !== true : true;
    });
  }

  private async pollUntil(action: string, check: () => Promise<boolean>): Promise<void> {
    const timeoutMs = this.options.restoreTimeoutMs ?? 5 * 60_000;
    const intervalMs = this.options.pollIntervalMs ?? 3_000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
      if (await check()) {
        return;
      }
      await sleep(intervalMs);
    }

    throw new Error(`Timed out waiting for ${action}.`);
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
