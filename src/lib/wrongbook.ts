import type { WrongBookAttempt, WrongBookRecord, WrongBookSnapshot, WrongBookTombstone } from "./types";

function recordId(record: Partial<WrongBookRecord>) {
  return String(record.id || `${record.sourceName ?? "custom"}:${record.word ?? "unknown"}`).toLowerCase();
}

function uniqueStrings(values: unknown) {
  return Array.isArray(values) ? Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))) : [];
}

function latestTombstones(values: WrongBookTombstone[]) {
  const tombstones = new Map<string, WrongBookTombstone>();
  values.forEach((value) => {
    const existing = tombstones.get(value.id);
    if (!existing || existing.deletedAt < value.deletedAt) tombstones.set(value.id, value);
  });
  return Array.from(tombstones.values());
}

function normalizeTombstones(values: unknown, normalizeId: (id: string) => string): WrongBookTombstone[] {
  if (!Array.isArray(values)) return [];
  return latestTombstones(
    values
      .filter((value): value is Partial<WrongBookTombstone> => Boolean(value && typeof value === "object"))
      .map((value) => ({
        id: normalizeId(String(value.id ?? "")),
        clientId: String(value.clientId ?? "legacy"),
        deletedAt: String(value.deletedAt ?? new Date(0).toISOString())
      }))
      .filter((value) => value.id.length > 0)
  );
}

function normalizeAttempts(record: Partial<WrongBookRecord>, id: string) {
  const attempts = new Map<string, WrongBookAttempt>();
  if (Array.isArray(record.wrongAttempts)) {
    record.wrongAttempts.forEach((attempt) => {
      if (!attempt || typeof attempt !== "object") return;
      const attemptId = String(attempt.id ?? "");
      if (!attemptId) return;
      attempts.set(attemptId, {
        id: attemptId,
        testNo: attempt.testNo ? String(attempt.testNo) : undefined,
        batchName: attempt.batchName ? String(attempt.batchName) : undefined,
        clientId: String(attempt.clientId ?? "legacy"),
        createdAt: String(attempt.createdAt ?? record.createdAt ?? new Date(0).toISOString())
      });
    });
  }

  const legacyTestNos = uniqueStrings(record.testNos);
  const legacyBatchNames = uniqueStrings(record.batchNames);
  if (attempts.size === 0) {
    legacyTestNos.forEach((testNo, index) => {
      const attemptId = `legacy:${id}:${testNo}`;
      attempts.set(attemptId, {
        id: attemptId,
        testNo,
        batchName: legacyBatchNames[index] ?? legacyBatchNames[0],
        clientId: "legacy",
        createdAt: String(record.createdAt ?? new Date(0).toISOString())
      });
    });
  }

  const legacyWrongCount = Math.max(0, Number(record.wrongCount) || 0);
  for (let index = attempts.size; index < legacyWrongCount; index += 1) {
    const attemptId = `legacy:${id}:count:${index + 1}`;
    attempts.set(attemptId, {
      id: attemptId,
      clientId: "legacy",
      createdAt: String(record.createdAt ?? new Date(0).toISOString())
    });
  }
  return Array.from(attempts.values());
}

function normalizeRecord(record: Partial<WrongBookRecord>): WrongBookRecord {
  const id = recordId(record);
  const attempts = normalizeAttempts(record, id);
  return {
    id,
    word: String(record.word ?? ""),
    sourceName: String(record.sourceName ?? "custom"),
    sourceTitle: record.sourceTitle ? String(record.sourceTitle) : undefined,
    definitions: uniqueStrings(record.definitions),
    zhDefinitions: uniqueStrings(record.zhDefinitions),
    wrongCount: attempts.length,
    wrongAttempts: attempts,
    testNos: Array.from(new Set(attempts.flatMap((attempt) => (attempt.testNo ? [attempt.testNo] : [])))),
    batchNames: Array.from(new Set(attempts.flatMap((attempt) => (attempt.batchName ? [attempt.batchName] : [])))),
    createdAt: String(record.createdAt ?? new Date().toISOString()),
    updatedAt: String(record.updatedAt ?? record.createdAt ?? new Date().toISOString())
  };
}

function mergeRecords(existing: WrongBookRecord, incoming: WrongBookRecord) {
  const attempts = new Map<string, WrongBookAttempt>();
  [...(existing.wrongAttempts ?? []), ...(incoming.wrongAttempts ?? [])].forEach((attempt) => attempts.set(attempt.id, attempt));
  const wrongAttempts = Array.from(attempts.values());
  const newest = existing.updatedAt >= incoming.updatedAt ? existing : incoming;
  return {
    ...existing,
    ...newest,
    definitions: Array.from(new Set([...(existing.definitions ?? []), ...(incoming.definitions ?? [])])),
    zhDefinitions: Array.from(new Set([...(existing.zhDefinitions ?? []), ...(incoming.zhDefinitions ?? [])])),
    wrongCount: wrongAttempts.length,
    wrongAttempts,
    testNos: Array.from(new Set(wrongAttempts.flatMap((attempt) => (attempt.testNo ? [attempt.testNo] : [])))),
    batchNames: Array.from(new Set(wrongAttempts.flatMap((attempt) => (attempt.batchName ? [attempt.batchName] : [])))),
    createdAt: existing.createdAt < incoming.createdAt ? existing.createdAt : incoming.createdAt,
    updatedAt: existing.updatedAt > incoming.updatedAt ? existing.updatedAt : incoming.updatedAt
  } satisfies WrongBookRecord;
}

function applyTombstones(records: WrongBookRecord[], deletedRecords: WrongBookTombstone[], deletedBatches: WrongBookTombstone[]) {
  const recordDeletes = new Map(deletedRecords.map((tombstone) => [tombstone.id, tombstone]));
  const batchDeletes = new Map(deletedBatches.map((tombstone) => [tombstone.id, tombstone]));
  return records.flatMap((record) => {
    const recordDelete = recordDeletes.get(record.id);
    const attemptsAfterRecordDelete = (record.wrongAttempts ?? []).filter((attempt) => !recordDelete || attempt.createdAt >= recordDelete.deletedAt);
    const wrongAttempts = attemptsAfterRecordDelete.filter((attempt) => {
      if (!attempt.testNo) return true;
      return !batchDeletes.has(attempt.testNo);
    });
    if (wrongAttempts.length === 0) return [];
    return [{
      ...record,
      wrongCount: wrongAttempts.length,
      wrongAttempts,
      testNos: Array.from(new Set(wrongAttempts.flatMap((attempt) => (attempt.testNo ? [attempt.testNo] : [])))),
      batchNames: Array.from(new Set(wrongAttempts.flatMap((attempt) => (attempt.batchName ? [attempt.batchName] : []))))
    }];
  });
}

export function emptyWrongBook(userId: string, clientId = "server"): WrongBookSnapshot {
  return {
    schemaVersion: 2,
    userId,
    clientId,
    updatedAt: new Date().toISOString(),
    records: [],
    deletedRecords: [],
    deletedBatches: []
  };
}

export function normalizeWrongBook(snapshot: Partial<WrongBookSnapshot>, userId: string): WrongBookSnapshot {
  const deletedRecords = normalizeTombstones(snapshot.deletedRecords, (id) => id.toLowerCase());
  const deletedBatches = normalizeTombstones(snapshot.deletedBatches, (id) => id);
  const records = Array.isArray(snapshot.records) ? snapshot.records.map(normalizeRecord).filter((record) => record.word.length > 0) : [];
  return {
    schemaVersion: 2,
    userId,
    clientId: snapshot.clientId || "unknown",
    updatedAt: snapshot.updatedAt || new Date().toISOString(),
    records: applyTombstones(records, deletedRecords, deletedBatches),
    deletedRecords,
    deletedBatches
  };
}

export function mergeWrongBooks(userId: string, ...snapshots: Array<WrongBookSnapshot | null | undefined>): WrongBookSnapshot {
  const normalized = snapshots.filter((snapshot): snapshot is WrongBookSnapshot => Boolean(snapshot)).map((snapshot) => normalizeWrongBook(snapshot, userId));
  const deletedRecords = latestTombstones(normalized.flatMap((snapshot) => snapshot.deletedRecords));
  const deletedBatches = latestTombstones(normalized.flatMap((snapshot) => snapshot.deletedBatches));
  const records = new Map<string, WrongBookRecord>();

  normalized.flatMap((snapshot) => snapshot.records).forEach((record) => {
    const existing = records.get(record.id);
    records.set(record.id, existing ? mergeRecords(existing, record) : record);
  });

  const activeRecords = applyTombstones(Array.from(records.values()), deletedRecords, deletedBatches);

  return {
    schemaVersion: 2,
    userId,
    clientId: "server-merge",
    updatedAt: new Date().toISOString(),
    records: activeRecords.sort((left, right) => left.word.localeCompare(right.word)),
    deletedRecords,
    deletedBatches
  };
}
