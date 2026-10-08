import assert from "node:assert/strict";
import test from "node:test";
import { saveVocabSnapshot } from "./vocab-sync-store.ts";
import { learningContentKey } from "./learning-content.ts";
import { readHeadObjectVersion } from "./r2.ts";
import { wrongBookRecordId } from "./wrongbook.ts";

const userId = "test-user";
const firstDay = "2026-01-01T00:00:00.000Z";
const secondDay = "2026-01-02T00:00:00.000Z";

function record(word, attemptId = `attempt-${word}`, clientId = "device-a", createdAt = firstDay) {
  return {
    id: wrongBookRecordId({ sourceName: "unit", word }),
    word,
    sourceName: "unit",
    wrongCount: 1,
    wrongAttempts: [{ id: attemptId, clientId, createdAt }],
    createdAt: firstDay,
    updatedAt: createdAt
  };
}

function payload(records, clientId = "device-a") {
  return {
    schemaVersion: 2,
    userId,
    clientId,
    updatedAt: firstDay,
    records,
    deletedRecords: [],
    deletedBatches: []
  };
}

function conditionalConflict() {
  const error = new Error("stale object version");
  error.name = "PreconditionFailed";
  error.$metadata = { httpStatusCode: 412 };
  return error;
}

function createStore(initialValue = null, options = {}) {
  let currentValue = structuredClone(initialValue);
  let currentEtag = initialValue === null ? null : "etag-0";
  let generatedVersion = 0;
  let reads = 0;
  let writes = 0;
  let initialReadCount = 0;
  let releaseInitialReads;
  const initialReadsReady = options.initialReadBarrier
    ? new Promise((resolve) => { releaseInitialReads = resolve; })
    : null;
  const backups = [];
  const successfulWrites = [];

  return {
    async read() {
      reads += 1;
      const observed = { value: structuredClone(currentValue), etag: currentEtag };
      if (initialReadsReady && initialReadCount < options.initialReadBarrier) {
        initialReadCount += 1;
        if (initialReadCount === options.initialReadBarrier) releaseInitialReads();
        await initialReadsReady;
      }
      return observed;
    },
    async backup(value, id) {
      backups.push({ value: structuredClone(value), id });
      if (options.failBackup?.(value, id)) throw new Error("backup unavailable");
    },
    async write(value, expectedEtag) {
      writes += 1;
      if (options.alwaysConflict) throw conditionalConflict();
      if (expectedEtag !== currentEtag) throw conditionalConflict();
      currentValue = structuredClone(value);
      currentEtag = `etag-${++generatedVersion}`;
      successfulWrites.push({ value: structuredClone(value), expectedEtag });
    },
    state() {
      return {
        value: structuredClone(currentValue),
        etag: currentEtag,
        reads,
        writes,
        backups: structuredClone(backups),
        successfulWrites: structuredClone(successfulWrites)
      };
    }
  };
}

async function expectSyncError(promise, code, status) {
  await assert.rejects(promise, (error) => error.code === code && error.status === status);
}

test("retries a concurrent first write and preserves both devices' new words", async () => {
  const store = createStore(null, { initialReadBarrier: 2 });

  await Promise.all([
    saveVocabSnapshot(store, userId, payload([record("alpha")], "device-a"), "merge"),
    saveVocabSnapshot(store, userId, payload([record("beta", "attempt-beta", "device-b")], "device-b"), "merge")
  ]);

  const savedWords = store.state().value.records.map((item) => item.word).sort();
  assert.deepEqual(savedWords, ["alpha", "beta"]);
  assert.equal(store.state().successfulWrites.length, 2);
});

test("merges two concurrent device updates with the already saved snapshot", async () => {
  const baseline = payload([record("base")], "device-base");
  const store = createStore(baseline, { initialReadBarrier: 2 });
  const deviceA = payload([record("base"), record("alpha", "attempt-alpha", "device-a", secondDay)], "device-a");
  const deviceB = payload([record("base"), record("beta", "attempt-beta", "device-b", secondDay)], "device-b");

  await Promise.all([
    saveVocabSnapshot(store, userId, deviceA, "merge"),
    saveVocabSnapshot(store, userId, deviceB, "merge")
  ]);

  const saved = store.state().value;
  assert.deepEqual(saved.records.map((item) => item.word).sort(), ["alpha", "base", "beta"]);
  assert.deepEqual(saved.records.find((item) => item.word === "base").wrongAttempts.map((item) => item.id), ["attempt-base"]);
  assert.equal(store.state().successfulWrites.length, 2);
});

test("skips merge writes when learning content is unchanged", async () => {
  const current = { ...payload([record("alpha")], "device-cloud"), revision: "saved-revision" };
  const incoming = { ...payload([record("alpha")], "device-local"), updatedAt: secondDay, revision: "local-revision" };
  const store = createStore(current);

  await saveVocabSnapshot(store, userId, incoming, "merge");

  assert.deepEqual(store.state().value, current);
  assert.equal(store.state().writes, 0);
  assert.equal(store.state().backups.length, 0);
});

test("still writes an empty snapshot when no cloud snapshot exists", async () => {
  const store = createStore(null);

  await saveVocabSnapshot(store, userId, payload([]), "merge");

  assert.deepEqual(store.state().value.records, []);
  assert.equal(store.state().writes, 1);
  assert.deepEqual(store.state().backups.map((backup) => backup.id.endsWith("-candidate")), [true]);
});

test("a changed learning event timestamp is a real merge change", async () => {
  const cloudRecord = record("alpha", "attempt-alpha", "device-cloud");
  const incomingRecord = record("alpha", "attempt-alpha", "device-local", secondDay);
  incomingRecord.wrongAttempts[0].createdAt = secondDay;
  const store = createStore(payload([cloudRecord], "device-cloud"));

  await saveVocabSnapshot(store, userId, payload([incomingRecord], "device-local"), "merge");

  assert.equal(store.state().writes, 1);
  assert.equal(store.state().value.records[0].wrongAttempts[0].createdAt, secondDay);
});

test("learning content keys sort object keys and unordered collections without hiding event times", () => {
  const left = {
    records: [{ id: "a", wrongAttempts: [{ id: "event-1", createdAt: firstDay }, { id: "event-2", createdAt: secondDay }] }],
    masteryRecords: [{ id: "a", wrongAttemptIds: ["event-1", "event-2"] }]
  };
  const right = {
    masteryRecords: [{ wrongAttemptIds: ["event-2", "event-1"], id: "a" }],
    records: [{ wrongAttempts: [{ createdAt: secondDay, id: "event-2" }, { createdAt: firstDay, id: "event-1" }], id: "a" }]
  };

  assert.equal(learningContentKey(left), learningContentKey(right));
  assert.notEqual(learningContentKey(left), learningContentKey({
    ...right,
    records: [{ id: "a", wrongAttempts: [{ id: "event-1", createdAt: secondDay }, { id: "event-2", createdAt: secondDay }] }]
  }));
});

test("version lookup uses HeadObject and maps a missing object to no version", async () => {
  let command;
  const version = await readHeadObjectVersion(async (headCommand) => {
    command = headCommand;
    return { ETag: '"etag-7"' };
  }, "bucket", "wrongbooks/user/current.json");

  assert.equal(command.constructor.name, "HeadObjectCommand");
  assert.equal(command.input.Bucket, "bucket");
  assert.equal(command.input.Key, "wrongbooks/user/current.json");
  assert.equal(version, '"etag-7"');
  assert.equal(await readHeadObjectVersion(async () => {
    const error = new Error("missing");
    error.name = "NotFound";
    throw error;
  }, "bucket", "wrongbooks/user/current.json"), null);
});

test("stops after three failed conditional writes", async () => {
  const store = createStore(null, { alwaysConflict: true });

  await expectSyncError(saveVocabSnapshot(store, userId, payload([record("alpha")]), "merge"), "SYNC_CONFLICT", 409);

  assert.equal(store.state().reads, 3);
  assert.equal(store.state().writes, 3);
  assert.equal(store.state().successfulWrites.length, 0);
});

test("does not retry a destructive overwrite after a conditional conflict", async () => {
  const current = payload([record("cloud")], "device-cloud");
  const store = createStore(current, { alwaysConflict: true });

  await expectSyncError(saveVocabSnapshot(store, userId, payload([record("local")]), "overwrite"), "SYNC_CONFLICT", 409);

  assert.equal(store.state().reads, 1);
  assert.equal(store.state().writes, 1);
  assert.equal(store.state().successfulWrites.length, 0);
});

test("rejects an overwrite when its expected cloud version has expired", async () => {
  const store = createStore(payload([record("cloud")]), {});

  await expectSyncError(
    saveVocabSnapshot(store, userId, payload([record("local")]), "overwrite", "etag-stale"),
    "SYNC_CONFLICT",
    409
  );

  assert.equal(store.state().reads, 1);
  assert.equal(store.state().writes, 0);
  assert.equal(store.state().backups.length, 0);
});

test("does not change current when retaining the old snapshot or candidate backup fails", async () => {
  const current = payload([record("cloud")], "device-cloud");
  const store = createStore(current, { failBackup: () => true });

  await expectSyncError(saveVocabSnapshot(store, userId, payload([record("local")]), "overwrite"), "BACKUP_FAILED", 503);

  assert.deepEqual(store.state().value, current);
  assert.equal(store.state().writes, 0);
  assert.equal(store.state().backups.length, 1);
});

test("does not change current when the candidate backup fails after the old version was backed up", async () => {
  const current = payload([record("cloud")], "device-cloud");
  const store = createStore(current, {
    failBackup: (_value, id) => id.endsWith("-candidate")
  });

  await expectSyncError(saveVocabSnapshot(store, userId, payload([record("local")]), "overwrite"), "BACKUP_FAILED", 503);

  assert.deepEqual(store.state().value, current);
  assert.equal(store.state().writes, 0);
  assert.equal(store.state().backups.length, 2);
  assert.match(store.state().backups[0].id, /-before$/);
  assert.match(store.state().backups[1].id, /-candidate$/);
});

test("rejects an oversized merged candidate before backing it up or writing current", async () => {
  const cloud = payload([{
    ...record("alpha"),
    definitions: ["a".repeat(2_700_000)]
  }], "device-cloud");
  const incoming = payload([{
    ...record("alpha", "attempt-alpha-local", "device-local"),
    definitions: ["b".repeat(2_700_000)]
  }], "device-local");
  const store = createStore(cloud);

  await expectSyncError(saveVocabSnapshot(store, userId, incoming, "merge"), "SNAPSHOT_TOO_LARGE", 413);

  assert.deepEqual(store.state().value, cloud);
  assert.equal(store.state().backups.length, 0);
  assert.equal(store.state().writes, 0);
});

test("version lookup propagates service errors and rejects missing ETags", async () => {
  await assert.rejects(readHeadObjectVersion(async () => ({}), "bucket", "key"), /R2_INVALID_OBJECT/);
  const denied = new Error("AccessDenied");
  await assert.rejects(readHeadObjectVersion(async () => { throw denied; }, "bucket", "key"), (error) => error === denied);
});
