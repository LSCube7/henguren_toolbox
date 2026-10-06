import { getCurrentUser } from "@/lib/session";
import { emptyWrongBook } from "@/lib/wrongbook";
import { parseVocabSnapshot } from "@/lib/vocab-sync";
import { saveVocabSnapshot } from "@/lib/vocab-sync-store";
import { accountVocabStore, readSyncRequest, syncErrorResponse, syncResponse } from "@/lib/server-vocab-sync";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return syncResponse({ error: "UNAUTHORIZED" }, 401);
  if (request.headers.has("X-Sync-User") && request.headers.get("X-Sync-User") !== user.id) return syncResponse({ error: "TARGET_CHANGED" }, 409);
  try {
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
    const snapshot = await saveVocabSnapshot(accountVocabStore(user.id), user.id, await readSyncRequest(request), "overwrite", expected);
    return syncResponse(snapshot);
  } catch (error) { return syncErrorResponse(error); }
}
