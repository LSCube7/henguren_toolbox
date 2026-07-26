import type { WrongBookAttempt, WrongBookRecord, WrongBookSnapshot, WrongBookTombstone } from "./types";

function recordId(record: Partial<WrongBookRecord>) {
  return String(record.id || `${record.sourceName ?? "custom"}:${record.word ?? "unknown"}`).toLowerCase();
}

function uniqueStrings(values: unknown) {
  return Array.isArray(values) ? Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))) : [];
}

function legacyDeletionCutoffs(tombstone: WrongBookTombstone) {
  const cutoffs = new Map<string, string>();
  Object.entries(tombstone.legacyDeletionCutoffs ?? {}).forEach(([clientId, deletedAt]) => {
    if (clientId && deletedAt) cutoffs.set(clientId, deletedAt);
  });
  const legacyDeletedAt = tombstone.legacyDeletedAt ?? (Array.isArray(tombstone.deletedAttemptIds) ? undefined : tombstone.deletedAt);
  if (legacyDeletedAt) {
    const existing = cutoffs.get(tombstone.clientId);
    if (!existing || legacyDeletedAt > existing) cutoffs.set(tombstone.clientId, legacyDeletedAt);
  }
  return cutoffs;
}

function mergeLegacyDeletionCutoffs(...tombstones: WrongBookTombstone[]) {
  const merged = new Map<string, string>();
  tombstones.forEach((tombstone) => {
    legacyDeletionCutoffs(tombstone).forEach((deletedAt, clientId) => {
      const existing = merged.get(clientId);
      if (!existing || deletedAt > existing) merged.set(clientId, deletedAt);
    });
  });
  return Object.fromEntries(merged);
}

function isAttemptDeleted(attempt: WrongBookAttempt, tombstone: WrongBookTombstone | undefined) {
  if (!tombstone) return false;
  if (tombstone.deletedAttemptIds?.includes(attempt.id)) return true;
  const cutoffs = legacyDeletionCutoffs(tombstone);
  const legacyCutoff = attempt.clientId === "legacy"
    ? Array.from(cutoffs.values()).sort().at(-1)
    : cutoffs.get(attempt.clientId);
  if (!legacyCutoff) return false;
  return attempt.createdAt < legacyCutoff;
}

export function mergeWrongBookTombstones(values: WrongBookTombstone[]) {
  const tombstones = new Map<string, WrongBookTombstone>();
  values.forEach((value) => {
    const existing = tombstones.get(value.id);
    if (!existing) {
      tombstones.set(value.id, value);
      return;
    }
    const newest = existing.deletedAt >= value.deletedAt ? existing : value;
    const hasObservedAttempts = Array.isArray(existing.deletedAttemptIds) || Array.isArray(value.deletedAttemptIds);
    tombstones.set(value.id, {
      ...newest,
      deletedAttemptIds: hasObservedAttempts
        ? uniqueStrings([...(existing.deletedAttemptIds ?? []), ...(value.deletedAttemptIds ?? [])])
        : undefined,
      legacyDeletionCutoffs: mergeLegacyDeletionCutoffs(existing, value),
      legacyDeletedAt: undefined
    });
  });
  return Array.from(tombstones.values());
}

function normalizeTombstones(values: unknown, normalizeId: (id: string) => string): WrongBookTombstone[] {
  if (!Array.isArray(values)) return [];
  return mergeWrongBookTombstones(
    values
      .filter((value): value is Partial<WrongBookTombstone> => Boolean(value && typeof value === "object"))
      .map((value) => {
        const deletedAt = String(value.deletedAt ?? new Date(0).toISOString());
        const hasObservedAttempts = Array.isArray(value.deletedAttemptIds);
        return {
          id: normalizeId(String(value.id ?? "")),
          clientId: String(value.clientId ?? "legacy"),
          deletedAt,
          deletedAttemptIds: hasObservedAttempts ? uniqueStrings(value.deletedAttemptIds) : undefined,
          legacyDeletionCutoffs: mergeLegacyDeletionCutoffs({
            id: String(value.id ?? ""),
            clientId: String(value.clientId ?? "legacy"),
            deletedAt,
            deletedAttemptIds: hasObservedAttempts ? uniqueStrings(value.deletedAttemptIds) : undefined,
            legacyDeletionCutoffs: value.legacyDeletionCutoffs,
            legacyDeletedAt: value.legacyDeletedAt ? String(value.legacyDeletedAt) : undefined
          })
        };
      })
      .filter((value) => value.id.length > 0)
  );
}

function normalizeAttempts(record: Partial<WrongBookRecord>, id: string) {
  const attempts = new Map<string, WrongBookAttempt>();
  const synthesizedAttemptIds = new Set<string>();
  const legacyAttemptCreatedAt = String(record.createdAt ?? new Date(0).toISOString());
  const legacyAttemptUpdatedAt = String(record.updatedAt ?? record.createdAt ?? new Date(0).toISOString());
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
        createdAt: String(attempt.createdAt ?? legacyAttemptCreatedAt)
      });
      if (!attempt.createdAt) synthesizedAttemptIds.add(attemptId);
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
        createdAt: legacyAttemptCreatedAt
      });
      synthesizedAttemptIds.add(attemptId);
    });
  }

  const legacyWrongCount = Math.max(0, Number(record.wrongCount) || 0);
  const fallbackLegacyAttempt = Array.from(attempts.values()).find((attempt) => attempt.testNo);
  for (let index = attempts.size; index < legacyWrongCount; index += 1) {
    const attemptId = `legacy:${id}:count:${index + 1}`;
    attempts.set(attemptId, {
      id: attemptId,
      testNo: fallbackLegacyAttempt?.testNo,
      batchName: fallbackLegacyAttempt?.batchName,
      clientId: "legacy",
      createdAt: legacyAttemptCreatedAt
    });
    synthesizedAttemptIds.add(attemptId);
  }
  const latestSynthesizedAttemptId = Array.from(synthesizedAttemptIds).at(-1);
  if (latestSynthesizedAttemptId) {
    const latestAttempt = attempts.get(latestSynthesizedAttemptId);
    if (latestAttempt) attempts.set(latestSynthesizedAttemptId, { ...latestAttempt, createdAt: legacyAttemptUpdatedAt });
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
    const attemptsAfterRecordDelete = (record.wrongAttempts ?? []).filter((attempt) => !isAttemptDeleted(attempt, recordDelete));
    const wrongAttempts = attemptsAfterRecordDelete.filter((attempt) => {
      if (!attempt.testNo) return true;
      return !isAttemptDeleted(attempt, batchDeletes.get(attempt.testNo));
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
  const deletedRecords = mergeWrongBookTombstones(normalized.flatMap((snapshot) => snapshot.deletedRecords));
  const deletedBatches = mergeWrongBookTombstones(normalized.flatMap((snapshot) => snapshot.deletedBatches));
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
