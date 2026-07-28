"use client";

import { nextMasteryRecord, type MasteryRecord } from "./mastery";
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

export async function mergeMasteryRecords(records: MasteryRecord[]) {
  if (records.length === 0) return;
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
          records.forEach((record) => {
            const current = existingById.get(record.id);
            if (!current || current.updatedAt < record.updatedAt) {
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
          nextRecord = nextMasteryRecord(id, request.result as MasteryRecord | undefined, correct);
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
