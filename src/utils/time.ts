export function getTimeLeft(createdAt: string, ttlSeconds: number): number {
  const created = new Date(createdAt).getTime();
  const expires = created + ttlSeconds * 1000;
  return Math.max(0, Math.floor((expires - Date.now()) / 1000));
}

export function formatTimeLeft(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
