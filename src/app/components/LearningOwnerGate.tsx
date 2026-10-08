"use client";
import { M3eButton } from "@m3e/react/button";

import { createContext, useContext, useEffect, useState } from "react";
import { initializeLearningStorage, learningOwnerEventKey, observeAuthenticatedLearningUser } from "@/lib/client-learning-storage";
import { startLearningAutoSync } from "@/lib/client-auto-sync";
import { isOnline } from "@/lib/offline-cache";
import { useI18n } from "../i18n/AppI18nProvider";

type OwnerStatus = "loading" | "ready" | "error";
const LearningOwnerContext = createContext<OwnerStatus>("loading");

export function LearningOwnerProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<OwnerStatus>("loading");
  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        await initializeLearningStorage();
        if (isOnline()) {
          let userId: string | undefined;
          try {
            const response = await fetch("/api/me", { cache: "no-store", signal: AbortSignal.timeout(4000) });
            if (response.ok) {
              const data: unknown = await response.json();
              if (data && typeof data === "object" && "authenticated" in data && data.authenticated === true && "user" in data &&
                data.user && typeof data.user === "object" && "id" in data.user && typeof data.user.id === "string") {
                userId = data.user.id;
              }
            }
          } catch {
            // A failed identity request is not an instruction to clear local data.
          }
          if (userId && await observeAuthenticatedLearningUser(userId)) { window.location.reload(); return; }
        }
        if (active) setStatus("ready");
      } catch { if (active) setStatus("error"); }
    }
    const reload = () => window.location.reload();
    const storageChanged = (event: StorageEvent) => { if (event.key === learningOwnerEventKey) reload(); };
    window.addEventListener("storage", storageChanged);
    window.addEventListener(learningOwnerEventKey, reload);
    void initialize();
    return () => { active = false; window.removeEventListener("storage", storageChanged); window.removeEventListener(learningOwnerEventKey, reload); };
  }, []);
  useEffect(() => { if (status === "ready") return startLearningAutoSync(); }, [status]);
  return <LearningOwnerContext.Provider value={status}>{children}</LearningOwnerContext.Provider>;
}

export function LearningOwnerGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const status = useContext(LearningOwnerContext);
  if (status === "loading") return <div role="status">{t("user.localOwner.loading")}</div>;
  if (status === "error") return <div role="alert">{t("user.localOwner.error")} <M3eButton variant="outlined" onClick={() => window.location.reload()}>{t("common.refresh")}</M3eButton></div>;
  return children;
}
