import type { WrongBookBatch, WrongBookRecord, WrongBookSnapshot, VocabWord } from "./types";

const DB_NAME = "henguren-v3";
const STORE_NAME = "wrongbook";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllRecords(): Promise<WrongBookRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as WrongBookRecord[]);
    request.onerror = () => reject(request.error);
  });
}

async function writeRecords(records: WrongBookRecord[]) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    records.forEach((record) => store.put(record));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function readLocalWrongBook(clientId: string): Promise<WrongBookSnapshot> {
  return {
    schemaVersion: 1,
    userId: "local",
    clientId,
    updatedAt: new Date().toISOString(),
    records: await getAllRecords()
  };
}

export async function upsertWrongRecord(record: WrongBookRecord) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function addWrongWord(word: VocabWord, testNo: string, batchName?: string) {
  const records = await getAllRecords();
  const id = `${word.sourceName ?? "custom"}:${word.word}`.toLowerCase();
  const existing = records.find((record) => record.id === id);
  const now = new Date().toISOString();
  const next: WrongBookRecord = {
    id,
    word: word.word,
    sourceName: word.sourceName ?? "custom",
    sourceTitle: word.sourceTitle,
    definitions: word.en_definition,
    zhDefinitions: word.zh_definition,
    wrongCount: (existing?.wrongCount ?? 0) + 1,
    testNos: Array.from(new Set([...(existing?.testNos ?? []), testNo])),
    batchNames: Array.from(new Set([...(existing?.batchNames ?? []), ...(batchName ? [batchName] : [])])),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await upsertWrongRecord(next);
}

export async function importWrongBookSnapshot(snapshot: Partial<WrongBookSnapshot>) {
  const incoming = Array.isArray(snapshot.records) ? snapshot.records : [];
  const existing = await getAllRecords();
  const merged = new Map<string, WrongBookRecord>();
  [...existing, ...incoming].forEach((record) => {
    const key = record.id || `${record.sourceName}:${record.word}`.toLowerCase();
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...record, id: key });
      return;
    }
    merged.set(key, {
      ...current,
      definitions: Array.from(new Set([...(current.definitions ?? []), ...(record.definitions ?? [])])),
      zhDefinitions: Array.from(new Set([...(current.zhDefinitions ?? []), ...(record.zhDefinitions ?? [])])),
      wrongCount: Math.max(current.wrongCount, record.wrongCount),
      testNos: Array.from(new Set([...(current.testNos ?? []), ...(record.testNos ?? [])])),
      batchNames: Array.from(new Set([...(current.batchNames ?? []), ...(record.batchNames ?? [])])),
      updatedAt: current.updatedAt > record.updatedAt ? current.updatedAt : record.updatedAt
    });
  });
  await writeRecords(Array.from(merged.values()));
}

export async function deleteWrongRecord(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteWrongBatch(testNo: string) {
  const records = await getAllRecords();
  const next = records
    .map((record) => ({
      ...record,
      testNos: (record.testNos ?? []).filter((item) => item !== testNo)
    }))
    .filter((record) => (record.testNos ?? []).length > 0);
  await writeRecords(next);
}

export function getWrongBookBatches(records: WrongBookRecord[]): WrongBookBatch[] {
  const batches = new Map<string, WrongBookBatch>();
  records.forEach((record) => {
    (record.testNos ?? []).forEach((testNo) => {
      const existing = batches.get(testNo);
      batches.set(testNo, {
        testNo,
        batchName: record.batchNames?.[0],
        createdAt: existing?.createdAt && existing.createdAt < record.createdAt ? existing.createdAt : record.createdAt,
        sourceName: existing?.sourceName ?? record.sourceName,
        syncedCount: (existing?.syncedCount ?? 0) + 1
      });
    });
  });
  return Array.from(batches.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
