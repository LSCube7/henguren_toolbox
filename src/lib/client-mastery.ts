"use client";

import { nextMasteryRecord, preferredMasteryRecord, type MasteryRecord } from "./mastery";
import { currentLearningOwner, readLearningPartition, updateLearningPartition } from "./client-learning-storage";
import { mergeVocabSnapshots, parseVocabSnapshot } from "./vocab-sync";
import type { WrongBookSnapshot, WrongBookRecord, WrongBookTombstone } from "./types";
import { mergeWrongBooks, planMasteryReconciliation } from "./wrongbook";

export async function readMasteryRecords(): Promise<MasteryRecord[]> {
  return (await readLearningPartition()).masteryRecords;
}
export async function readMasteryMap() {
  return Object.fromEntries((await readMasteryRecords()).map((record) => [record.id, record]));
}
export function reconcileMasteryRecords(records: WrongBookRecord[], deletedRecords: WrongBookTombstone[] = []) {
  return updateLearningPartition(currentLearningOwner(), (partition) => {
    // Callers may have read a stale snapshot; reconcile the transaction's data.
    records = mergeWrongBooks("local", partition.wrongbook).records;
    deletedRecords = partition.wrongbook.deletedRecords;
    const current = Object.fromEntries(partition.masteryRecords.map((record) => [record.id, record]));
    const plan = planMasteryReconciliation(records, current, deletedRecords);
    return { partition: { ...partition, masteryRecords: Object.values(plan.masteryById) }, result: plan.masteryById };
  });
}
export async function mergeMasteryRecords(records: MasteryRecord[], wrongbook?: WrongBookSnapshot) {
  if (records.length === 0 && !wrongbook) return;
  return updateLearningPartition(currentLearningOwner(), (partition) => {
    let masteryRecords: MasteryRecord[];
    if (wrongbook) {
      // Read the current wrongbook in the same transaction as mastery updates.
      masteryRecords = mergeVocabSnapshots("local",
        parseVocabSnapshot({ ...partition.wrongbook, masteryRecords: partition.masteryRecords }, "local"),
        parseVocabSnapshot({ ...partition.wrongbook, masteryRecords: records }, "local")
      ).masteryRecords;
    } else {
      const byId = new Map(partition.masteryRecords.map((record) => [record.id, record]));
      records.forEach((record) => byId.set(record.id, byId.has(record.id) ? preferredMasteryRecord(byId.get(record.id)!, record) : record));
      masteryRecords = [...byId.values()];
    }
    return { partition: { ...partition, masteryRecords }, result: undefined };
  });
}
export function recordMasteryResult(id: string, correct: boolean) {
  return updateLearningPartition(currentLearningOwner(), (partition) => {
    const wrongAttemptIds = partition.wrongbook.records.find((record) => record.id === id)?.wrongAttempts?.map((attempt) => attempt.id) ?? [];
    const current = partition.masteryRecords.find((record) => record.id === id);
    const sameCycle = !current?.wrongAttemptIds || current.wrongAttemptIds.some((attempt) => wrongAttemptIds.includes(attempt));
    const record = { ...nextMasteryRecord(id, sameCycle ? current : undefined, correct), wrongAttemptIds };
    return { partition: { ...partition, masteryRecords: [...partition.masteryRecords.filter((entry) => entry.id !== id), record] }, result: record };
  });
}
export async function deleteMasteryRecord(id: string) {
  await updateLearningPartition(currentLearningOwner(), (partition) => ({
    partition: { ...partition, masteryRecords: partition.masteryRecords.filter((record) => record.id !== id) }, result: undefined
  }));
}
