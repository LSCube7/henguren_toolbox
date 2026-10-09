import type { WrongBookBatch, WrongBookRecord, WrongBookSnapshot, WrongBookTombstone, VocabWord } from "./types";
import { undoNewWrongBookAttempts, mergeWrongBooks, mergeWrongBookTombstones, needsWrongBookCanonicalization, normalizeWrongBook, removeWrongBookBatchAttempts, removeWrongBookRecord as removeWrongBookRecordData, wrongBookRecordId } from "./wrongbook";

import { assertLearningOwner, currentLearningOwner, readLearningPartition, updateLearningPartition } from "./client-learning-storage";

const WRITE_LOCK_NAME = "henguren-v3-wrongbook-write";
let writeQueue: Promise<void> = Promise.resolve();

async function updateLocalWrongBook(clientId: string, update: (snapshot: WrongBookSnapshot) => WrongBookSnapshot) {
  const owner = currentLearningOwner();
  return updateLearningPartition(owner, (partition) => {
    const current = normalizeWrongBook({ ...partition.wrongbook, clientId }, "local");
    const wrongbook = update(current);
    return { partition: { ...partition, wrongbook }, result: wrongbook };
  });
}

function upsertTombstone(tombstones: WrongBookTombstone[], next: WrongBookTombstone) {
  return mergeWrongBookTombstones([...tombstones, next]);
}

async function withWrongBookWrite<T>(operation: () => Promise<T>): Promise<T> {
  const owner = currentLearningOwner();
  const guarded = () => { assertLearningOwner(owner); return operation(); };
  if (typeof navigator !== "undefined" && navigator.locks) {
    return await navigator.locks.request(WRITE_LOCK_NAME, guarded);
  }
  const next = writeQueue.then(guarded, guarded);
  writeQueue = next.then(() => undefined, () => undefined);
  return await next;
}

export async function readLocalWrongBook(clientId: string, owner = currentLearningOwner()): Promise<WrongBookSnapshot> {
  const partition = await readLearningPartition(owner);
  return normalizeWrongBook({ ...partition.wrongbook, clientId }, "local");
}

export async function canonicalizeLocalWrongBookRecordIds(clientId: string): Promise<WrongBookSnapshot> {
  const owner = currentLearningOwner();
  const current = await readLocalWrongBook(clientId, owner);
  assertLearningOwner(owner);
  if (!needsWrongBookCanonicalization(current)) return current;

  return await withWrongBookWrite(async () => updateLocalWrongBook(clientId, (latest) => {
    if (!needsWrongBookCanonicalization(latest)) return latest;
    const canonical = mergeWrongBooks(latest.userId, latest);
    return { ...canonical, clientId: latest.clientId };
  }));
}

export function addWrongWord(word: VocabWord, testNo: string, batchName?: string, existingRecordId?: string) {
  return withWrongBookWrite(async () => {
    const clientId = getClientId();
    const id = existingRecordId ?? wrongBookRecordId(word);
    const now = new Date().toISOString();
    const attemptId = `${clientId}:${crypto.randomUUID()}`;
    await updateLocalWrongBook(clientId, (snapshot) => {
      const existing = snapshot.records.find((record) => record.id === id);
      const wrongAttempts = [
        ...(existing?.wrongAttempts ?? []),
        { id: attemptId, testNo, batchName: batchName || undefined, clientId, createdAt: now }
      ];
      const next: WrongBookRecord = {
        id,
        aliases: existing?.aliases,
        word: word.word,
        sourceName: word.sourceName ?? "custom",
        sourceTitle: word.sourceTitle,
        definitions: word.en_definition,
        zhDefinitions: word.zh_definition,
        wrongCount: wrongAttempts.length,
        wrongAttempts,
        testNos: Array.from(new Set(wrongAttempts.flatMap((attempt) => (attempt.testNo ? [attempt.testNo] : [])))),
        batchNames: Array.from(new Set(wrongAttempts.flatMap((attempt) => (attempt.batchName ? [attempt.batchName] : [])))),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      return {
        ...snapshot,
        updatedAt: now,
        records: [...snapshot.records.filter((record) => record.id !== id), next]
      };
    });
  });
}

export function importWrongBookSnapshot(snapshot: Partial<WrongBookSnapshot>) {
  return withWrongBookWrite(async () => {
    const clientId = getClientId();
    const incoming = normalizeWrongBook(snapshot, snapshot.userId || "import");
    return await updateLocalWrongBook(clientId, (local) => {
      const merged = mergeWrongBooks("local", local, incoming);
      return { ...merged, clientId, userId: "local" };
    });
  });
}

export function deleteWrongRecord(id: string) {
  return withWrongBookWrite(async () => {
    const clientId = getClientId();
    const now = new Date().toISOString();
    let masteryRecordIds: string[] = [];
    await updateLocalWrongBook(clientId, (snapshot) => {
      const deletion = removeWrongBookRecordData(snapshot.records, id);
      masteryRecordIds = deletion.masteryRecordIds;
      return {
        ...snapshot,
        updatedAt: now,
        records: deletion.records,
        deletedRecords: upsertTombstone(snapshot.deletedRecords, {
          id: deletion.deletedRecordId,
          canonicalRecordId: deletion.canonicalRecordId,
          aliases: deletion.aliases.length > 0 ? deletion.aliases : undefined,
          clientId,
          deletedAt: now,
          deletedAttemptIds: deletion.deletedAttemptIds
        })
      };
    });
    return masteryRecordIds;
  });
}

export function deleteWrongBatch(testNo: string) {
  return withWrongBookWrite(async () => {
    const clientId = getClientId();
    const now = new Date().toISOString();
    let removedRecordIds: string[] = [];
    await updateLocalWrongBook(clientId, (snapshot) => {
      const deletion = removeWrongBookBatchAttempts(snapshot.records, testNo, now);
      removedRecordIds = deletion.removedRecordIds;
      return {
        ...snapshot,
        updatedAt: now,
        records: deletion.records,
        deletedBatches: upsertTombstone(snapshot.deletedBatches, {
          id: testNo,
          clientId,
          deletedAt: now,
          deletedAttemptIds: deletion.deletedAttemptIds
        })
      };
    });
    return removedRecordIds;
  });
}

export function getWrongBookBatches(records: WrongBookRecord[]): WrongBookBatch[] {
  const batches = new Map<string, WrongBookBatch>();
  records.forEach((record) => {
    (record.wrongAttempts ?? []).forEach((attempt) => {
      if (!attempt.testNo) return;
      const existing = batches.get(attempt.testNo);
      batches.set(attempt.testNo, {
        testNo: attempt.testNo,
        batchName: existing?.batchName ?? attempt.batchName,
        createdAt: existing?.createdAt && existing.createdAt < attempt.createdAt ? existing.createdAt : attempt.createdAt,
        sourceName: existing?.sourceName ?? record.sourceName,
        syncedCount: (existing?.syncedCount ?? 0) + 1
      });
    });
  });
  return Array.from(batches.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function getClientId() {
  const key = "henguren-v3-client-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}

export function undoSessionNewWords(existingIds: string[], testNo: string) {
  return withWrongBookWrite(async () => {
    const clientId = getClientId();
    const now = new Date().toISOString();
    return updateLocalWrongBook(clientId, (snapshot) => {
      const deletion = undoNewWrongBookAttempts(snapshot.records, existingIds, testNo, now);
      return {
        ...snapshot, updatedAt: now, records: deletion.records,
        deletedRecords: mergeWrongBookTombstones([...snapshot.deletedRecords, ...deletion.deletions.map(({ record, attemptIds }) => ({
          id: record.id, canonicalRecordId: wrongBookRecordId(record), aliases: record.aliases, clientId, deletedAt: now, deletedAttemptIds: attemptIds
        }))])
      };
    });
  });
}
