import type { WrongBookRecord, WrongBookSnapshot } from "./types";

function recordKey(record: WrongBookRecord) {
  return `${record.sourceName}::${record.word}`.toLowerCase();
}

export function emptyWrongBook(userId: string, clientId = "server"): WrongBookSnapshot {
  return {
    schemaVersion: 1,
    userId,
    clientId,
    updatedAt: new Date().toISOString(),
    records: []
  };
}

export function normalizeWrongBook(snapshot: Partial<WrongBookSnapshot>, userId: string): WrongBookSnapshot {
  return {
    schemaVersion: 1,
    userId,
    clientId: snapshot.clientId || "unknown",
    updatedAt: snapshot.updatedAt || new Date().toISOString(),
    records: Array.isArray(snapshot.records) ? snapshot.records : []
  };
}

export function mergeWrongBooks(userId: string, ...snapshots: Array<WrongBookSnapshot | null | undefined>): WrongBookSnapshot {
  const records = new Map<string, WrongBookRecord>();

  snapshots.flatMap((snapshot) => snapshot?.records ?? []).forEach((record) => {
    const key = recordKey(record);
    const existing = records.get(key);
    if (!existing) {
      records.set(key, { ...record });
      return;
    }

    records.set(key, {
      ...existing,
      definitions: Array.from(new Set([...(existing.definitions ?? []), ...(record.definitions ?? [])])),
      wrongCount: Math.max(existing.wrongCount, record.wrongCount),
      testNos: Array.from(new Set([...(existing.testNos ?? []), ...(record.testNos ?? [])])),
      createdAt: existing.createdAt < record.createdAt ? existing.createdAt : record.createdAt,
      updatedAt: existing.updatedAt > record.updatedAt ? existing.updatedAt : record.updatedAt
    });
  });

  return {
    schemaVersion: 1,
    userId,
    clientId: "server-merge",
    updatedAt: new Date().toISOString(),
    records: Array.from(records.values()).sort((a, b) => a.word.localeCompare(b.word))
  };
}
