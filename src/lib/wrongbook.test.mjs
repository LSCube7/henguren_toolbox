import assert from "node:assert/strict";
import test from "node:test";
import { mergeWrongBooks, normalizeWrongBook, planMasteryRecordIdMigrations, removeWrongBookBatchAttempts } from "./wrongbook.ts";

const word = {
  id: "unit:example",
  word: "example",
  sourceName: "unit",
  wrongCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

function snapshot(overrides = {}) {
  return {
    schemaVersion: 2,
    userId: "user",
    clientId: "test-client",
    updatedAt: "2026-01-01T00:00:00.000Z",
    records: [],
    deletedRecords: [],
    deletedBatches: [],
    ...overrides
  };
}

test("preserves only the latest synthesized attempt after a legacy deletion cutoff", () => {
  const normalized = normalizeWrongBook(snapshot({
    records: [{
      ...word,
      wrongCount: 4,
      testNos: ["legacy-test"],
      updatedAt: "2026-01-10T00:00:00.000Z"
    }],
    deletedRecords: [{
      id: word.id,
      clientId: "new-client",
      deletedAt: "2026-01-05T00:00:00.000Z"
    }]
  }), "user");

  assert.equal(normalized.records.length, 1);
  assert.equal(normalized.records[0].wrongCount, 1);
  assert.equal(normalized.records[0].wrongAttempts[0].createdAt, "2026-01-10T00:00:00.000Z");
});

test("uses observed attempt ids instead of client clocks for record deletion", () => {
  const merged = mergeWrongBooks("user", snapshot({
    records: [{
      ...word,
      wrongCount: 2,
      wrongAttempts: [
        { id: "attempt-old", clientId: "device-a", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "attempt-new", clientId: "device-c", createdAt: "2026-01-02T00:00:00.000Z" }
      ]
    }],
    deletedRecords: [{
      id: word.id,
      clientId: "fast-clock-device",
      deletedAt: "2030-01-01T00:00:00.000Z",
      deletedAttemptIds: ["attempt-old"]
    }]
  }));

  assert.deepEqual(merged.records[0].wrongAttempts.map((attempt) => attempt.id), ["attempt-new"]);
});

test("conservatively preserves cross-device attempts for legacy tombstones", () => {
  const normalized = normalizeWrongBook(snapshot({
    records: [{
      ...word,
      wrongCount: 1,
      wrongAttempts: [{
        id: "attempt-other-device",
        clientId: "normal-clock-device",
        createdAt: "2026-01-02T00:00:00.000Z"
      }]
    }],
    deletedRecords: [{
      id: word.id,
      clientId: "fast-clock-device",
      deletedAt: "2030-01-01T00:00:00.000Z"
    }]
  }), "user");

  assert.deepEqual(normalized.records[0].wrongAttempts.map((attempt) => attempt.id), ["attempt-other-device"]);
});

test("unions observed attempts from repeated deletions", () => {
  const merged = mergeWrongBooks("user", snapshot({
    records: [{
      ...word,
      wrongCount: 3,
      wrongAttempts: [
        { id: "attempt-a", clientId: "device-a", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "attempt-b", clientId: "device-b", createdAt: "2026-01-02T00:00:00.000Z" },
        { id: "attempt-c", clientId: "device-c", createdAt: "2026-01-03T00:00:00.000Z" }
      ]
    }],
    deletedRecords: [
      { id: word.id, clientId: "device-a", deletedAt: "2030-01-01T00:00:00.000Z", deletedAttemptIds: ["attempt-a"] },
      { id: word.id, clientId: "device-b", deletedAt: "2025-01-01T00:00:00.000Z", deletedAttemptIds: ["attempt-b"] }
    ]
  }));

  assert.deepEqual(merged.records[0].wrongAttempts.map((attempt) => attempt.id), ["attempt-c"]);
});

test("retains legacy deletion cutoffs for their originating clients", () => {
  const merged = mergeWrongBooks("user", snapshot({
    records: [{
      ...word,
      wrongCount: 3,
      wrongAttempts: [
        { id: "stale-a", clientId: "device-a", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "observed-b", clientId: "device-b", createdAt: "2026-01-02T00:00:00.000Z" },
        { id: "future-a", clientId: "device-a", createdAt: "2026-01-04T00:00:00.000Z" }
      ]
    }],
    deletedRecords: [
      { id: word.id, clientId: "device-a", deletedAt: "2026-01-03T00:00:00.000Z" },
      { id: word.id, clientId: "device-b", deletedAt: "2026-01-05T00:00:00.000Z", deletedAttemptIds: ["observed-b"] }
    ]
  }));

  assert.deepEqual(merged.records[0].wrongAttempts.map((attempt) => attempt.id), ["future-a"]);
  assert.deepEqual(merged.deletedRecords[0].legacyDeletionCutoffs, {
    "device-a": "2026-01-03T00:00:00.000Z"
  });
});

test("merges legacy records with noncanonical ids by source and word", () => {
  const merged = mergeWrongBooks("user", snapshot({
    schemaVersion: 1,
    updatedAt: "2026-01-03T00:00:00.000Z",
    records: [{
      ...word,
      id: "legacy-import-id",
      wrongCount: 1,
      testNos: ["legacy-test"],
      updatedAt: "2026-01-03T00:00:00.000Z"
    }]
  }), snapshot({
    updatedAt: "2026-01-02T00:00:00.000Z",
    records: [{
      ...word,
      wrongCount: 1,
      wrongAttempts: [{
        id: "current-attempt",
        clientId: "current-client",
        createdAt: "2026-01-02T00:00:00.000Z"
      }],
      updatedAt: "2026-01-02T00:00:00.000Z"
    }]
  }));

  assert.equal(merged.records.length, 1);
  assert.equal(merged.records[0].id, word.id);
  assert.equal(merged.records[0].wrongCount, 2);
  assert.deepEqual(
    merged.records[0].wrongAttempts.map((attempt) => attempt.id).sort(),
    ["current-attempt", 'legacy-v2:["unit:example","test","legacy-test"]']
  );
});

test("deduplicates synthesized attempts across record id aliases", () => {
  const merged = mergeWrongBooks("user", snapshot({
    records: [{
      ...word,
      id: "legacy-import-id",
      wrongCount: 2,
      testNos: ["legacy-test"]
    }]
  }), snapshot({
    records: [{
      ...word,
      wrongCount: 2,
      testNos: ["legacy-test"]
    }]
  }));

  assert.equal(merged.records[0].wrongCount, 2);
  assert.deepEqual(merged.records[0].wrongAttempts.map((attempt) => attempt.id).sort(), [
    'legacy-v2:["unit:example","count",2]',
    'legacy-v2:["unit:example","test","legacy-test"]'
  ]);
});

test("keeps synthesized test and count attempts distinct for delimiter-like test ids", () => {
  const normalized = normalizeWrongBook(snapshot({
    records: [{
      ...word,
      wrongCount: 2,
      testNos: ["count:2"]
    }]
  }), "user");

  assert.equal(normalized.records[0].wrongCount, 2);
  assert.deepEqual(normalized.records[0].wrongAttempts.map((attempt) => attempt.id).sort(), [
    'legacy-v2:["unit:example","count",2]',
    'legacy-v2:["unit:example","test","count:2"]'
  ]);
});

test("applies previous synthesized attempt ids from record tombstones", () => {
  const merged = mergeWrongBooks("user", snapshot({
    records: [{
      ...word,
      wrongCount: 1,
      testNos: ["legacy-test"]
    }]
  }), snapshot({
    deletedRecords: [{
      id: word.id,
      clientId: "legacy-client",
      deletedAt: "2026-01-02T00:00:00.000Z",
      deletedAttemptIds: ["legacy:unit:example:legacy-test"]
    }]
  }));

  assert.deepEqual(merged.records, []);
});

test("matches previous and current synthesized ids in both directions for batch tombstones", () => {
  const previousAttempt = {
    id: "legacy:unit:example:legacy-test",
    testNo: "legacy-test",
    clientId: "legacy",
    createdAt: word.createdAt
  };
  const currentAttemptId = 'legacy-v2:["unit:example","test","legacy-test"]';
  const previousDeletedByCurrent = mergeWrongBooks("user", snapshot({
    records: [{ ...word, wrongCount: 1, wrongAttempts: [previousAttempt] }],
    deletedBatches: [{
      id: "legacy-test",
      clientId: "current-client",
      deletedAt: "2026-01-02T00:00:00.000Z",
      deletedAttemptIds: [currentAttemptId]
    }]
  }));
  const currentDeletedByPrevious = mergeWrongBooks("user", snapshot({
    records: [{ ...word, wrongCount: 1, testNos: ["legacy-test"] }],
    deletedBatches: [{
      id: "legacy-test",
      clientId: "previous-client",
      deletedAt: "2026-01-02T00:00:00.000Z",
      deletedAttemptIds: [previousAttempt.id]
    }]
  }));

  assert.deepEqual(previousDeletedByCurrent.records, []);
  assert.deepEqual(currentDeletedByPrevious.records, []);
});

test("keeps the newest duplicate synthesized attempt regardless of snapshot order", () => {
  const merged = mergeWrongBooks("user", snapshot({
    records: [{
      ...word,
      id: "newer-alias",
      wrongCount: 1,
      testNos: ["legacy-test"],
      updatedAt: "2026-01-05T00:00:00.000Z"
    }]
  }), snapshot({
    records: [{
      ...word,
      id: "older-alias",
      wrongCount: 1,
      testNos: ["legacy-test"],
      updatedAt: "2026-01-02T00:00:00.000Z"
    }],
    deletedRecords: [{
      id: word.id,
      clientId: "legacy-client",
      deletedAt: "2026-01-03T00:00:00.000Z"
    }]
  }));

  assert.equal(merged.records.length, 1);
  assert.equal(merged.records[0].wrongAttempts[0].createdAt, "2026-01-05T00:00:00.000Z");
});

test("reports only records fully removed by a batch deletion", () => {
  const removed = {
    ...word,
    id: "unit:removed",
    word: "removed",
    wrongCount: 1,
    wrongAttempts: [{ id: "removed-attempt", testNo: "target", clientId: "client-a", createdAt: word.createdAt }]
  };
  const retained = {
    ...word,
    id: "unit:retained",
    word: "retained",
    wrongCount: 2,
    wrongAttempts: [
      { id: "target-attempt", testNo: "target", clientId: "client-a", createdAt: word.createdAt },
      { id: "other-attempt", testNo: "other", clientId: "client-b", createdAt: word.createdAt }
    ]
  };
  const unrelated = {
    ...word,
    id: "unit:unrelated",
    word: "unrelated",
    wrongCount: 1,
    wrongAttempts: [{ id: "unrelated-attempt", testNo: "other", clientId: "client-b", createdAt: word.createdAt }]
  };
  const result = removeWrongBookBatchAttempts([removed, retained, unrelated], "target", "2026-01-02T00:00:00.000Z");

  assert.deepEqual(result.removedRecordIds, [removed.id]);
  assert.deepEqual(result.deletedAttemptIds.sort(), ["removed-attempt", "target-attempt"]);
  assert.deepEqual(result.records.map((record) => record.id), [retained.id, unrelated.id]);
  assert.deepEqual(result.records[0].wrongAttempts.map((attempt) => attempt.id), ["other-attempt"]);
  assert.equal(result.records[1], unrelated);
});

test("applies legacy-id tombstones to every alias in a merged record", () => {
  const staleLegacySnapshot = snapshot({
    records: [{
      ...word,
      id: "legacy-import-id",
      wrongCount: 1,
      wrongAttempts: [{
        id: "deleted-legacy-attempt",
        clientId: "legacy-client",
        createdAt: "2026-01-01T00:00:00.000Z"
      }]
    }]
  });
  const merged = mergeWrongBooks("user", staleLegacySnapshot, snapshot({
    records: [{
      ...word,
      wrongCount: 1,
      wrongAttempts: [{
        id: "current-attempt",
        clientId: "current-client",
        createdAt: "2026-01-02T00:00:00.000Z"
      }],
      updatedAt: "2026-01-02T00:00:00.000Z"
    }],
    deletedRecords: [{
      id: "legacy-import-id",
      clientId: "deleting-client",
      deletedAt: "2026-01-03T00:00:00.000Z",
      deletedAttemptIds: ["deleted-legacy-attempt"]
    }]
  }));

  assert.equal(merged.records.length, 1);
  assert.equal(merged.records[0].id, word.id);
  assert.deepEqual(merged.records[0].wrongAttempts.map((attempt) => attempt.id), ["current-attempt"]);
  assert.equal(merged.deletedRecords.length, 1);
  assert.equal(merged.deletedRecords[0].id, word.id);

  const mergedAgain = mergeWrongBooks("user", merged, staleLegacySnapshot);
  assert.deepEqual(mergedAgain.records[0].wrongAttempts.map((attempt) => attempt.id), ["current-attempt"]);
});

test("uses distinct record ids for delimiter-containing source and word pairs", () => {
  const merged = mergeWrongBooks("user", snapshot({
    records: [
      {
        ...word,
        id: "first-record",
        sourceName: "a:b",
        word: "c",
        wrongCount: 1,
        wrongAttempts: [{ id: "first-attempt", clientId: "client-a", createdAt: word.createdAt }]
      },
      {
        ...word,
        id: "second-record",
        sourceName: "a",
        word: "b:c",
        wrongCount: 1,
        wrongAttempts: [{ id: "second-attempt", clientId: "client-b", createdAt: word.createdAt }]
      }
    ]
  }));

  assert.equal(merged.records.length, 2);
  assert.deepEqual(
    merged.records.map((record) => record.id).sort(),
    ['tuple-v1:["a","b:c"]', 'tuple-v1:["a:b","c"]']
  );
  assert.deepEqual(merged.records.map((record) => record.word).sort(), ["b:c", "c"]);
});

test("migrates standalone legacy tombstones to tuple record ids", () => {
  const sourceName = "a:b";
  const recordId = 'tuple-v1:["a:b","c"]';
  const merged = mergeWrongBooks("user", snapshot({
    records: [],
    deletedRecords: [{
      id: "a:b:c",
      clientId: "legacy-client",
      deletedAt: "2026-01-03T00:00:00.000Z",
      deletedAttemptIds: ["deleted-attempt"]
    }]
  }), snapshot({
    records: [{
      ...word,
      id: recordId,
      sourceName,
      word: "c",
      wrongCount: 2,
      wrongAttempts: [
        { id: "deleted-attempt", clientId: "legacy-client", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "current-attempt", clientId: "current-client", createdAt: "2026-01-04T00:00:00.000Z" }
      ]
    }]
  }));

  assert.equal(merged.records[0].id, recordId);
  assert.deepEqual(merged.records[0].wrongAttempts.map((attempt) => attempt.id), ["current-attempt"]);
  assert.equal(merged.deletedRecords[0].id, recordId);
});

test("plans mastery migration to the tuple record id", () => {
  const record = {
    ...word,
    id: 'tuple-v1:["a:b","c"]',
    sourceName: "a:b",
    word: "c"
  };
  const legacyMastery = {
    id: "a:b:c",
    level: "reviewing",
    correctStreak: 2,
    reviewCount: 4,
    lastReviewedAt: "2026-01-03T00:00:00.000Z",
    nextReviewAt: "2026-01-06T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z"
  };
  const migrations = planMasteryRecordIdMigrations([record], { [legacyMastery.id]: legacyMastery });

  assert.equal(migrations.length, 1);
  assert.equal(migrations[0].legacyId, legacyMastery.id);
  assert.equal(migrations[0].canonicalId, record.id);
  assert.deepEqual(migrations[0].record, { ...legacyMastery, id: record.id });
});

test("keeps newer canonical mastery progress during id migration", () => {
  const record = {
    ...word,
    id: 'tuple-v1:["a:b","c"]',
    sourceName: "a:b",
    word: "c"
  };
  const legacyMastery = {
    id: "a:b:c",
    level: "reviewing",
    correctStreak: 2,
    reviewCount: 4,
    lastReviewedAt: "2026-01-03T00:00:00.000Z",
    nextReviewAt: "2026-01-06T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z"
  };
  const canonicalMastery = {
    ...legacyMastery,
    id: record.id,
    level: "mastered",
    correctStreak: 4,
    reviewCount: 8,
    updatedAt: "2026-01-04T00:00:00.000Z"
  };
  const migrations = planMasteryRecordIdMigrations([record], {
    [legacyMastery.id]: legacyMastery,
    [canonicalMastery.id]: canonicalMastery
  });

  assert.equal(migrations.length, 1);
  assert.deepEqual(migrations[0].record, canonicalMastery);
});

test("preserves arbitrary imported ids as aliases during canonicalization", () => {
  const merged = mergeWrongBooks("user", snapshot({
    records: [{
      ...word,
      id: "legacy-import-id",
      wrongCount: 1,
      wrongAttempts: [{ id: "legacy-attempt", clientId: "legacy-client", createdAt: word.createdAt }]
    }]
  }));

  assert.equal(merged.records[0].id, word.id);
  assert.deepEqual(merged.records[0].aliases, ["legacy-import-id"]);
});

test("migrates mastery from an arbitrary stored record id", () => {
  const legacyMastery = {
    id: "legacy-import-id",
    level: "reviewing",
    correctStreak: 2,
    reviewCount: 4,
    lastReviewedAt: "2026-01-03T00:00:00.000Z",
    nextReviewAt: "2026-01-06T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z"
  };
  const migrations = planMasteryRecordIdMigrations([{
    ...word,
    aliases: [legacyMastery.id]
  }], { [legacyMastery.id]: legacyMastery });

  assert.equal(migrations.length, 1);
  assert.equal(migrations[0].legacyId, legacyMastery.id);
  assert.equal(migrations[0].canonicalId, word.id);
  assert.deepEqual(migrations[0].record, { ...legacyMastery, id: word.id });
});

test("uses the newest mastery progress across every historical id alias", () => {
  const olderMastery = {
    id: "legacy-import-id",
    level: "learning",
    correctStreak: 1,
    reviewCount: 2,
    lastReviewedAt: "2026-01-02T00:00:00.000Z",
    nextReviewAt: "2026-01-03T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z"
  };
  const newerMastery = {
    ...olderMastery,
    id: "older-import-id",
    level: "reviewing",
    correctStreak: 3,
    reviewCount: 5,
    updatedAt: "2026-01-04T00:00:00.000Z"
  };
  const migrations = planMasteryRecordIdMigrations([{
    ...word,
    aliases: [olderMastery.id, newerMastery.id]
  }], {
    [olderMastery.id]: olderMastery,
    [newerMastery.id]: newerMastery
  });

  assert.equal(migrations.length, 2);
  assert.deepEqual(new Set(migrations.map((migration) => migration.legacyId)), new Set([olderMastery.id, newerMastery.id]));
  assert.ok(migrations.every((migration) => migration.record.id === word.id));
  assert.ok(migrations.every((migration) => migration.record.updatedAt === newerMastery.updatedAt));
});

test("does not migrate mastery when an alias is another record's canonical id", () => {
  const canonicalMastery = {
    id: word.id,
    level: "reviewing",
    correctStreak: 2,
    reviewCount: 4,
    lastReviewedAt: "2026-01-03T00:00:00.000Z",
    nextReviewAt: "2026-01-06T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z"
  };
  const migrations = planMasteryRecordIdMigrations([
    word,
    {
      ...word,
      id: "other:entry",
      aliases: [word.id],
      sourceName: "other",
      word: "entry"
    }
  ], { [canonicalMastery.id]: canonicalMastery });

  assert.deepEqual(migrations, []);
});

test("keeps canonical tombstones scoped when the id is another record's alias", () => {
  const merged = mergeWrongBooks("user", snapshot({
    records: [
      {
        ...word,
        wrongCount: 1,
        wrongAttempts: [{ id: "canonical-attempt", clientId: "canonical-client", createdAt: word.createdAt }]
      },
      {
        ...word,
        id: "other:entry",
        aliases: [word.id],
        sourceName: "other",
        word: "entry",
        wrongCount: 1,
        wrongAttempts: [{ id: "other-attempt", clientId: "other-client", createdAt: word.createdAt }]
      }
    ],
    deletedRecords: [{
      id: word.id,
      clientId: "canonical-client",
      deletedAt: "2026-01-02T00:00:00.000Z",
      deletedAttemptIds: ["canonical-attempt"]
    }]
  }));

  assert.deepEqual(merged.records.map((record) => record.id), ["other:entry"]);
  assert.deepEqual(merged.records[0].wrongAttempts.map((attempt) => attempt.id), ["other-attempt"]);
  assert.equal(merged.deletedRecords[0].id, word.id);
});

test("applies standalone arbitrary-id tombstones through retained record aliases", () => {
  const canonicalSnapshot = mergeWrongBooks("user", snapshot({
    records: [{
      ...word,
      id: "legacy-import-id",
      wrongCount: 2,
      wrongAttempts: [
        { id: "deleted-attempt", clientId: "legacy-client", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "current-attempt", clientId: "current-client", createdAt: "2026-01-04T00:00:00.000Z" }
      ]
    }]
  }));
  const merged = mergeWrongBooks("user", snapshot({
    deletedRecords: [{
      id: "legacy-import-id",
      clientId: "legacy-client",
      deletedAt: "2026-01-03T00:00:00.000Z",
      deletedAttemptIds: ["deleted-attempt"]
    }]
  }), canonicalSnapshot);

  assert.equal(merged.records[0].id, word.id);
  assert.deepEqual(merged.records[0].wrongAttempts.map((attempt) => attempt.id), ["current-attempt"]);
  assert.equal(merged.deletedRecords[0].id, word.id);
  assert.deepEqual(merged.records[0].aliases, ["legacy-import-id"]);
});
