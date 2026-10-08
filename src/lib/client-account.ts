"use client";
import { stopLearningSync, resumeLearningSync } from "./client-auto-sync";
import { changeLearningOwner, currentLearningOwner } from "./client-learning-storage";
import { guestLearningOwner } from "./learning-ownership";
import { isOnline } from "./offline-cache";

let logoutRequest: Promise<void> | undefined;
export function logoutAccount(fallbackUserId?: string): Promise<void> {
  if (logoutRequest) return logoutRequest;
  if (!isOnline()) return Promise.reject(new Error("OFFLINE"));
  logoutRequest = (async () => {
    stopLearningSync();
    try {
      const owner = currentLearningOwner();
      const ownerUserId: unknown = owner.startsWith("account:") ? JSON.parse(owner.slice("account:".length)) : undefined;
      const expectedUserId = typeof ownerUserId === "string" ? ownerUserId : fallbackUserId;
      const response = await fetch("/api/auth/logout", { method: "POST", cache: "no-store", signal: AbortSignal.timeout(30000), headers: expectedUserId ? { "X-Sync-User": expectedUserId } : {} });
      if (!response.ok) throw new Error("LOGOUT_FAILED");
      await changeLearningOwner(guestLearningOwner, true);
      window.location.reload();
    } catch (error) { resumeLearningSync(); throw error; }
    finally { logoutRequest = undefined; }
  })();
  return logoutRequest;
}
