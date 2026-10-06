export const cloudCheckInterval = 5 * 60 * 1000;
export function nextSyncAt(pending: boolean, lastChange: number, firstPending: number, lastCheck: number) {
  return pending ? Math.min(lastChange + 10000, firstPending + 60000) : lastCheck + cloudCheckInterval;
}
export function retrySyncDelay(attempt: number, random = Math.random()) {
  return Math.min(300000, 15000 * 2 ** Math.min(attempt, 5)) * (0.8 + Math.max(0, Math.min(1, random)) * 0.2);
}
export function canRetrySync(code: string) {
  return ["NETWORK_ERROR", "CLOUD_UNAVAILABLE", "SERVER_ERROR", "BACKUP_FAILED", "SYNC_CONFLICT", "SYNC_BUSY", "SOURCE_UNAVAILABLE"].includes(code);
}
