import assert from "node:assert/strict";
import test from "node:test";
import { accountLearningOwner, guestLearningOwner, removeUploadedLearning } from "./learning-ownership.ts";

const syncedAt = "2026-02-01T00:00:00.000Z";
const nextReviewAt = "2026-02-02T00:00:00.000Z";

function wrongRecord(overrides = {}) {
  return {
    id: "unit:alpha",
    word: "alpha",
    sourceName: "unit",
    wrongCount: 1,
    wrongAttempts: [{ id: "attempt-alpha", clientId: "device-a", createdAt: syncedAt }],
    createdAt: syncedAt,
    updatedAt: syncedAt,
    ...overrides
  };
}

function masteryRecord(overrides = {}) {
  return {
    id: "unit:alpha",
    level: "reviewing",
    correctStreak: 2,
    reviewCount: 4,
    lastReviewedAt: syncedAt,
    nextReviewAt,
    updatedAt: syncedAt,
    wrongAttemptIds: ["attempt-alpha"],
    ...overrides
  };
}

function snapshot(overrides = {}) {
  return {
    schemaVersion: 2,
    learningSchemaVersion: 1,
    userId: "account-1",
    clientId: "device-a",
    updatedAt: syncedAt,
    records: [],
    deletedRecords: [],
    deletedBatches: [],
    masteryRecords: [],
    ...overrides
  };
}

function partition(overrides = {}) {
  return {
    owner: accountLearningOwner("account-1"),
    wrongbook: {
      schemaVersion: 2,
      userId: "local",
      clientId: "device-a",
      updatedAt: syncedAt,
      records: [],
      deletedRecords: [],
      deletedBatches: []
    },
    masteryRecords: [],
    ...overrides
  };
}

test("does not clear local learning before an upload is confirmed", () => {
  const localRecord = wrongRecord();
  const localMastery = masteryRecord();
  const local = partition({
    wrongbook: { ...partition().wrongbook, records: [localRecord] },
    masteryRecords: [localMastery]
  });

  const result = removeUploadedLearning(local);

  assert.strictEqual(result, local);
  assert.deepEqual(result.wrongbook.records, [localRecord]);
  assert.deepEqual(result.masteryRecords, [localMastery]);
});

test("clears the complete local word pair only when the confirmed upload matches", () => {
  const localRecord = wrongRecord();
  const localMastery = masteryRecord();
  const uploaded = snapshot({
    records: [structuredClone(localRecord)],
    masteryRecords: [structuredClone(localMastery)]
  });
  const local = partition({
    wrongbook: { ...partition().wrongbook, records: [localRecord] },
    masteryRecords: [localMastery],
    uploaded
  });

  const result = removeUploadedLearning(local);

  assert.deepEqual(result.wrongbook.records, []);
  assert.deepEqual(result.masteryRecords, []);
  assert.deepEqual(result.wrongbook.deletedRecords, []);
  assert.deepEqual(result.wrongbook.deletedBatches, []);
  assert.equal(result.uploaded, undefined);
});

test("keeps the whole word when local mastery changed after the uploaded snapshot", () => {
  const localRecord = wrongRecord();
  const uploadedMastery = masteryRecord();
  const localMastery = masteryRecord({ correctStreak: 3, level: "mastered", updatedAt: nextReviewAt });
  const local = partition({
    wrongbook: { ...partition().wrongbook, records: [localRecord] },
    masteryRecords: [localMastery],
    uploaded: snapshot({ records: [structuredClone(localRecord)], masteryRecords: [uploadedMastery] })
  });

  const result = removeUploadedLearning(local);

  assert.deepEqual(result.wrongbook.records, [localRecord]);
  assert.deepEqual(result.masteryRecords, [localMastery]);
});

test("keeps the whole word when its wrongbook record changed after upload", () => {
  const uploadedRecord = wrongRecord();
  const localRecord = wrongRecord({
    wrongCount: 2,
    wrongAttempts: [
      ...wrongRecord().wrongAttempts,
      { id: "attempt-alpha-2", clientId: "device-a", createdAt: nextReviewAt }
    ],
    updatedAt: nextReviewAt
  });
  const localMastery = masteryRecord();
  const local = partition({
    wrongbook: { ...partition().wrongbook, records: [localRecord] },
    masteryRecords: [localMastery],
    uploaded: snapshot({ records: [uploadedRecord], masteryRecords: [structuredClone(localMastery)] })
  });

  const result = removeUploadedLearning(local);

  assert.deepEqual(result.wrongbook.records, [localRecord]);
  assert.deepEqual(result.masteryRecords, [localMastery]);
});

test("removes only deletion markers already present in the confirmed upload", () => {
  const confirmedRecordDeletion = {
    id: "unit:deleted-alpha",
    clientId: "device-a",
    deletedAt: syncedAt,
    deletedAttemptIds: ["attempt-deleted-alpha"]
  };
  const newRecordDeletion = {
    id: "unit:deleted-beta",
    clientId: "device-a",
    deletedAt: nextReviewAt,
    deletedAttemptIds: ["attempt-deleted-beta"]
  };
  const confirmedBatchDeletion = {
    id: "test-1",
    clientId: "device-a",
    deletedAt: syncedAt,
    deletedAttemptIds: ["attempt-batch-1"]
  };
  const newBatchDeletion = {
    id: "test-2",
    clientId: "device-a",
    deletedAt: nextReviewAt,
    deletedAttemptIds: ["attempt-batch-2"]
  };
  const local = partition({
    wrongbook: {
      ...partition().wrongbook,
      deletedRecords: [confirmedRecordDeletion, newRecordDeletion],
      deletedBatches: [confirmedBatchDeletion, newBatchDeletion]
    },
    uploaded: snapshot({
      deletedRecords: [structuredClone(confirmedRecordDeletion)],
      deletedBatches: [structuredClone(confirmedBatchDeletion)]
    })
  });

  const result = removeUploadedLearning(local);

  assert.deepEqual(result.wrongbook.deletedRecords, [newRecordDeletion]);
  assert.deepEqual(result.wrongbook.deletedBatches, [newBatchDeletion]);
});

test("does not create deletion events when it clears an uploaded word", () => {
  const localRecord = wrongRecord();
  const localMastery = masteryRecord();
  const local = partition({
    wrongbook: { ...partition().wrongbook, records: [localRecord] },
    masteryRecords: [localMastery],
    uploaded: snapshot({ records: [structuredClone(localRecord)], masteryRecords: [structuredClone(localMastery)] })
  });

  const result = removeUploadedLearning(local);

  assert.deepEqual(result.wrongbook.deletedRecords, []);
  assert.deepEqual(result.wrongbook.deletedBatches, []);
});

test("assigns a distinct stable owner marker to each account", () => {
  const owners = ["alice", "bob", "a:b", "a\"b", "用户"].map(accountLearningOwner);

  assert.equal(new Set(owners).size, owners.length);
  assert.equal(accountLearningOwner("alice"), accountLearningOwner("alice"));
  assert.notEqual(accountLearningOwner("alice"), guestLearningOwner);
});
