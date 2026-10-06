import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { saveVocabSnapshot, isConditionalConflict } from "../src/lib/vocab-sync-store.ts";
import { learningContentKey } from "../src/lib/learning-content.ts";
import { parseVocabSnapshot } from "../src/lib/vocab-sync.ts";

// Opt in with a separate test bucket. Never fall back to the application's bucket.
const required = ["R2_TEST_ACCOUNT_ID", "R2_TEST_ACCESS_KEY_ID", "R2_TEST_SECRET_ACCESS_KEY", "R2_TEST_BUCKET_NAME"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing ${name}; configure an isolated R2 test bucket.`);
}
const bucket = process.env.R2_TEST_BUCKET_NAME;
assert.notEqual(bucket, process.env.R2_BUCKET_NAME, "The test bucket must differ from the application bucket");
process.env.R2_ACCOUNT_ID = process.env.R2_TEST_ACCOUNT_ID;
process.env.R2_ACCESS_KEY_ID = process.env.R2_TEST_ACCESS_KEY_ID;
process.env.R2_SECRET_ACCESS_KEY = process.env.R2_TEST_SECRET_ACCESS_KEY;
process.env.R2_BUCKET_NAME = bucket;
const { readVersionedJsonFromR2, headObjectVersionFromR2, writeJsonToR2, wrongBookKey, wrongBookBackupKey } = await import("../src/lib/r2.ts");
const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  maxAttempts: 3
});
const userId = `integration-${randomUUID()}`;
const currentKey = wrongBookKey(userId);
const keys = new Set();
let stage = "missing-object";
let failed = false;
let routeServer;
let writes = 0;
let backupWrites = 0;
const day = "2026-01-01T00:00:00.000Z";
function payload(word, device = word) {
  return parseVocabSnapshot({
    schemaVersion: 2, userId, clientId: device, updatedAt: day,
    records: [{ id: `unit:${word}`, sourceName: "unit", word, wrongCount: 1, definitions: ["integration fixture"], wrongAttempts: [{ id: `attempt-${device}`, clientId: device, createdAt: day }], createdAt: day, updatedAt: day }],
    deletedRecords: [], deletedBatches: [], learningSchemaVersion: 1,
    masteryRecords: [{ id: `unit:${word}`, level: "reviewing", correctStreak: 1, reviewCount: 1, lastReviewedAt: day, nextReviewAt: day, updatedAt: day, wrongAttemptIds: [`attempt-${device}`] }]
  }, userId);
}
async function write(key, value, version) {
  assert.ok(key.startsWith(`wrongbooks/${userId}/`), "Refuse to write outside this run");
  keys.add(key); // Include a request whose response could have been lost.
  return writeJsonToR2(key, value, version);
}
function store({ barrier, failBackup } = {}) {
  return {
    async read() {
      const current = await readVersionedJsonFromR2(currentKey);
      if (barrier) await barrier();
      return current;
    },
    async write(snapshot, version) { writes++; await write(currentKey, snapshot, version); },
    async backup(snapshot, id) {
      backupWrites++;
      const key = failBackup?.(id) ? wrongBookBackupKey(userId, "occupied") : wrongBookBackupKey(userId, id);
      await write(key, snapshot, null);
    }
  };
}
async function unchanged(version) {
  assert.equal(await headObjectVersionFromR2(currentKey), version);
}
try {
  assert.equal(await headObjectVersionFromR2(currentKey), null);
  assert.deepEqual(await readVersionedJsonFromR2(currentKey), { value: null, etag: null });
  stage = "conditional-create";
  const alpha = payload("alpha");
  const firstVersion = await write(currentKey, alpha, null);
  assert.ok(firstVersion);
  assert.equal(await headObjectVersionFromR2(currentKey), firstVersion);
  await assert.rejects(write(currentKey, payload("rejected"), null), isConditionalConflict);
  await unchanged(firstVersion);
  stage = "conditional-update";
  const secondVersion = await write(currentKey, payload("beta"), firstVersion);
  assert.notEqual(secondVersion, firstVersion);
  await assert.rejects(write(currentKey, alpha, firstVersion), isConditionalConflict);
  await unchanged(secondVersion);

  stage = "merge-and-backups";
  const backupStart = new Set(keys);
  const merged = await saveVocabSnapshot(store(), userId, alpha, "merge");
  assert.deepEqual(merged.records.map(r => r.word).sort(), ["alpha", "beta"]);
  assert.equal(merged.masteryRecords.length, 2);
  const backupKeys = [...keys].filter(key => !backupStart.has(key));
  assert.equal(backupKeys.length, 2);
  const beforeBackup = await readVersionedJsonFromR2(backupKeys.find(key => key.endsWith("-before.json")));
  assert.deepEqual(beforeBackup.value.records.map(r => r.word), ["beta"]);
  const candidateBackup = await readVersionedJsonFromR2(backupKeys.find(key => key.endsWith("-candidate.json")));
  assert.deepEqual(candidateBackup.value, JSON.parse(JSON.stringify(merged)));
  const mergedVersion = await headObjectVersionFromR2(currentKey);
  stage = "unchanged-merge";
  const beforeNoop = { writes, backupWrites };
  await saveVocabSnapshot(store(), userId, alpha, "merge");
  assert.deepEqual({ writes, backupWrites }, beforeNoop);
  await unchanged(mergedVersion);
  stage = "stale-overwrite";
  await assert.rejects(saveVocabSnapshot(store(), userId, payload("rejected"), "overwrite", firstVersion), e => e.code === "SYNC_CONFLICT");
  await unchanged(mergedVersion);

  // Cause a real R2 conditional rejection at each backup stage, without changing permissions.
  await write(wrongBookBackupKey(userId, "occupied"), { fixture: true }, null);
  for (const suffix of ["-before", "-candidate"]) {
    stage = `backup-failure${suffix}`;
    await assert.rejects(saveVocabSnapshot(store({ failBackup: id => id.endsWith(suffix) }), userId, payload("rejected"), "overwrite", mergedVersion), e => e.code === "BACKUP_FAILED");
    await unchanged(mergedVersion);
  }
  stage = "concurrent-merge";
  let initialReads = 0;
  let release;
  const bothRead = new Promise(resolve => { release = resolve; });
  const barrier = async () => {
    if (++initialReads > 2) return;
    if (initialReads === 2) release();
    await bothRead;
  };
  await Promise.all([
    saveVocabSnapshot(store({ barrier }), userId, payload("gamma", "device-a"), "merge"),
    saveVocabSnapshot(store({ barrier }), userId, payload("delta", "device-b"), "merge")
  ]);
  const final = await readVersionedJsonFromR2(currentKey);
  assert.deepEqual(final.value.records.map(r => r.word).sort(), ["alpha", "beta", "delta", "gamma"]);
  assert.equal(final.value.masteryRecords.length, 4);
  assert.ok(initialReads >= 3, "A competing write must re-read and merge after the conflict");
  assert.equal(await headObjectVersionFromR2(currentKey), final.etag);
  stage = "local-api-routes";
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const secret = randomUUID() + randomUUID();
  routeServer = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    windowsHide: true, stdio: "ignore", env: { ...process.env, SESSION_SECRET: secret }
  });
  let launchError;
  routeServer.on("error", error => { launchError = error; });
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError || routeServer.exitCode !== null) throw new Error("LOCAL_TEST_SERVER_FAILED");
    try { ready = (await fetch(origin + "/api/me", { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Wait for the isolated server to listen. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, "The production build must be available for local API validation");
  const { createSignedSessionToken } = await import("../src/lib/session-token.ts");
  const token = await createSignedSessionToken({ id: userId, name: "Integration fixture" }, secret);
  const headers = { Cookie: `henguren_session=${token}`, "X-Sync-User": userId, "Content-Type": "application/json" };
  assert.equal((await fetch(origin + "/api/wrongbook")).status, 401);
  const versionResponse = await fetch(origin + "/api/wrongbook?versionOnly=1", { headers });
  assert.equal(versionResponse.status, 200);
  assert.equal((await versionResponse.json()).version, final.etag);
  assert.equal(versionResponse.headers.get("X-Sync-Version"), final.etag);
  assert.match(versionResponse.headers.get("Cache-Control"), /no-store/);
  const targetResponse = await fetch(origin + "/api/wrongbook/merge", { method: "POST", headers: { ...headers, "X-Sync-User": "different-fixture" }, body: JSON.stringify(alpha) });
  assert.equal(targetResponse.status, 409);
  assert.equal((await targetResponse.json()).error, "TARGET_CHANGED");
  const staleResponse = await fetch(origin + "/api/wrongbook", { method: "PUT", headers: { ...headers, "X-Sync-Version": firstVersion }, body: JSON.stringify(alpha) });
  assert.equal(staleResponse.status, 409);
  assert.equal((await staleResponse.json()).error, "SYNC_CONFLICT");
  await unchanged(final.etag);
  const routeMerge = await fetch(origin + "/api/wrongbook/merge", { method: "POST", headers, body: JSON.stringify(payload("epsilon")) });
  assert.equal(routeMerge.status, 200);
  const routeSnapshot = await routeMerge.json();
  assert.equal(routeSnapshot.records.length, 5);
  assert.equal(routeSnapshot.masteryRecords.length, 5);
  const routeVersion = routeMerge.headers.get("X-Sync-Version");
  assert.equal(await headObjectVersionFromR2(currentKey), routeVersion);
  const pullResponse = await fetch(origin + "/api/wrongbook", { headers });
  assert.equal(pullResponse.status, 200);
  // GET normalizes snapshot envelope timestamps; learning content and ETag must match.
  const pulled = await pullResponse.json();
  assert.equal(learningContentKey(pulled), learningContentKey(routeSnapshot));
  assert.equal(pulled.userId, userId);
  assert.equal(pullResponse.headers.get("X-Sync-Version"), routeVersion);
  const overwriteResponse = await fetch(origin + "/api/wrongbook", { method: "PUT", headers: { ...headers, "X-Sync-Version": routeVersion }, body: JSON.stringify(alpha) });
  assert.equal(overwriteResponse.status, 200);
  assert.deepEqual((await overwriteResponse.json()).records.map(r => r.word), ["alpha"]);
  console.log("PASS local production API: signed fixture session, unauthorized/target guards, version-only, GET, merge, overwrite and stale overwrite");
  console.log("PASS R2: HEAD/GET versions, conditional create/update, backups, unchanged merge, stale overwrite, backup failures and concurrent learning merge");
} catch (error) {
  failed = true;
  // Do not log SDK messages, endpoints, credentials or response bodies.
  console.error(JSON.stringify({ result: "FAIL", stage, code: error.name, status: error.$metadata?.httpStatusCode, assertion: error.name === "AssertionError" ? error.stack.split("\n").find(line => line.includes("verify-r2-sync.mjs"))?.trim() : undefined }));
} finally {
  if (routeServer && routeServer.exitCode === null) {
    const closed = once(routeServer, "exit"); routeServer.kill(); await closed;
  }
  // Also find server-generated backups, scoped strictly to this run's random fixture ID.
  try {
    let continuation;
    do {
      const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `wrongbooks/${userId}/`, ContinuationToken: continuation }), { abortSignal: AbortSignal.timeout(30000) });
      for (const object of page.Contents ?? []) {
        assert.ok(object.Key.startsWith(`wrongbooks/${userId}/`)); keys.add(object.Key);
      }
      continuation = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuation);
  } catch (error) {
    failed = true;
    console.error(JSON.stringify({ result: "CLEANUP_LIST_FAILED", code: error.name, status: error.$metadata?.httpStatusCode }));
  }
  const failures = [];
  for (const Key of keys) {
    try { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key }), { abortSignal: AbortSignal.timeout(30000) }); }
    catch (error) { failures.push({ code: error.name, status: error.$metadata?.httpStatusCode }); }
  }
  if (failures.length) {
    failed = true;
    console.error(JSON.stringify({ result: "CLEANUP_FAILED", testUserId: userId, remainingObjects: failures.length, errors: failures }));
  } else {
    try {
      const remaining = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `wrongbooks/${userId}/`, MaxKeys: 1 }), { abortSignal: AbortSignal.timeout(30000) });
      assert.equal(remaining.KeyCount ?? 0, 0);
      console.log("PASS cleanup: test account prefix is empty; unrelated objects untouched");
    } catch (error) {
      failed = true;
      console.error(JSON.stringify({ result: "CLEANUP_VERIFY_FAILED", testUserId: userId, code: error.name }));
    }
  }
  client.destroy();
  if (failed) process.exitCode = 1;
}
