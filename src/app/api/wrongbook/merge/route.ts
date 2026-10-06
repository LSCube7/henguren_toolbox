import { getCurrentUser } from "@/lib/session";
import { saveVocabSnapshot } from "@/lib/vocab-sync-store";
import { accountVocabStore, readSyncRequest, syncErrorResponse, syncResponse } from "@/lib/server-vocab-sync";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return syncResponse({ error: "UNAUTHORIZED" }, 401);
  if (request.headers.has("X-Sync-User") && request.headers.get("X-Sync-User") !== user.id) return syncResponse({ error: "TARGET_CHANGED" }, 409);
  try {
    return syncResponse(await saveVocabSnapshot(accountVocabStore(user.id), user.id, await readSyncRequest(request), "merge"));
  } catch (error) { return syncErrorResponse(error); }
}
