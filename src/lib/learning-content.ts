export type LearningContent = {
  records: unknown[];
  masteryRecords?: unknown[];
  deletedRecords?: unknown[];
  deletedBatches?: unknown[];
};

const unorderedArrayProperties = new Set([
  "records",
  "masteryRecords",
  "deletedRecords",
  "deletedBatches",
  "wrongAttempts",
  "testNos",
  "batchNames",
  "aliases",
  "deletedAttemptIds",
  "wrongAttemptIds"
]);

function stableJson(value: unknown, property?: string): string {
  if (Array.isArray(value)) {
    const entries = value.map((item) => stableJson(item));
    if (property && unorderedArrayProperties.has(property)) entries.sort();
    return "[" + entries.join(",") + "]";
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => JSON.stringify(key) + ":" + stableJson(record[key], key));
    return "{" + entries.join(",") + "}";
  }

  return JSON.stringify(value) ?? "null";
}

export function learningContentKey(value: LearningContent): string {
  return stableJson({
    records: value.records,
    masteryRecords: value.masteryRecords ?? [],
    deletedRecords: value.deletedRecords ?? [],
    deletedBatches: value.deletedBatches ?? []
  });
}
