import type {
  BackupSummary,
  ProviderCapabilities,
  RollbackPlan,
  ServerProvider,
  ServerStatus
} from "../types.js";
import { selectRollbackBackup } from "./backup-selection.js";
import { buildBroadcastCommand, requireAllowedRconCommand } from "../services/safety.js";

interface PterodactylFileAttributes {
  name: string;
  size: number;
  is_file: boolean;
  created_at?: string;
  modified_at?: string;
}

interface PterodactylFileListResponse {
  data: Array<{ attributes: PterodactylFileAttributes }>;
}

interface PterodactylDownloadResponse {
  attributes: {
    url: string;
  };
}

interface PterodactylResourcesResponse {
  attributes: {
    current_state?: string;
    is_suspended?: boolean;
    resources?: {
      memory_bytes?: number;
      cpu_absolute?: number;
      disk_bytes?: number;
      network_rx_bytes?: number;
      network_tx_bytes?: number;
      uptime?: number;
    };
  };
}

export interface PterodactylProviderOptions {
  baseUrl: string;
  apiKey: string;
  serverId: string;
  serverName: string;
  saveDirectory: string;
  mapName: string;
  safetyPrefix: string;
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
    return `Panel connected. Server is ${status.state}; ${backups.length} ARK save snapshots visible.`;
  }

  async getStatus(): Promise<ServerStatus> {
    const response = await this.request<PterodactylResourcesResponse>(
      `/api/client/servers/${this.options.serverId}/resources`
    );
    const resources = response.attributes.resources;

    return {
      name: this.options.serverName,
      state: normalizeState(response.attributes.current_state),
      players: [],
      details: [
        response.attributes.is_suspended ? "Panel suspension: yes" : "Panel suspension: no",
        resources?.cpu_absolute === undefined ? undefined : `CPU: ${resources.cpu_absolute.toFixed(1)}%`,
        resources?.memory_bytes === undefined ? undefined : `Memory: ${formatBytes(resources.memory_bytes)}`,
        resources?.disk_bytes === undefined ? undefined : `Disk: ${formatBytes(resources.disk_bytes)}`,
        resources?.network_rx_bytes === undefined ? undefined : `Network in: ${formatBytes(resources.network_rx_bytes)}`,
        resources?.network_tx_bytes === undefined ? undefined : `Network out: ${formatBytes(resources.network_tx_bytes)}`,
        resources?.uptime === undefined ? undefined : `Uptime: ${formatDuration(resources.uptime)}`
      ].filter((detail): detail is string => detail !== undefined),
      message: "Panel status cannot reliably list players. Player names need direct RCON or game-query support."
    };
  }

  async restart(reason: string): Promise<void> {
    await this.setPower("restart");
    void reason;
  }

  async start(reason: string): Promise<void> {
    await this.setPower("start");
    await this.waitForServerState("online", "server to start");
    void reason;
  }

  async createBackup(label: string): Promise<BackupSummary> {
    await this.sendCommand("SaveWorld");
    await sleep(5_000);

    const snapshotName = `${this.options.mapName}_${formatArkTimestamp(new Date())}_discord.ark`;
    const snapshotPath = joinPath(this.options.saveDirectory, snapshotName);
    const liveFile = await this.downloadFile(this.liveSavePath());
    await this.writeFile(snapshotPath, liveFile);

    return {
      id: snapshotName,
      label: label ? `${snapshotName} (${label})` : snapshotName,
      createdAt: new Date(),
      sizeBytes: liveFile.byteLength
    };
  }

  async listBackups(): Promise<BackupSummary[]> {
    const response = await this.request<PterodactylFileListResponse>(
      `/api/client/servers/${this.options.serverId}/files/list?directory=${encodeURIComponent(this.options.saveDirectory)}`
    );
    return response.data
      .map((item) => mapSnapshotFile(item.attributes, this.options.mapName))
      .filter((backup): backup is BackupSummary => backup !== undefined)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async planRollback(targetTime: Date): Promise<RollbackPlan> {
    return selectRollbackBackup(await this.listBackups(), targetTime);
  }

  async restoreBackup(backupId: string, reason: string): Promise<void> {
    const snapshot = await this.findSnapshot(backupId);
    const currentStatus = await this.getStatus();
    let stopIssued = false;
    let startIssued = false;

    try {
      if (currentStatus.state === "online") {
        await this.broadcast(`Server rollback starting: restoring ${snapshot.id}`);
      }

      if (this.options.stopBeforeRestore) {
        await this.setPower("stop");
        stopIssued = true;
        await this.waitForServerState("offline", "server to stop before restore");
      }

      const livePath = this.liveSavePath();
      const safetyPath = joinPath(
        this.options.saveDirectory,
        `${this.options.safetyPrefix}-${formatCompactTimestamp(new Date())}-${this.options.mapName}.ark`
      );
      const liveFile = await this.downloadFile(livePath);
      await this.writeFile(safetyPath, liveFile);

      const snapshotFile = await this.downloadFile(joinPath(this.options.saveDirectory, snapshot.id));
      await this.writeFile(livePath, snapshotFile);

      if (this.options.startAfterRestore) {
        await this.setPower("start");
        startIssued = true;
        await this.waitForServerState("online", "server to start after restore");
      }
    } catch (error) {
      if (this.options.startAfterRestore && stopIssued && !startIssued) {
        await this.tryStartAfterFailedRestore(error);
      }
      throw error;
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

  async destroyWildDinos(reason: string): Promise<void> {
    await this.sendCommand("DestroyWildDinos");
    void reason;
  }

  private async setPower(signal: "start" | "stop" | "restart"): Promise<void> {
    await this.request(`/api/client/servers/${this.options.serverId}/power`, {
      method: "POST",
      body: JSON.stringify({ signal })
    });
  }

  private async startAndWait(action: string): Promise<void> {
    await this.setPower("start");
    await this.waitForServerState("online", action);
  }

  private async tryStartAfterFailedRestore(originalError: unknown): Promise<void> {
    let lastState: ServerStatus["state"] | undefined;

    try {
      await this.pollUntil("server to become restartable after failed restore", async () => {
        const status = await this.getStatus();
        lastState = status.state;

        if (status.state === "online") {
          return true;
        }

        if (status.state === "offline") {
          await this.startAndWait("server to recover after failed restore");
          return true;
        }

        return false;
      }, () => lastState ? `Last observed state: ${lastState}.` : undefined);
    } catch (recoveryError) {
      throw new Error(
        [
          errorMessage(originalError),
          "Recovery start also failed after the restore flow issued a stop.",
          errorMessage(recoveryError)
        ].join(" ")
      );
    }
  }

  private async waitForServerState(expected: ServerStatus["state"], action: string): Promise<void> {
    let lastState: ServerStatus["state"] | undefined;
    await this.pollUntil(action, async () => {
      const status = await this.getStatus();
      lastState = status.state;
      return status.state === expected;
    }, () => lastState ? `Last observed state: ${lastState}.` : undefined);
  }

  private async findSnapshot(backupId: string): Promise<BackupSummary> {
    const snapshots = await this.listBackups();
    const snapshot = snapshots.find((backup) => backup.id === backupId);
    if (!snapshot) {
      throw new Error(`ARK save snapshot '${backupId}' was not found.`);
    }
    return snapshot;
  }

  private liveSavePath(): string {
    return joinPath(this.options.saveDirectory, `${this.options.mapName}.ark`);
  }

  private async downloadFile(path: string): Promise<ArrayBuffer> {
    const response = await this.request<PterodactylDownloadResponse>(
      `/api/client/servers/${this.options.serverId}/files/download?file=${encodeURIComponent(path)}`
    );
    const fileResponse = await fetch(response.attributes.url, {
      signal: AbortSignal.timeout(60_000)
    });

    if (!fileResponse.ok) {
      const body = await fileResponse.text();
      throw new Error(`Pterodactyl file download ${fileResponse.status}: ${body.slice(0, 400)}`);
    }

    return fileResponse.arrayBuffer();
  }

  private async writeFile(path: string, content: ArrayBuffer): Promise<void> {
    await this.request(`/api/client/servers/${this.options.serverId}/files/write?file=${encodeURIComponent(path)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream"
      },
      body: Buffer.from(content)
    });
  }

  private async pollUntil(action: string, check: () => Promise<boolean>, detail?: () => string | undefined): Promise<void> {
    const timeoutMs = this.options.restoreTimeoutMs ?? 20 * 60_000;
    const intervalMs = this.options.pollIntervalMs ?? 5_000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
      if (await check()) {
        return;
      }
      await sleep(intervalMs);
    }

    throw new Error(`Timed out waiting for ${action}. ${detail?.() ?? ""}`.trim());
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mapSnapshotFile(attributes: PterodactylFileAttributes, mapName: string): BackupSummary | undefined {
  if (!attributes.is_file) return undefined;

  const createdAt = parseArkSnapshotDate(attributes.name, mapName);
  if (!createdAt) return undefined;

  return {
    id: attributes.name,
    label: attributes.name,
    createdAt,
    sizeBytes: attributes.size
  };
}

function parseArkSnapshotDate(filename: string, mapName: string): Date | undefined {
  const escapedMapName = mapName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = filename.match(
    new RegExp(`^${escapedMapName}_(\\d{2})\\.(\\d{2})\\.(\\d{4})_(\\d{2})\\.(\\d{2})\\.(\\d{2})(?:_[A-Za-z0-9-]+)?\\.ark(?:rbf)?$`)
  );
  if (!match) return undefined;

  const [, day, month, year, hour, minute, second] = match;
  return new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ));
}

function formatArkTimestamp(date: Date): string {
  return [
    pad(date.getUTCDate()),
    pad(date.getUTCMonth() + 1),
    date.getUTCFullYear()
  ].join(".") + "_" + [
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds())
  ].join(".");
}

function formatCompactTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function formatBytes(bytes: number): string {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 || value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  return [
    days > 0 ? `${days}d` : undefined,
    hours > 0 ? `${hours}h` : undefined,
    `${minutes}m`
  ].filter(Boolean).join(" ");
}

function joinPath(directory: string, filename: string): string {
  return `${directory.replace(/\/+$/, "")}/${filename.replace(/^\/+/, "")}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function normalizeState(state: string | undefined): ServerStatus["state"] {
  if (state === "running") return "online";
  if (state === "offline") return "offline";
  if (state === "starting") return "starting";
  if (state === "stopping") return "stopping";
  return "unknown";
}
