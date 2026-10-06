"use client";

import type { MasteryRecord } from "./mastery";
import { preferredMasteryRecord } from "./mastery";
import { accountLearningOwner, guestLearningOwner, removeUploadedLearning, type LearningPartition } from "./learning-ownership";
import { emptyWrongBook, mergeWrongBooks, normalizeWrongBook } from "./wrongbook";
import type { WrongBookRecord, WrongBookSnapshot } from "./types";
import { isOnline } from "./offline-cache";

const partitionsStore = "learning-partitions";
const stateStore = "learning-state";
const activeKey = "active";
export const learningOwnerEventKey = "henguren-v3-learning-owner-event";
let activeOwner = guestLearningOwner;
let initializePromise: Promise<void> | undefined;

export function currentLearningOwner() { return activeOwner; }
export function assertLearningOwner(owner: string) {
  if (owner !== activeOwner) throw new Error("LOCAL_OWNER_CHANGED");
}
function emptyPartition(owner: string): LearningPartition {
  return { owner, wrongbook: emptyWrongBook("local"), masteryRecords: [] };
}
function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error ?? new Error("LOCAL_STORAGE_FAILED")); });
}
async function openLearningDb() {
  const request = indexedDB.open("henguren-v3", 3);
  request.onupgradeneeded = () => {
    for (const name of ["wrongbook", "wrongbook-meta"]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: "id" });
    if (!request.result.objectStoreNames.contains(partitionsStore)) request.result.createObjectStore(partitionsStore, { keyPath: "owner" });
    if (!request.result.objectStoreNames.contains(stateStore)) request.result.createObjectStore(stateStore, { keyPath: "id" });
  };
  return new Promise<IDBDatabase>((resolve, reject) => {
    let blocked = false;
    request.onblocked = () => { blocked = true; reject(new Error("IDB_UPGRADE_BLOCKED")); };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      if (blocked) request.result.close(); else resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}
async function openLegacyMastery() {
  // A version bump closes old clients before copying, preventing late v1 writes.
  const request = indexedDB.open("henguren-v3-mastery", 2);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains("records")) request.result.createObjectStore("records", { keyPath: "id" });
  };
  return new Promise<IDBDatabase>((resolve, reject) => {
    let blocked = false;
    request.onblocked = () => { blocked = true; reject(new Error("IDB_UPGRADE_BLOCKED")); };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      if (blocked) request.result.close(); else resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

async function migrateLearningStorage() {
  const db = await openLearningDb();
  let legacy: IDBDatabase | undefined;
  try {
    legacy = await openLegacyMastery();
    const oldTransaction = legacy.transaction("records", "readonly");
    const oldDone = transactionDone(oldTransaction);
    const masteryRecords = await requestResult(oldTransaction.objectStore("records").getAll()) as MasteryRecord[];
    await oldDone;
    const transaction = db.transaction([partitionsStore, stateStore, "wrongbook", "wrongbook-meta"], "readwrite");
    const done = transactionDone(transaction);
    const states = transaction.objectStore(stateStore);
    const partitions = transaction.objectStore(partitionsStore);
    const migrationRequest = states.get("migration");
    const wordsRequest = transaction.objectStore("wrongbook").getAll();
    const metaRequest = transaction.objectStore("wrongbook-meta").get("sync");
    const ownerRequest = states.get(activeKey);
    let ready = 0;
    const apply = () => {
      if (++ready !== 4) return;
      try {
        if (!migrationRequest.result) {
          const meta = metaRequest.result as Partial<WrongBookSnapshot> | undefined;
          partitions.put({ owner: guestLearningOwner, masteryRecords, wrongbook: normalizeWrongBook({
            schemaVersion: 2, records: wordsRequest.result as WrongBookRecord[],
            updatedAt: meta?.updatedAt, deletedRecords: meta?.deletedRecords, deletedBatches: meta?.deletedBatches
          }, "local") } satisfies LearningPartition);
          transaction.objectStore("wrongbook").clear();
          transaction.objectStore("wrongbook-meta").clear();
          states.put({ id: "migration", version: 1 });
        }
        activeOwner = ownerRequest.result?.owner ?? guestLearningOwner;
        if (!ownerRequest.result) states.put({ id: activeKey, owner: activeOwner });
      } catch { transaction.abort(); }
    };
    [migrationRequest, wordsRequest, metaRequest, ownerRequest].forEach((request) => { request.onsuccess = apply; });
    await done;
    // The new guest copy is durable before the legacy mastery copy is removed.
    const cleanup = legacy.transaction("records", "readwrite");
    const cleanupDone = transactionDone(cleanup);
    cleanup.objectStore("records").clear();
    await cleanupDone;
  } finally { db.close(); legacy?.close(); }
}
export function initializeLearningStorage() {
  initializePromise ??= (navigator.locks
    ? navigator.locks.request("henguren-v3-learning-migration", migrateLearningStorage).then(() => undefined)
    : migrateLearningStorage()).catch((error) => { initializePromise = undefined; throw error; });
  return initializePromise;
}

export async function readLearningPartition(owner = currentLearningOwner(), allowInactive = false): Promise<LearningPartition> {
  await initializeLearningStorage();
  const db = await openLearningDb();
  try {
    const transaction = db.transaction([partitionsStore, stateStore]);
    const done = transactionDone(transaction);
    const [partition, state] = await Promise.all([requestResult(transaction.objectStore(partitionsStore).get(owner)), requestResult(transaction.objectStore(stateStore).get(activeKey))]);
    await done;
    if (!allowInactive && state.owner !== owner) throw new Error("LOCAL_OWNER_CHANGED");
    return partition ?? emptyPartition(owner);
  } finally { db.close(); }
}

export async function updateLearningPartition<T>(owner: string, update: (partition: LearningPartition) => { partition: LearningPartition; result: T }): Promise<T> {
  await initializeLearningStorage();
  const db = await openLearningDb();
  try {
    const transaction = db.transaction([partitionsStore, stateStore], "readwrite");
    const store = transaction.objectStore(partitionsStore);
    const request = store.get(owner);
    const state = transaction.objectStore(stateStore).get(activeKey);
    return await new Promise<T>((resolve, reject) => {
      let ready = 0; let result: T; let error: unknown;
      const apply = () => {
        if (++ready !== 2) return;
        try {
          if (state.result.owner !== owner || currentLearningOwner() !== owner) throw new Error("LOCAL_OWNER_CHANGED");
          const next = update(request.result ?? emptyPartition(owner));
          if (next.partition.owner !== owner) throw new Error("LOCAL_OWNER_CHANGED");
          result = next.result; store.put(next.partition);
        } catch (failure) { error = failure; transaction.abort(); }
      };
      request.onsuccess = apply; state.onsuccess = apply;
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(error ?? transaction.error ?? new Error("LOCAL_STORAGE_FAILED"));
    });
  } finally { db.close(); }
}

function announceOwner() {
  try { localStorage.setItem(learningOwnerEventKey, crypto.randomUUID()); }
  finally { window.dispatchEvent(new Event(learningOwnerEventKey)); }
}
export async function changeLearningOwner(nextOwner: string, cleanupUploaded: boolean) {
  await initializeLearningStorage();
  const db = await openLearningDb();
  try {
    const transaction = db.transaction([partitionsStore, stateStore], "readwrite");
    const store = transaction.objectStore(partitionsStore);
    const states = transaction.objectStore(stateStore);
    const request = states.get(activeKey);
    const done = transactionDone(transaction);
    request.onsuccess = () => {
      const previous = request.result.owner as string;
      if (previous === nextOwner) return;
      if (previous !== currentLearningOwner()) { transaction.abort(); return; }
      const partitionRequest = store.get(previous);
      partitionRequest.onsuccess = () => {
        try {
          if (cleanupUploaded && isOnline() && previous !== guestLearningOwner && partitionRequest.result) {
            store.put(removeUploadedLearning(partitionRequest.result));
          }
          states.put({ id: activeKey, owner: nextOwner });
        } catch { transaction.abort(); }
      };
    };
    await done;
    // Keep this page bound to its original partition until it reloads. Pending
    // callbacks must fail the persisted-owner check rather than write to a new user.
    announceOwner();
  } finally { db.close(); }
}
export async function observeAuthenticatedLearningUser(userId: string) {
  const next = accountLearningOwner(userId);
  if (currentLearningOwner() === next) return false;
  await changeLearningOwner(next, true);
  return true;
}
export async function adoptGuestLearning(userId: string) {
  const owner = accountLearningOwner(userId);
  await initializeLearningStorage();
  const db = await openLearningDb();
  try {
    const transaction = db.transaction([partitionsStore, stateStore], "readwrite");
    const store = transaction.objectStore(partitionsStore);
    const guest = store.get(guestLearningOwner);
    const target = store.get(owner);
    const state = transaction.objectStore(stateStore).get(activeKey);
    let ready = 0;
    const done = transactionDone(transaction);
    const apply = () => {
      if (++ready !== 3) return;
      try {
        if (state.result.owner !== owner || currentLearningOwner() !== owner) { transaction.abort(); return; }
        const local: LearningPartition = target.result ?? emptyPartition(owner);
        const source: LearningPartition = guest.result ?? emptyPartition(guestLearningOwner);
        const mastery = new Map(local.masteryRecords.map((record) => [record.id, record]));
        source.masteryRecords.forEach((record) => {
          const existing = mastery.get(record.id);
          mastery.set(record.id, existing ? preferredMasteryRecord(existing, record) : record);
        });
        store.put({ ...local, wrongbook: mergeWrongBooks("local", local.wrongbook, source.wrongbook), masteryRecords: [...mastery.values()] });
        store.put(emptyPartition(guestLearningOwner));
      } catch { transaction.abort(); }
    };
    [guest, target, state].forEach((request) => { request.onsuccess = apply; });
    await done;
  } finally { db.close(); }
}
