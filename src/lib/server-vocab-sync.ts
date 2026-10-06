import { NextResponse } from "next/server";
import { readVersionedJsonFromR2, writeJsonToR2, wrongBookBackupKey, wrongBookKey } from "./r2";
import { maxSyncBytes, SyncOperationError } from "./vocab-sync";
import type { VocabSnapshotStore } from "./vocab-sync-store";

export function accountVocabStore(userId: string): VocabSnapshotStore {
  return {
    read: () => readVersionedJsonFromR2(wrongBookKey(userId)),
    write: (snapshot, etag) => writeJsonToR2(wrongBookKey(userId), snapshot, etag),
    backup: (snapshot, id) => writeJsonToR2(wrongBookBackupKey(userId, id), snapshot, null)
  };
}

export async function readSyncRequest(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxSyncBytes) throw new SyncOperationError("SNAPSHOT_TOO_LARGE", 413);
  if (!request.body) throw new SyncOperationError("INVALID_JSON", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxSyncBytes) {
        await reader.cancel();
        throw new SyncOperationError("SNAPSHOT_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.length; });
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new SyncOperationError("INVALID_JSON", 400); }
}

export function syncResponse(body: unknown, status = 200, version?: string | null) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store",
    ...(version !== undefined ? { "X-Sync-Version": version ?? "missing" } : {})
  } });
}

export function syncErrorResponse(error: unknown) {
  // Never return SDK messages, credentials or storage response bodies.
  return syncResponse({ error: error instanceof SyncOperationError ? error.code : "CLOUD_UNAVAILABLE" }, error instanceof SyncOperationError ? error.status : 503);
}
