import { getCurrentUser } from "@/lib/session";
import { emptyWrongBook } from "@/lib/wrongbook";
import { parseVocabSnapshot } from "@/lib/vocab-sync";
import { saveVocabSnapshot } from "@/lib/vocab-sync-store";
import { accountVocabStore, readAccountVocabVersion, readSyncRequest, syncErrorResponse, syncResponse } from "@/lib/server-vocab-sync";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return syncResponse({ error: "UNAUTHORIZED" }, 401);
  if (request.headers.has("X-Sync-User") && request.headers.get("X-Sync-User") !== user.id) return syncResponse({ error: "TARGET_CHANGED" }, 409);
  try {
    if (new URL(request.url).searchParams.get("versionOnly") === "1") {
      const version = await readAccountVocabVersion(user.id);
      return syncResponse({ version: version ?? "missing" }, 200, version);
    }
    const stored = await accountVocabStore(user.id).read();
    return syncResponse(parseVocabSnapshot(stored.value ?? emptyWrongBook(user.id), user.id), 200, stored.etag);
  } catch (error) { return syncErrorResponse(error); }
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return syncResponse({ error: "UNAUTHORIZED" }, 401);
  if (request.headers.has("X-Sync-User") && request.headers.get("X-Sync-User") !== user.id) return syncResponse({ error: "TARGET_CHANGED" }, 409);
  try {
    const header = request.headers.get("X-Sync-Version");
    const expected = header === "missing" ? null : header ?? undefined;
    const store = accountVocabStore(user.id);
    const snapshot = await saveVocabSnapshot(store, user.id, await readSyncRequest(request), "overwrite", expected);
    return syncResponse(snapshot, 200, store.getVersion?.() ?? null);
  } catch (error) { return syncErrorResponse(error); }
}
