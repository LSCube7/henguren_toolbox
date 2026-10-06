import { maxSyncBytes, mergeVocabSnapshots, overwriteVocabSnapshot, parseVocabSnapshot, SyncOperationError, type VocabSyncSnapshot } from "./vocab-sync.ts";
import { emptyWrongBook } from "./wrongbook.ts";

export type VersionedSnapshot = { value: unknown | null; etag: string | null };
export type VocabSnapshotStore = {
  read: () => Promise<VersionedSnapshot>;
  backup: (snapshot: unknown, id: string) => Promise<void>;
  write: (snapshot: VocabSyncSnapshot, etag: string | null) => Promise<void>;
};
export function isConditionalConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return [409, 412].includes(value.$metadata?.httpStatusCode ?? 0) || value.name === "PreconditionFailed" || value.name === "ConditionalRequestConflict";
}

export async function saveVocabSnapshot(store: VocabSnapshotStore, userId: string, body: unknown, mode: "merge" | "overwrite", expectedVersion?: string | null) {
  const incoming = parseVocabSnapshot(body, userId);
  const includesMastery = Boolean(body && typeof body === "object" && "masteryRecords" in body);
  for (let attempt = 0; attempt < (mode === "merge" ? 3 : 1); attempt++) {
    const current = await store.read();
    if (mode === "overwrite" && expectedVersion !== undefined && current.etag !== expectedVersion) throw new SyncOperationError("SYNC_CONFLICT", 409);
    const cloud = parseVocabSnapshot(current.value ?? emptyWrongBook(userId), userId);
    const snapshot = mode === "merge" ? mergeVocabSnapshots(userId, cloud, incoming) : overwriteVocabSnapshot(userId, incoming, cloud, includesMastery);
    snapshot.updatedAt = new Date().toISOString();
    snapshot.revision = crypto.randomUUID();
    if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > maxSyncBytes) throw new SyncOperationError("SNAPSHOT_TOO_LARGE", 413);
    // Back up both the previous version and the candidate before changing current.
    // Failed backups therefore never leave a destructive overwrite behind.
    try {
      if (current.value !== null) await store.backup(current.value, `${snapshot.revision}-before`);
      await store.backup(snapshot, `${snapshot.revision}-candidate`);
    } catch {
      throw new SyncOperationError("BACKUP_FAILED", 503);
    }
    try {
      await store.write(snapshot, current.etag);
      return snapshot;
    } catch (error) {
      if (!isConditionalConflict(error)) throw error;
      if (mode === "overwrite" || attempt === 2) throw new SyncOperationError("SYNC_CONFLICT", 409);
    }
  }
  throw new SyncOperationError("SYNC_CONFLICT", 409);
}
