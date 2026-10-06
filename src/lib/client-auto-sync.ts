"use client";
import { useSyncExternalStore } from "react";
import { automaticLearningSync, cachedSyncSummary, cancelSyncRequests, readWrongBookSyncSummary, subscribeSyncSummary, type WrongBookSyncSummary } from "./client-sync";
import { currentLearningOwner, learningChangeEventKey, learningOwnerEventKey, readLearningPartition, setLearningAutoSync } from "./client-learning-storage";
import { accountLearningOwner } from "./learning-ownership";
import { developerSyncSourceChangeEvent, developerSyncSourceIdentity, readDeveloperSyncSource } from "./developer-sync-config";
import { isOnline } from "./offline-cache";
import { canRetrySync, nextSyncAt, retrySyncDelay } from "./learning-sync-policy";

type AutoStatus = "idle" | "pending" | "syncing" | "synced" | "offline" | "signed-out" | "error";
type LearningSyncState = { summary: WrongBookSyncSummary | null; busy: boolean; enabled: boolean; pending: boolean; error?: string; status: AutoStatus };
const initial: LearningSyncState = { summary: null, busy: false, enabled: false, pending: false, status: "idle" };
let state = initial;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let started = false, stopped = false, running = false, halted = false, manualBusy = false;
let observedVersion = -1, lastChange = Date.now(), firstPending = Date.now(), retryAt = 0, attempts = 0;
function publish(next: Partial<LearningSyncState>) {
  const value = { ...state, ...next };
  if (JSON.stringify(value) === JSON.stringify(state)) return;
  state = value; listeners.forEach((listener) => listener());
}
function codeOf(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? error.code : error instanceof Error ? error.message : "SYNC_FAILED";
  return typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code) ? code : "SYNC_FAILED";
}
async function inspect() {
  const partition = await readLearningPartition();
  const enabled = Boolean(partition.sync?.enabled) && !readDeveloperSyncSource() && currentLearningOwner() !== "guest";
  const pending = (partition.sync?.localVersion ?? 0) !== (partition.sync?.confirmedVersion ?? -1);
  if (partition.sync?.localVersion !== observedVersion) {
    if (!state.pending) firstPending = Date.now();
    observedVersion = partition.sync?.localVersion ?? 0; lastChange = Date.now();
  }
  const cached = cachedSyncSummary() ?? state.summary;
  const summary = cached ? { ...cached, localCount: partition.wrongbook.records.length, localMasteryCount: partition.masteryRecords.length, status: !isOnline() ? "offline" as const : halted && state.error === "UNAUTHORIZED" ? "signed-out" as const : cached.status, user: halted && state.error === "UNAUTHORIZED" ? null : cached.user } : null;
  publish({ enabled, pending, summary, busy: running || manualBusy,
    status: running || manualBusy ? "syncing" : !isOnline() ? "offline" : halted || state.error ? state.status : !enabled ? "idle" : pending ? "pending" : partition.sync?.lastSuccessAt ? "synced" : "idle" });
  return partition;
}
function schedule(at: number) {
  clearTimeout(timer);
  if (!started || stopped || halted || document.visibilityState === "hidden" || !isOnline() || !state.enabled) return;
  timer = setTimeout(() => { void execute().catch(fail); }, Math.max(0, at - Date.now()));
}
function fail(error: unknown) {
  const code = codeOf(error);
  if (code === "LOCAL_OWNER_CHANGED" || stopped) return;
  if (code === "SYNC_BUSY") { retryAt = Date.now() + 15000; schedule(retryAt); return; }
  halted = !canRetrySync(code);
  publish({ error: code, status: code === "UNAUTHORIZED" ? "signed-out" : "error", busy: false });
  retryAt = Date.now() + retrySyncDelay(attempts++);
  if (!halted) schedule(retryAt);
}
async function reschedule() {
  const partition = await inspect();
  schedule(Math.max(retryAt, nextSyncAt(state.pending, lastChange, firstPending, partition.sync?.lastCheckAt ?? 0)));
}
async function execute(force = false) {
  if (running || manualBusy || stopped || halted || !isOnline() || document.visibilityState === "hidden") return;
  const partition = await inspect();
  if (!partition.sync?.enabled || !state.enabled) return;
  running = true; publish({ busy: true, status: "syncing", error: undefined });
  try {
    await automaticLearningSync({ force });
    attempts = 0; retryAt = 0;
  } catch (error) { fail(error); }
  finally { running = false; await inspect(); if (!halted) await reschedule(); }
}
async function refresh() {
  halted = false; stopped = false; retryAt = 0; attempts = 0;
  publish({ error: undefined });
  await readWrongBookSyncSummary({ force: true });
  await inspect();
  if (state.enabled) await execute(true);
}
async function setEnabled(enabled: boolean) {
  if (enabled) {
    const summary = await readWrongBookSyncSummary({ force: true });
    if (readDeveloperSyncSource() || !summary.user || currentLearningOwner() !== accountLearningOwner(summary.user.id)) throw new Error("UNAUTHORIZED");
  }
  await setLearningAutoSync(enabled);
  halted = false; stopped = false; retryAt = 0; attempts = 0;
  publish({ enabled, error: undefined });
  await inspect();
  if (enabled) await execute(true); else clearTimeout(timer);
}
export function stopLearningSync() { stopped = true; clearTimeout(timer); cancelSyncRequests(); }
export function resumeLearningSync() { stopped = false; void reschedule().catch(fail); }
export function startLearningAutoSync() {
  if (started) return () => {};
  started = true; stopped = false;
  const changed = () => { void reschedule().catch(fail); };
  let sourceIdentity = readDeveloperSyncSource() ? developerSyncSourceIdentity(readDeveloperSyncSource()!) : "account";
  const sourceChanged = () => {
    const source = readDeveloperSyncSource(); const identity = source ? developerSyncSourceIdentity(source) : "account";
    if (identity === sourceIdentity) return;
    sourceIdentity = identity; clearTimeout(timer); halted = false; retryAt = 0; attempts = 0; publish({ error: undefined });
    void readWrongBookSyncSummary().then(() => inspect()).then(() => reschedule()).catch(fail);
  };
  const storage = (event: StorageEvent) => { if (event.key === learningChangeEventKey) changed(); if (event.key === "henguren-v3-dev-sync-source" || event.key === "henguren-v3-settings") sourceChanged(); };
  const availability = () => { clearTimeout(timer); if (!isOnline()) { publish({ status: "offline" }); return; } void inspect().then(() => execute(true)).catch(fail); };
  const owner = () => stopLearningSync();
  const activity = (event: Event) => { manualBusy = (event as CustomEvent<boolean>).detail; void reschedule().catch(fail); };
  const unsubscribe = subscribeSyncSummary(() => publish({ summary: cachedSyncSummary() }));
  window.addEventListener(learningChangeEventKey, changed); window.addEventListener("storage", storage);
  window.addEventListener("online", availability); window.addEventListener("offline", availability);
  window.addEventListener(learningOwnerEventKey, owner); window.addEventListener("henguren-v3-sync-activity", activity);
  document.addEventListener("visibilitychange", availability);
  window.addEventListener(developerSyncSourceChangeEvent, sourceChanged); window.addEventListener("henguren-settings-change", sourceChanged);
  void readWrongBookSyncSummary().then(() => inspect()).then(() => execute(true)).catch(fail);
  return () => {
    started = false; stopLearningSync(); unsubscribe();
    window.removeEventListener(learningChangeEventKey, changed); window.removeEventListener("storage", storage);
    window.removeEventListener("online", availability); window.removeEventListener("offline", availability);
    window.removeEventListener(learningOwnerEventKey, owner); window.removeEventListener("henguren-v3-sync-activity", activity);
    document.removeEventListener("visibilitychange", availability);
    window.removeEventListener(developerSyncSourceChangeEvent, sourceChanged); window.removeEventListener("henguren-settings-change", sourceChanged);
  };
}
export function useLearningSync() {
  const value = useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => state, () => initial);
  return { ...value, setEnabled, refresh };
}
