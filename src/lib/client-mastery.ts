"use client";

import { nextMasteryRecord, preferredMasteryRecord, type MasteryRecord } from "./mastery";
import { getClientId, readLocalWrongBook } from "./client-wrongbook";
import { mergeVocabSnapshots, parseVocabSnapshot } from "./vocab-sync";
import type { WrongBookSnapshot } from "./types";
import type { WrongBookRecord, WrongBookTombstone } from "./types";
import { planMasteryReconciliation } from "./wrongbook";

const DB_NAME = "henguren-v3-mastery";
const DB_VERSION = 1;
const STORE_NAME = "records";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function readMasteryRecords(): Promise<MasteryRecord[]> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).getAll();
      transaction.oncomplete = () => resolve(request.result as MasteryRecord[]);
      transaction.onabort = () => reject(transaction.error ?? new Error("掌握度记录读取事务已中止。"));
    });
  } finally {
    db.close();
  }
}

export async function readMasteryMap() {
  const records = await readMasteryRecords();
  return Object.fromEntries(records.map((record) => [record.id, record]));
}

export async function reconcileMasteryRecords(records: WrongBookRecord[], deletedRecords: WrongBookTombstone[] = []) {
  const db = await openDb();
  try {
    return await new Promise<Record<string, MasteryRecord>>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      let reconciled: Record<string, MasteryRecord> = {};
      let operationError: unknown;
      request.onsuccess = () => {
        try {
          const current = Object.fromEntries((request.result as MasteryRecord[]).map((record) => [record.id, record]));
          const plan = planMasteryReconciliation(records, current, deletedRecords);
          reconciled = plan.masteryById;
          plan.recordsToPut.forEach((record) => store.put(record));
          plan.recordIdsToDelete.forEach((id) => store.delete(id));
        } catch (error) {
          operationError = error;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve(reconciled);
      transaction.onabort = () => reject(operationError ?? transaction.error ?? new Error("掌握度记录协调事务已中止。"));
    });
  } finally {
    db.close();
  }
}

export async function mergeMasteryRecords(records: MasteryRecord[], wrongbook?: WrongBookSnapshot) {
  if (records.length === 0 && !wrongbook) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      let operationError: unknown;
      request.onsuccess = () => {
        try {
          const existingById = new Map((request.result as MasteryRecord[]).map((record) => [record.id, record]));
          const candidates = wrongbook ? mergeVocabSnapshots("local",
            parseVocabSnapshot({ ...wrongbook, masteryRecords: [...existingById.values()] }, "local"),
            parseVocabSnapshot({ ...wrongbook, masteryRecords: records }, "local")
          ).masteryRecords : records;
          if (wrongbook) {
            const candidateIds = new Set(candidates.map((record) => record.id));
            existingById.forEach((record, id) => {
              if (!candidateIds.has(id)) {
                store.delete(id);
                existingById.delete(id);
              }
            });
          }
          candidates.forEach((record) => {
            const current = existingById.get(record.id);
            if (wrongbook || !current || preferredMasteryRecord(current, record) === record) {
              store.put(record);
              existingById.set(record.id, record);
            }
          });
        } catch (error) {
          operationError = error;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(operationError ?? transaction.error ?? new Error("掌握度记录合并事务已中止。"));
    });
  } finally {
    db.close();
  }
}

export async function recordMasteryResult(id: string, correct: boolean) {
  const wrongbook = await readLocalWrongBook(getClientId());
  const wrongAttemptIds = wrongbook.records.find((record) => record.id === id)?.wrongAttempts?.map((attempt) => attempt.id) ?? [];
  const db = await openDb();
  try {
    return await new Promise<MasteryRecord>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      let nextRecord: MasteryRecord | null = null;
      let operationError: unknown;
      request.onsuccess = () => {
        try {
          const current = request.result as MasteryRecord | undefined;
          const sameCycle = !current?.wrongAttemptIds || current.wrongAttemptIds.some((attempt) => wrongAttemptIds.includes(attempt));
          nextRecord = { ...nextMasteryRecord(id, sameCycle ? current : undefined, correct), wrongAttemptIds };
          store.put(nextRecord);
        } catch (error) {
          operationError = error;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => {
        if (nextRecord) resolve(nextRecord);
        else reject(new Error("掌握度记录更新失败。"));
      };
      transaction.onabort = () => reject(operationError ?? transaction.error ?? new Error("掌握度记录更新事务已中止。"));
    });
  } finally {
    db.close();
  }
}

export async function deleteMasteryRecord(id: string) {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error("掌握度记录删除事务已中止。"));
    });
  } finally {
    db.close();
  }
}
