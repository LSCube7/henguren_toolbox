"use client";

import { useState, type FormEvent } from "react";
import { useLearningSync } from "@/lib/client-auto-sync";
import { useSnackbar } from "./Snackbar";
import { useI18n } from "../i18n/AppI18nProvider";
import type { MessageKey } from "@/i18n/config";

type AutoStatus = "idle" | "pending" | "syncing" | "synced" | "offline" | "signed-out" | "error";

const statusLabels: Record<AutoStatus, MessageKey> = {
  idle: "sync.auto.disabled",
  pending: "sync.pending",
  syncing: "sync.syncing",
  synced: "sync.synced",
  offline: "sync.offline",
  "signed-out": "sync.signedOut",
  error: "sync.auto.error"
};

function errorCode(error: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? error.code
    : error instanceof Error ? error.message : "SYNC_FAILED";
  return typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code) ? code : "SYNC_FAILED";
}

function checkedFrom(event: FormEvent<HTMLElement>) {
  const target = event.currentTarget as HTMLElement & { checked?: boolean; selected?: boolean };
  return Boolean(target.selected ?? target.checked);
}

export function LearningAutoSyncControls({ compact = false, showStatus = true }: { compact?: boolean; showStatus?: boolean }) {
  const sync = useLearningSync();
  const { locale, t } = useI18n();
  const { showSnackbar } = useSnackbar();
  const [changing, setChanging] = useState(false);
  const canEnable = sync.summary?.source === "account"
    && Boolean(sync.summary.user)
    && (sync.summary.status === "ready" || sync.summary.status === "synced");
  const status: AutoStatus = sync.status === "idle"
    ? sync.summary?.status === "signed-out" || sync.summary?.status === "offline" || sync.summary?.status === "error"
      ? sync.summary.status
      : "idle"
    : sync.status;
  const statusText = status === "error"
    ? t(statusLabels.error, { code: sync.error ?? "SYNC_FAILED" })
    : t(statusLabels[status]);
  const disabled = changing || (!sync.enabled && (!canEnable || sync.busy));

  async function updateEnabled(enabled: boolean) {
    setChanging(true);
    try {
      await sync.setEnabled(enabled);
    } catch (error) {
      showSnackbar(t("sync.auto.toggleError", { code: errorCode(error) }), "error");
    } finally {
      setChanging(false);
    }
  }

  return (
    <div className="stack">
      <label className="switch-field">
        <md-switch
          data-aria-label={t("sync.auto.title")}
          selected={sync.enabled}

          disabled={disabled}
          onInput={(event) => void updateEnabled(checkedFrom(event))}
        />
        <span>{t(compact ? "sync.panel.auto" : "sync.auto.title")}</span>
      </label>
      {!compact ? <p className="helper-text">{t("sync.auto.description")}</p> : null}
      {showStatus ? <p className="helper-text" role="status" aria-live="polite" lang={locale}>{statusText}</p> : null}
    </div>
  );
}