import type { WrongBookBatch, WrongBookRecord, WrongBookSnapshot, WrongBookTombstone, VocabWord } from "./types";
import { mergeWrongBooks, normalizeWrongBook } from "./wrongbook";

const DB_NAME = "henguren-v3";
const STORE_NAME = "wrongbook";
const META_STORE_NAME = "wrongbook-meta";
const DB_VERSION = 2;
const META_ID = "sync";
const WRITE_LOCK_NAME = "henguren-v3-wrongbook-write";
let writeQueue: Promise<void> = Promise.resolve();

type WrongBookMetadata = {
  id: typeof META_ID;
  updatedAt: string;
  deletedRecords: WrongBookTombstone[];
  deletedBatches: WrongBookTombstone[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let upgradeBlocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!db.objectStoreNames.contains(META_STORE_NAME)) db.createObjectStore(META_STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      if (upgradeBlocked) {
        db.close();
        return;
      }
      resolve(db);
    };
    request.onblocked = () => {
      upgradeBlocked = true;
      reject(new Error("错题本升级被其他页面阻止，请关闭旧版本标签页后刷新重试。调试信息：模块 wrongbook-storage，错误类型 IDB_UPGRADE_BLOCKED。"));
    };
    request.onerror = () => reject(request.error);
  });
}

function defaultMetadata(): WrongBookMetadata {
  return {
    id: META_ID,
    updatedAt: new Date(0).toISOString(),
    deletedRecords: [],
    deletedBatches: []
  };
}

function snapshotFromStorage(clientId: string, records: WrongBookRecord[], metadata: WrongBookMetadata | undefined) {
  const currentMetadata = metadata ?? defaultMetadata();
  return normalizeWrongBook({
    schemaVersion: 2,
    userId: "local",
    clientId,
    updatedAt: currentMetadata.updatedAt,
    records,
    deletedRecords: currentMetadata.deletedRecords,
    deletedBatches: currentMetadata.deletedBatches
  }, "local");
}

function metadataFromSnapshot(snapshot: WrongBookSnapshot): WrongBookMetadata {
  return {
    id: META_ID,
    updatedAt: snapshot.updatedAt,
    deletedRecords: snapshot.deletedRecords,
    deletedBatches: snapshot.deletedBatches
  };
}

async function updateLocalWrongBook(clientId: string, update: (snapshot: WrongBookSnapshot) => WrongBookSnapshot) {
  const db = await openDb();
  return await new Promise<WrongBookSnapshot>((resolve, reject) => {
    // IndexedDB serializes readwrite transactions across tabs, so this transaction
    // must both read the latest snapshot and write its replacement atomically.
    const transaction = db.transaction([STORE_NAME, META_STORE_NAME], "readwrite");
    const recordStore = transaction.objectStore(STORE_NAME);
    const metadataStore = transaction.objectStore(META_STORE_NAME);
    const recordsRequest = recordStore.getAll();
    const metadataRequest = metadataStore.get(META_ID);
    let recordsReady = false;
    let metadataReady = false;
    let nextSnapshot: WrongBookSnapshot | null = null;
    let updateError: unknown;

    const applyUpdate = () => {
      if (!recordsReady || !metadataReady || nextSnapshot) return;
      try {
        const current = snapshotFromStorage(
          clientId,
          recordsRequest.result as WrongBookRecord[],
          metadataRequest.result as WrongBookMetadata | undefined
        );
        nextSnapshot = update(current);
        recordStore.clear();
        nextSnapshot.records.forEach((record) => recordStore.put(record));
        metadataStore.put(metadataFromSnapshot(nextSnapshot));
      } catch (error) {
        updateError = error;
        transaction.abort();
      }
    };

    recordsRequest.onsuccess = () => {
      recordsReady = true;
      applyUpdate();
    };
    metadataRequest.onsuccess = () => {
      metadataReady = true;
      applyUpdate();
    };
    transaction.oncomplete = () => {
      db.close();
      if (nextSnapshot) resolve(nextSnapshot);
      else reject(new Error("错题本更新未生成新快照。"));
    };
    transaction.onabort = () => {
      db.close();
      reject(updateError ?? transaction.error ?? new Error("错题本事务已中止。"));
    };
  });
}

function upsertTombstone(tombstones: WrongBookTombstone[], next: WrongBookTombstone) {
  const existing = tombstones.find((tombstone) => tombstone.id === next.id);
  return [...tombstones.filter((tombstone) => tombstone.id !== next.id), existing && existing.deletedAt > next.deletedAt ? existing : next];
}

async function withWrongBookWrite<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return await navigator.locks.request(WRITE_LOCK_NAME, operation);
  }
  const next = writeQueue.then(operation, operation);
  writeQueue = next.then(() => undefined, () => undefined);
  return await next;
}

export async function readLocalWrongBook(clientId: string): Promise<WrongBookSnapshot> {
  const db = await openDb();
  return await new Promise<WrongBookSnapshot>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, META_STORE_NAME], "readonly");
    const recordsRequest = transaction.objectStore(STORE_NAME).getAll();
    const metadataRequest = transaction.objectStore(META_STORE_NAME).get(META_ID);
    transaction.oncomplete = () => {
      db.close();
      resolve(snapshotFromStorage(
        clientId,
        recordsRequest.result as WrongBookRecord[],
        metadataRequest.result as WrongBookMetadata | undefined
      ));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error("错题本读取事务已中止。"));
    };
  });
}

export function addWrongWord(word: VocabWord, testNo: string, batchName?: string, existingRecordId?: string) {
  return withWrongBookWrite(async () => {
    const clientId = getClientId();
    const id = existingRecordId ?? `${word.sourceName ?? "custom"}:${word.word}`.toLowerCase();
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
    await updateLocalWrongBook(clientId, (local) => {
      const merged = mergeWrongBooks("local", local, incoming);
      return { ...merged, clientId, userId: "local" };
    });
  });
}

export function deleteWrongRecord(id: string) {
  return withWrongBookWrite(async () => {
    const clientId = getClientId();
    const now = new Date().toISOString();
    await updateLocalWrongBook(clientId, (snapshot) => ({
      ...snapshot,
      updatedAt: now,
      records: snapshot.records.filter((record) => record.id !== id),
      deletedRecords: upsertTombstone(snapshot.deletedRecords, { id, clientId, deletedAt: now })
    }));
  });
}

export function deleteWrongBatch(testNo: string) {
  return withWrongBookWrite(async () => {
    const clientId = getClientId();
    const now = new Date().toISOString();
    await updateLocalWrongBook(clientId, (snapshot) => {
      const records = snapshot.records.flatMap((record) => {
        const wrongAttempts = (record.wrongAttempts ?? []).filter((attempt) => attempt.testNo !== testNo);
        if (wrongAttempts.length === 0) return [];
        if (wrongAttempts.length === record.wrongAttempts?.length) return [record];
        return [{
          ...record,
          wrongCount: wrongAttempts.length,
          wrongAttempts,
          testNos: Array.from(new Set(wrongAttempts.flatMap((attempt) => (attempt.testNo ? [attempt.testNo] : [])))),
          batchNames: Array.from(new Set(wrongAttempts.flatMap((attempt) => (attempt.batchName ? [attempt.batchName] : [])))),
          updatedAt: now
        }];
      });
      return {
        ...snapshot,
        updatedAt: now,
        records,
        deletedBatches: upsertTombstone(snapshot.deletedBatches, { id: testNo, clientId, deletedAt: now })
      };
    });
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
