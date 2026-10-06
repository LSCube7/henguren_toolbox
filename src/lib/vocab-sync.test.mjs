import assert from "node:assert/strict";
import test from "node:test";
import { mergeVocabSnapshots, overwriteVocabSnapshot, parseVocabSnapshot } from "./vocab-sync.ts";
import { wrongBookRecordId } from "./wrongbook.ts";

const userId = "test-user";
const firstDay = "2026-01-01T00:00:00.000Z";
const secondDay = "2026-01-02T00:00:00.000Z";

function attempt(id, createdAt = firstDay, clientId = "device-a") {
  return { id, clientId, createdAt };
}

function wrongRecord(word, attempts = [attempt(`attempt-${word}`)], sourceName = "unit") {
  return {
    id: wrongBookRecordId({ sourceName, word }),
    word,
    sourceName,
    wrongCount: attempts.length,
    wrongAttempts: attempts,
    createdAt: firstDay,
    updatedAt: firstDay
  };
}

function snapshot(records = [], overrides = {}) {
  return {
    schemaVersion: 2,
    userId,
    clientId: "device-a",
    updatedAt: firstDay,
    records,
    deletedRecords: [],
    deletedBatches: [],
    ...overrides
  };
}

function mastery(id, overrides = {}) {
  return {
    id,
    level: "reviewing",
    correctStreak: 2,
    reviewCount: 4,
    lastReviewedAt: firstDay,
    nextReviewAt: secondDay,
    updatedAt: firstDay,
    wrongAttemptIds: ["attempt-alpha"],
    ...overrides
  };
}

test("reads legacy v1 and v2 wrongbook snapshots and produces the current snapshot shape", () => {
  const legacyV1 = parseVocabSnapshot({
    schemaVersion: 1,
    userId,
    clientId: "old-client",
    updatedAt: firstDay,
    records: [{
      id: "unit:alpha",
      word: "alpha",
      sourceName: "unit",
      wrongCount: 1,
      testNos: ["old-test"],
      createdAt: firstDay,
      updatedAt: firstDay
    }]
  }, userId);
  const legacyV2 = parseVocabSnapshot(snapshot([wrongRecord("beta")]), userId);

  assert.equal(legacyV1.schemaVersion, 2);
  assert.equal(legacyV1.records[0].wrongAttempts[0].testNo, "old-test");
  assert.deepEqual(legacyV1.masteryRecords, []);
  assert.equal(legacyV2.records[0].word, "beta");
  assert.deepEqual(legacyV2.masteryRecords, []);
});

test("keeps cloud mastery when overwriting from an older client that omitted mastery", () => {
  const record = wrongRecord("alpha");
  const incoming = parseVocabSnapshot(snapshot([record]), userId);
  const cloud = parseVocabSnapshot(snapshot([record], {
    learningSchemaVersion: 1,
    masteryRecords: [mastery(record.id)]
  }), userId);

  const overwritten = overwriteVocabSnapshot(userId, incoming, cloud, false);

  assert.deepEqual(overwritten.masteryRecords, cloud.masteryRecords);
});

test("keeps local mastery when merging with a legacy cloud snapshot that has no mastery field", () => {
  const record = wrongRecord("alpha");
  const cloud = parseVocabSnapshot(snapshot([record]), userId);
  const local = parseVocabSnapshot(snapshot([record], {
    clientId: "device-local",
    learningSchemaVersion: 1,
    masteryRecords: [mastery(record.id, { reviewCount: 6 })]
  }), userId);

  const merged = mergeVocabSnapshots(userId, cloud, local);

  assert.deepEqual(merged.masteryRecords, local.masteryRecords);
});

test("rejects unknown schema versions and malformed snapshot data", () => {
  assert.throws(
    () => parseVocabSnapshot(snapshot([], { schemaVersion: 99 }), userId),
    (error) => error.code === "UNSUPPORTED_VERSION" && error.status === 400
  );
  assert.throws(
    () => parseVocabSnapshot(snapshot([{ ...wrongRecord("alpha"), wrongAttempts: [{ id: "", createdAt: "bad" }] }]), userId),
    (error) => error.code === "INVALID_WRONGBOOK" && error.status === 400
  );
  assert.throws(
    () => parseVocabSnapshot(snapshot([wrongRecord("alpha")], {
      learningSchemaVersion: 1,
      masteryRecords: [{ ...mastery("unit:alpha"), reviewCount: -1 }]
    }), userId),
    (error) => error.code === "INVALID_MASTERY" && error.status === 400
  );
  assert.throws(
    () => parseVocabSnapshot(snapshot([{
      id: "unit:alpha",
      word: "alpha",
      sourceName: "unit",
      wrongCount: 1_000_000_000,
      createdAt: firstDay,
      updatedAt: firstDay
    }]), userId),
    (error) => error.code === "SNAPSHOT_TOO_LARGE" && error.status === 413
  );
  assert.throws(
    () => parseVocabSnapshot(snapshot([{
      id: "unit:alpha",
      word: "alpha",
      sourceName: "unit",
      wrongCount: -1,
      createdAt: firstDay,
      updatedAt: firstDay
    }]), userId),
    (error) => error.code === "INVALID_WRONGBOOK" && error.status === 400
  );
});

test("deduplicates the same observed wrong-answer event across devices", () => {
  const sharedAttempt = attempt("event-shared", firstDay, "device-a");
  const left = snapshot([wrongRecord("alpha", [sharedAttempt])]);
  const right = snapshot([wrongRecord("alpha", [{ ...sharedAttempt, clientId: "device-b" }])], { clientId: "device-b" });

  const merged = mergeVocabSnapshots(userId, parseVocabSnapshot(left, userId), parseVocabSnapshot(right, userId));

  assert.equal(merged.records.length, 1);
  assert.deepEqual(merged.records[0].wrongAttempts.map((value) => value.id), ["event-shared"]);
});

test("resolves equal-time mastery records deterministically regardless of merge order", () => {
  const record = wrongRecord("alpha");
  const sharedWrongbook = [record];
  const first = parseVocabSnapshot(snapshot(sharedWrongbook, {
    learningSchemaVersion: 1,
    masteryRecords: [mastery(record.id, { level: "learning", reviewCount: 2, correctStreak: 1 })]
  }), userId);
  const second = parseVocabSnapshot(snapshot(sharedWrongbook, {
    clientId: "device-b",
    learningSchemaVersion: 1,
    masteryRecords: [mastery(record.id, { reviewCount: 7, correctStreak: 3, level: "mastered" })]
  }), userId);

  const forward = mergeVocabSnapshots(userId, first, second);
  const reverse = mergeVocabSnapshots(userId, second, first);

  assert.deepEqual(forward.masteryRecords, reverse.masteryRecords);
  assert.equal(forward.masteryRecords[0].reviewCount, 7);
  assert.equal(forward.masteryRecords[0].level, "mastered");
});

test("takes the newer whole mastery record without adding counters from devices", () => {
  const record = wrongRecord("alpha");
  const older = parseVocabSnapshot(snapshot([record], {
    learningSchemaVersion: 1,
    masteryRecords: [mastery(record.id, { reviewCount: 9, correctStreak: 3, updatedAt: firstDay })]
  }), userId);
  const newer = parseVocabSnapshot(snapshot([record], {
    clientId: "device-b",
    learningSchemaVersion: 1,
    masteryRecords: [mastery(record.id, { reviewCount: 2, correctStreak: 1, updatedAt: secondDay })]
  }), userId);

  const merged = mergeVocabSnapshots(userId, older, newer);

  assert.equal(merged.masteryRecords[0].reviewCount, 2);
  assert.equal(merged.masteryRecords[0].correctStreak, 1);
  assert.equal(merged.masteryRecords[0].updatedAt, secondDay);
});

test("does not revive mastery tied to wrong-answer events removed before the word was re-added", () => {
  const oldRecord = wrongRecord("alpha", [attempt("attempt-old", firstDay, "device-a")]);
  const removedThenReadded = snapshot([
    wrongRecord("alpha", [attempt("attempt-new", secondDay, "device-b")])
  ], {
    clientId: "device-b",
    deletedRecords: [{
      id: oldRecord.id,
      canonicalRecordId: oldRecord.id,
      clientId: "device-b",
      deletedAt: secondDay,
      deletedAttemptIds: ["attempt-old"]
    }]
  });
  const oldDevice = parseVocabSnapshot(snapshot([oldRecord], {
    learningSchemaVersion: 1,
    masteryRecords: [mastery(oldRecord.id, { wrongAttemptIds: ["attempt-old"] })]
  }), userId);
  const newDevice = parseVocabSnapshot(removedThenReadded, userId);

  const merged = mergeVocabSnapshots(userId, oldDevice, newDevice);

  assert.deepEqual(merged.records[0].wrongAttempts.map((value) => value.id), ["attempt-new"]);
  assert.deepEqual(merged.masteryRecords, []);
});

test("ignores future-dated stale mastery after its observed attempt was deleted in a new learning cycle", () => {
  const recordId = wrongBookRecordId({ sourceName: "unit", word: "alpha" });
  const staleRecord = wrongRecord("alpha", [attempt("attempt-old", firstDay, "device-a")]);
  const currentRecord = wrongRecord("alpha", [attempt("attempt-new", secondDay, "device-b")]);
  const staleDevice = parseVocabSnapshot(snapshot([staleRecord], {
    clientId: "device-a",
    learningSchemaVersion: 1,
    masteryRecords: [mastery(recordId, {
      reviewCount: 99,
      updatedAt: "2099-01-01T00:00:00.000Z",
      wrongAttemptIds: ["attempt-old"]
    })]
  }), userId);
  const currentDevice = parseVocabSnapshot(snapshot([currentRecord], {
    clientId: "device-b",
    learningSchemaVersion: 1,
    deletedRecords: [{
      id: recordId,
      canonicalRecordId: recordId,
      clientId: "device-b",
      deletedAt: secondDay,
      deletedAttemptIds: ["attempt-old"]
    }],
    masteryRecords: [mastery(recordId, {
      reviewCount: 2,
      updatedAt: secondDay,
      wrongAttemptIds: ["attempt-new"]
    })]
  }), userId);

  const merged = mergeVocabSnapshots(userId, staleDevice, currentDevice);

  assert.deepEqual(merged.records[0].wrongAttempts.map((value) => value.id), ["attempt-new"]);
  assert.equal(merged.masteryRecords.length, 1);
  assert.equal(merged.masteryRecords[0].reviewCount, 2);
  assert.deepEqual(merged.masteryRecords[0].wrongAttemptIds, ["attempt-new"]);
});

test("migrates mastery keyed by a legacy word id to the canonical tuple id", () => {
  const sourceName = "book:junior";
  const word = "alpha:beta";
  const legacyId = `${sourceName}:${word}`;
  const canonicalId = wrongBookRecordId({ sourceName, word });
  assert.notEqual(legacyId, canonicalId);

  const parsed = parseVocabSnapshot(snapshot([{
    id: legacyId,
    word,
    sourceName,
    wrongCount: 1,
    wrongAttempts: [attempt("attempt-legacy")],
    createdAt: firstDay,
    updatedAt: firstDay
  }], {
    learningSchemaVersion: 1,
    masteryRecords: [mastery(legacyId, { wrongAttemptIds: undefined })]
  }), userId);

  assert.equal(parsed.masteryRecords.length, 1);
  assert.equal(parsed.masteryRecords[0].id, canonicalId);
  assert.deepEqual(parsed.masteryRecords[0].wrongAttemptIds, ["attempt-legacy"]);
});
