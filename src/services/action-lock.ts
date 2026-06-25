export interface ActionLockOptions {
  now?: () => number;
  ttlMs?: number;
}

export class ActionLock {
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly expiresAtByKey = new Map<string, number>();

  constructor(options: ActionLockOptions = {}) {
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? 5 * 60_000;
  }

  acquire(key: string): boolean {
    this.prune();
    if (this.expiresAtByKey.has(key)) {
      return false;
    }

    this.expiresAtByKey.set(key, this.now() + this.ttlMs);
    return true;
  }

  release(key: string): void {
    this.expiresAtByKey.delete(key);
  }

  private prune(): void {
    const now = this.now();
    for (const [key, expiresAt] of this.expiresAtByKey) {
      if (expiresAt <= now) {
        this.expiresAtByKey.delete(key);
      }
    }
  }
}
