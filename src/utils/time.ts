const durationPattern = /^(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/i;

export function parseRollbackTime(input: string, now = new Date()): Date {
  const value = input.trim();
  const match = durationPattern.exec(value);

  if (match) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multiplier =
      unit.startsWith("m") ? 60_000 :
      unit.startsWith("h") ? 60 * 60_000 :
      24 * 60 * 60_000;
    return new Date(now.getTime() - amount * multiplier);
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  throw new Error("Use a duration like 30m, 2h, 1d, or a timestamp.");
}

export function formatRelative(date: Date, now = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const abs = Math.abs(diffMs);
  const suffix = diffMs >= 0 ? "ago" : "from now";
  const minutes = Math.round(abs / 60_000);

  if (minutes < 90) return `${minutes}m ${suffix}`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours}h ${suffix}`;
  return `${Math.round(hours / 24)}d ${suffix}`;
}
