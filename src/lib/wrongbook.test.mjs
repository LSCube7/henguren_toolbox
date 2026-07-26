import assert from "node:assert/strict";
import test from "node:test";
import { mergeWrongBooks, normalizeWrongBook } from "../../.next/test-dist/lib/wrongbook.js";

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

test("preserves a legacy record updated after an old timestamp tombstone", () => {
  const normalized = normalizeWrongBook(snapshot({
    records: [{
      ...word,
      wrongCount: 2,
      testNos: ["legacy-test"],
      updatedAt: "2026-01-03T00:00:00.000Z"
    }],
    deletedRecords: [{
      id: word.id,
      clientId: "new-client",
      deletedAt: "2026-01-02T00:00:00.000Z"
    }]
  }), "user");

  assert.equal(normalized.records.length, 1);
  assert.equal(normalized.records[0].wrongCount, 2);
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
