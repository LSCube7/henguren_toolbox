"use client";

import { nextMasteryRecord, type MasteryRecord } from "./mastery";

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
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readMasteryRecords(): Promise<MasteryRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as MasteryRecord[]);
    request.onerror = () => reject(request.error);
  });
}

export async function readMasteryMap() {
  const records = await readMasteryRecords();
  return Object.fromEntries(records.map((record) => [record.id, record]));
}

export async function recordMasteryResult(id: string, correct: boolean) {
  const db = await openDb();
  return new Promise<MasteryRecord>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    let nextRecord: MasteryRecord | null = null;
    request.onsuccess = () => {
      nextRecord = nextMasteryRecord(id, request.result as MasteryRecord | undefined, correct);
      store.put(nextRecord);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => {
      if (nextRecord) resolve(nextRecord);
      else reject(new Error("掌握度记录更新失败。"));
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteMasteryRecord(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
