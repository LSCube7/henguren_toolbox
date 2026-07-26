import assert from "node:assert/strict";
import test from "node:test";
import { mergeWrongBooks, normalizeWrongBook } from "./wrongbook.ts";

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
    ["current-attempt", "legacy:legacy-import-id:legacy-test"]
  );
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
