import type { MasteryRecord } from "./mastery.ts";
import type { WrongBookSnapshot } from "./types.ts";
import type { VocabSyncSnapshot } from "./vocab-sync.ts";

export const guestLearningOwner = "guest";
export function accountLearningOwner(userId: string) { return `account:${JSON.stringify(userId)}`; }

export type LearningPartition = {
  owner: string;
  wrongbook: WrongBookSnapshot;
  masteryRecords: MasteryRecord[];
  uploaded?: VocabSyncSnapshot;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, stableValue(entry)]));
  return value;
}
function same(left: unknown, right: unknown) { return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right)); }

/** Remove complete, unchanged word pairs only. Never create cloud deletion events. */
export function removeUploadedLearning(partition: LearningPartition): LearningPartition {
  const uploaded = partition.uploaded;
  if (!uploaded) return partition;
  const cloudWords = new Map(uploaded.records.map((record) => [record.id, record]));
  const cloudMastery = new Map(uploaded.masteryRecords.map((record) => [record.id, record]));
  const localMastery = new Map(partition.masteryRecords.map((record) => [record.id, record]));
  const removable = new Set(partition.wrongbook.records.filter((record) =>
    same(record, cloudWords.get(record.id)) && same(localMastery.get(record.id), cloudMastery.get(record.id))
  ).map((record) => record.id));
  const keepDeletions = (field: "deletedRecords" | "deletedBatches") => partition.wrongbook[field]
    .filter((entry) => !uploaded[field].some((confirmed) => same(entry, confirmed)));
  return {
    ...partition,
    wrongbook: { ...partition.wrongbook, records: partition.wrongbook.records.filter((record) => !removable.has(record.id)),
      deletedRecords: keepDeletions("deletedRecords"), deletedBatches: keepDeletions("deletedBatches") },
    masteryRecords: partition.masteryRecords.filter((record) => !removable.has(record.id)),
    uploaded: undefined
  };
}
