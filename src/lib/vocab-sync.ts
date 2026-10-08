import type { MasteryRecord } from "./mastery.ts";
import { preferredMasteryRecord } from "./mastery.ts";
import type { WrongBookSnapshot } from "./types.ts";
import { mergeWrongBooks, normalizeWrongBook, planMasteryReconciliation } from "./wrongbook.ts";

// Additive extension keeps the existing v2 wrongbook and old clients readable.
export type VocabSyncSnapshot = WrongBookSnapshot & {
  learningSchemaVersion: 1;
  masteryRecords: MasteryRecord[];
  revision?: string;
};
export const maxSyncBytes = 5 * 1024 * 1024;

export class SyncOperationError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 500) {
    super(`单词学习同步失败，请重试。调试信息：模块 vocab-sync，错误类型 ${code}。`);
    this.name = "SyncOperationError";
    this.code = code;
    this.status = status;
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function timestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function parseVocabSnapshot(value: unknown, userId: string): VocabSyncSnapshot {
  if (!object(value) || !Array.isArray(value.records)) throw new SyncOperationError("INVALID_SNAPSHOT", 400);
  if ((value.schemaVersion !== undefined && value.schemaVersion !== 1 && value.schemaVersion !== 2) ||
      (value.learningSchemaVersion !== undefined && value.learningSchemaVersion !== 1)) {
    throw new SyncOperationError("UNSUPPORTED_VERSION", 400);
  }
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > maxSyncBytes) throw new SyncOperationError("SNAPSHOT_TOO_LARGE", 413);
  const records = value.records;
  if (records.some((record) => !object(record) || typeof record.word !== "string" || !record.word.trim() ||
    (record.wrongCount !== undefined && (!Number.isSafeInteger(record.wrongCount) || Number(record.wrongCount) < 0)) ||
    (record.createdAt !== undefined && !timestamp(record.createdAt)) ||
    (record.updatedAt !== undefined && !timestamp(record.updatedAt)) ||
    (record.sourceName !== undefined && typeof record.sourceName !== "string") ||
    (record.wrongAttempts !== undefined && (!Array.isArray(record.wrongAttempts) || record.wrongAttempts.some((attempt) =>
      !object(attempt) || typeof attempt.id !== "string" || !attempt.id || !timestamp(attempt.createdAt)))))) {
    throw new SyncOperationError("INVALID_WRONGBOOK", 400);
  }
  // Bound legacy count expansion before normalization synthesizes missing events.
  const expandedCount = records.reduce((total, record) => total + Math.max(
    Number(record.wrongCount ?? 0), Array.isArray(record.wrongAttempts) ? record.wrongAttempts.length : 0,
    Array.isArray(record.testNos) ? record.testNos.length : 0
  ), 0);
  if (expandedCount > 50_000) throw new SyncOperationError("SNAPSHOT_TOO_LARGE", 413);
  for (const field of ["deletedRecords", "deletedBatches"]) {
    if (value[field] !== undefined && (!Array.isArray(value[field]) || value[field].some((entry) =>
      !object(entry) || typeof entry.id !== "string" || !entry.id || !timestamp(entry.deletedAt)))) {
      throw new SyncOperationError("INVALID_DELETIONS", 400);
    }
  }
  if (value.masteryRecords !== undefined && !Array.isArray(value.masteryRecords)) throw new SyncOperationError("INVALID_MASTERY", 400);
  if (value.learningSchemaVersion === 1 && value.masteryRecords === undefined) throw new SyncOperationError("INVALID_MASTERY", 400);
  const mastery = (value.masteryRecords ?? []) as unknown[];
  if (mastery.some((record) => !object(record) || typeof record.id !== "string" || !record.id ||
    !["learning", "reviewing", "mastered"].includes(String(record.level)) ||
    !Number.isSafeInteger(record.correctStreak) || Number(record.correctStreak) < 0 ||
    !Number.isSafeInteger(record.reviewCount) || Number(record.reviewCount) < 0 ||
    !timestamp(record.lastReviewedAt) || !timestamp(record.nextReviewAt) || !timestamp(record.updatedAt) ||
    (record.wrongAttemptIds !== undefined && (!Array.isArray(record.wrongAttemptIds) || record.wrongAttemptIds.some((id) => typeof id !== "string" || !id))))) {
    throw new SyncOperationError("INVALID_MASTERY", 400);
  }
  // Normalize legacy ids before applying deletions, so old progress keeps its
  // original observed attempts instead of attaching itself to a re-added word.
  const raw = normalizeWrongBook({ ...value, deletedRecords: [], deletedBatches: [] } as Partial<WrongBookSnapshot>, userId);
  const canonical = mergeWrongBooks(userId, raw);
  const byId: Record<string, MasteryRecord> = Object.create(null);
  for (const candidate of mastery as MasteryRecord[]) {
    const record: MasteryRecord = {
      id: candidate.id.toLowerCase(), level: candidate.level,
      correctStreak: candidate.correctStreak, reviewCount: candidate.reviewCount,
      lastReviewedAt: new Date(candidate.lastReviewedAt).toISOString(),
      nextReviewAt: new Date(candidate.nextReviewAt).toISOString(),
      updatedAt: new Date(candidate.updatedAt).toISOString(),
      wrongAttemptIds: candidate.wrongAttemptIds ? [...new Set(candidate.wrongAttemptIds)].sort() : undefined
    };
    byId[record.id] = byId[record.id] ? preferredMasteryRecord(byId[record.id], record) : record;
  }
  const reconciled = planMasteryReconciliation(canonical.records, byId, canonical.deletedRecords).masteryById;
  const attemptsById = new Map(canonical.records.map((record) => [record.id, record.wrongAttempts?.map((attempt) => attempt.id) ?? []]));
  const scoped = Object.values(reconciled).map((record) => ({
    ...record,
    wrongAttemptIds: record.wrongAttemptIds ?? [...(attemptsById.get(record.id) ?? [])].sort()
  }));
  const wrongbook = mergeWrongBooks(userId, normalizeWrongBook(value as Partial<WrongBookSnapshot>, userId));
  return { ...wrongbook, learningSchemaVersion: 1, masteryRecords: activeMastery(wrongbook, scoped) };
}

function activeMastery(wrongbook: WrongBookSnapshot, records: MasteryRecord[]) {
  const active = new Map(wrongbook.records.map((record) => [record.id, new Set(record.wrongAttempts?.map((attempt) => attempt.id))]));
  return records.filter((record) => record.wrongAttemptIds?.some((id) => active.get(record.id)?.has(id)))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function mergeVocabSnapshots(userId: string, ...snapshots: VocabSyncSnapshot[]): VocabSyncSnapshot {
  const wrongbook = mergeWrongBooks(userId, ...snapshots);
  const mastery = new Map<string, MasteryRecord>();
  for (const snapshot of snapshots) {
    for (const record of activeMastery(wrongbook, snapshot.masteryRecords)) {
      const current = mastery.get(record.id);
      mastery.set(record.id, current ? preferredMasteryRecord(current, record) : record);
    }
  }
  return { ...wrongbook, learningSchemaVersion: 1, masteryRecords: [...mastery.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}

export function overwriteVocabSnapshot(userId: string, incoming: VocabSyncSnapshot, cloud: VocabSyncSnapshot, includesMastery: boolean) {
  if (includesMastery) return incoming;
  return { ...incoming, masteryRecords: activeMastery(incoming, cloud.masteryRecords), userId };
}
