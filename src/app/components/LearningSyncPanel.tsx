"use client";
import { Dialog as M3eDialog } from "./Dialog";

import { M3eButton } from "@m3e/react/button";

import { useState } from "react";
import type { MaterialSymbolName } from "@/generated/material-symbols";
import type { UserSession } from "@/lib/types";
import { useSnackbar } from "./Snackbar";
import { MaterialIcon } from "./MaterialIcon";
import { LearningAutoSyncControls } from "./LearningAutoSyncControls";
import { mergeUploadWrongBook, overwriteCloudWrongBook, pullAndMergeWrongBook, readWrongBookSyncSummary, type WrongBookSyncSummary } from "@/lib/client-sync";
import { useLearningSync } from "@/lib/client-auto-sync";
import { developerSyncSourceIdentity, readDeveloperSyncSource } from "@/lib/developer-sync-config";
import { isOnline } from "@/lib/offline-cache";
import { useI18n } from "../i18n/AppI18nProvider";
import type { MessageKey } from "@/i18n/config";
type SyncAction = "pull" | "overwrite" | "merge";
type OverwriteTarget = { identity: string; source: "account" | "custom"; name?: string; profileId?: string; version?: string };

function getOverwriteTarget(summary: WrongBookSyncSummary | null, fallbackUser: UserSession | null): OverwriteTarget | null {
  if (summary?.status !== "ready" && summary?.status !== "synced") return null;
  if (summary.source === "custom") {
    const source = readDeveloperSyncSource();
    return source ? { identity: developerSyncSourceIdentity(source), source: "custom", profileId: source.profileId, version: summary.cloudVersion } : null;
  }
  const account = summary.user ?? fallbackUser;
  return account ? { identity: `account:${account.id}`, source: "account", name: account.name, version: summary.cloudVersion } : null;
}

function syncErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) return "SYNC_FAILED";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code) ? code : "SYNC_FAILED";
}

function syncErrorMessageKey(error: unknown): MessageKey {
  switch (syncErrorCode(error)) {
    case "LOCAL_APPLY_FAILED": return "user.wrongbookSync.localApplyFailed";
    case "BACKUP_FAILED": return "user.wrongbookSync.backupFailed";
    case "SYNC_CONFLICT": return "user.wrongbookSync.conflict";
    case "UNAUTHORIZED": return "user.wrongbookSync.unauthorized";
    case "TARGET_CHANGED": return "user.wrongbookSync.targetChanged";
    case "OFFLINE": return "user.wrongbookSync.offline";
    default: return "user.wrongbookSync.error";
  }
}

const syncActionIcon: Record<SyncAction, MaterialSymbolName> = {
  pull: "cloud_download",
  overwrite: "cloud_upload",
  merge: "cloud_sync"
};

const syncActionLabel: Record<SyncAction, MessageKey> = {
  pull: "user.wrongbookSync.pulling",
  overwrite: "user.wrongbookSync.overwriting",
  merge: "user.wrongbookSync.merging"
};

function syncSummaryIcon(summary: WrongBookSyncSummary | null, user: UserSession | null): MaterialSymbolName {
  if (summary?.status === "signed-out") return "cloud_off";
  if (summary?.status === "offline") return "cloud_off";
  if (summary?.status === "error") return "cloud_alert";
  if (summary?.status === "synced") return "cloud_done";
  if (summary?.status === "ready" || (!summary && user)) return "cloud_sync";
  return "cloud_off";
}

function syncSummaryMessageKey(summary: WrongBookSyncSummary): MessageKey {
  if (summary.status === "offline") {
    if (summary.source === "custom") return "sync.panel.offline";
    return summary.unavailableReason === "server-unavailable" ? "sync.detail.serverUnavailable" : "sync.panel.offline";
  }
  if (summary.status === "error") {
    if (summary.source === "local") return "user.wrongbookSync.loadError";
    return summary.source === "custom" ? "sync.detail.customError" : "sync.detail.cloudError";
  }
  if (summary.status === "ready") {
    return "sync.ready";
  }
  if (summary.status === "synced") return "sync.synced";
  return "sync.panel.signedOut";
}

function syncSummaryLoadErrorKey(error: unknown): MessageKey {
  return error instanceof Error && error.message.includes("IDB_UPGRADE_BLOCKED")
    ? "user.wrongbookSync.loadBlocked"
    : "user.wrongbookSync.loadError";
}




export function LearningSyncPanel() {
  const sync = useLearningSync();
  const syncSummary = sync.summary;
  const user = syncSummary?.user ?? null;
  const syncing = sync.busy;
  const { locale, t } = useI18n();
  const { clearSnackbar, showSnackbar } = useSnackbar();
  const [syncAction, setSyncAction] = useState<SyncAction | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false);
  const [overwriteTarget, setOverwriteTarget] = useState<OverwriteTarget | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  async function refresh() {
    setRefreshing(true); setActionError(null);
    try { await sync.refresh(); }
    catch (error) { setActionError(t(syncSummaryLoadErrorKey(error))); }
    finally { setRefreshing(false); }
  }
  async function runSync(action: "pull" | "overwrite" | "merge", expectedTarget?: string, expectedVersion?: string) {
    if (!canSync || (syncSummary?.status !== "ready" && syncSummary?.status !== "synced") || !isOnline()) {
      setActionError(t("user.wrongbookSync.offline"));
      return;
    }
    setSyncAction(action);
    clearSnackbar(); setActionError(null);
    try {
      if (action === "pull") {
        await pullAndMergeWrongBook();
        showSnackbar(t("user.wrongbookSync.pullSuccess"));
      } else if (action === "overwrite") {
        await overwriteCloudWrongBook(expectedTarget, expectedVersion);
        showSnackbar(t("user.wrongbookSync.overwriteSuccess"));
      } else {
        await mergeUploadWrongBook();
        showSnackbar(t("user.wrongbookSync.mergeSuccess"));
      }
    } catch (error) {
      setActionError(t(syncErrorMessageKey(error), { code: syncErrorCode(error) }));
    } finally {
      setSyncAction(null);
    }
  }

  function openOverwriteDialog() {
    setOverwriteTarget(getOverwriteTarget(syncSummary, user));
    setOverwriteDialogOpen(true);
  }

  async function confirmOverwrite() {
    const expectedTarget = overwriteTarget;
    setOverwriteDialogOpen(false);
    if (!expectedTarget) {
      setActionError(t("user.wrongbookSync.targetChanged"));
      return;
    }
    try {
      const currentSummary = await readWrongBookSyncSummary({ force: true });
      const currentTarget = getOverwriteTarget(currentSummary, user);
      if (currentTarget?.identity !== expectedTarget.identity) {
        setActionError(t("user.wrongbookSync.targetChanged"));
        return;
      }
      if (currentTarget.version !== expectedTarget.version) {
        setActionError(t("user.wrongbookSync.conflict"));
        return;
      }
      await runSync("overwrite", expectedTarget.identity, expectedTarget.version);
    } catch (error) {
      setActionError(t(syncErrorMessageKey(error), { code: syncErrorCode(error) }));
    }
  }

  const canSync = (syncSummary?.status === "ready" || syncSummary?.status === "synced") && (Boolean(user) || syncSummary.source === "custom");
  const syncUnavailable = !canSync || syncing || Boolean(syncAction) || refreshing || !isOnline();
  const hasSource = Boolean(user) || syncSummary?.source === "custom";
  const offline = syncSummary?.status === "offline" || !isOnline();
  const currentSyncIcon = offline ? "cloud_off" : actionError || sync.status === "error" ? "cloud_alert" : syncing && syncAction ? syncActionIcon[syncAction] : syncSummaryIcon(syncSummary, user);
  const currentSyncText = offline && syncSummary?.unavailableReason !== "server-unavailable" ? t("sync.panel.offline") : actionError ?? (sync.status === "error"
    ? t("sync.auto.error", { code: sync.error ?? "SYNC_FAILED" })
    : sync.status === "pending"
    ? t("sync.pending")
    : syncing && syncAction
      ? t(syncActionLabel[syncAction])
      : sync.status === "syncing"
        ? t("sync.syncing")
        : sync.status === "synced"
          ? t("sync.synced")
          : syncSummary
            ? t(syncSummaryMessageKey(syncSummary), {
                localCount: syncSummary.localCount,
                cloudCount: syncSummary.cloudCount ?? 0,
                localMasteryCount: syncSummary.localMasteryCount ?? 0,
                cloudMasteryCount: syncSummary.cloudMasteryCount ?? 0
              })
            : t("user.wrongbookSync.loading"));
  const currentSyncStatus = offline ? "offline" : actionError ? "error" : sync.status === "idle" ? syncSummary?.status ?? (user ? "ready" : "signed-out") : sync.status;

  const successDate = syncSummary?.source === "account" && sync.lastSuccessAt ? new Date(sync.lastSuccessAt) : null;
  return <div className="stack">
    {hasSource ? <p className="helper-text">{syncSummary?.source === "custom" ? t("sync.panel.customSource", { name: readDeveloperSyncSource()?.profileId ?? "" }) : t("sync.panel.accountSource", { name: user?.name ?? "" })}</p> : null}
    <div className="sync-panel-status" data-status={currentSyncStatus} role={!offline && (actionError || sync.status === "error") ? "alert" : "status"} aria-live="polite">
      <MaterialIcon name={currentSyncIcon} /><span>{currentSyncText}</span>
    </div>
    {(offline || !hasSource) && isOnline() && (syncSummary?.status === "error" || syncSummary?.unavailableReason === "server-unavailable") ? <M3eButton variant="text" disabled={syncing || refreshing} onClick={() => void refresh()}>{t("common.refresh")}</M3eButton> : null}
    {hasSource && successDate && !Number.isNaN(successDate.getTime()) ? <p className="helper-text">{t("sync.panel.lastSuccess", { time: successDate.toLocaleString(locale) })}</p> : null}
    {!hasSource ? <M3eButton variant="filled" disabled={offline || !syncSummary} onClick={() => { const returnTo = window.location.pathname + window.location.search + "#wrongbook-sync"; window.location.assign("/api/auth/login?returnTo=" + encodeURIComponent(returnTo)); }}>{t("user.login")}</M3eButton> : <>
      {syncSummary?.source !== "custom" && (!offline || sync.enabled) ? <LearningAutoSyncControls compact showStatus={false} /> : null}
      {!offline ? <>
        <M3eButton variant="filled" disabled={syncUnavailable} onClick={() => void runSync("merge")}>{t("sync.panel.syncNow")}</M3eButton>
        <details className="sync-panel-help"><summary>{t("sync.panel.more")}</summary><div className="stack">
          <div className="sync-panel-actions">
            <M3eButton variant="outlined" disabled={syncUnavailable} onClick={() => void runSync("pull")}>{t("user.wrongbookSync.pull")}</M3eButton>
            <M3eButton variant="outlined" disabled={syncUnavailable} onClick={openOverwriteDialog}>{t("user.wrongbookSync.overwrite")}</M3eButton>
            <M3eButton variant="text" disabled={syncing || refreshing} onClick={() => void refresh()}>{t("common.refresh")}</M3eButton>
          </div>
          <dl className="sync-panel-counts" aria-label={t("sync.panel.counts")}>
            <div><dt>{t("sync.panel.local")}</dt><dd>{t("sync.panel.recordCounts", { words: syncSummary?.localCount ?? 0, mastery: syncSummary?.localMasteryCount ?? 0 })}</dd></div>
            <div><dt>{t("sync.panel.cloud")}</dt><dd>{syncSummary?.cloudCount === undefined ? t("sync.panel.unknown") : t("sync.panel.recordCounts", { words: syncSummary.cloudCount, mastery: syncSummary.cloudMasteryCount ?? 0 })}</dd></div>
          </dl>
          {syncSummary?.source !== "custom" ? <p className="helper-text">{t("sync.auto.description")}</p> : null}
          <p className="helper-text">{t("user.wrongbookSync.masteryMergeNote")}</p>
        </div></details>
      </> : null}
    </>}
      <M3eDialog open={overwriteDialogOpen} onClosed={() => setOverwriteDialogOpen(false)} onCancel={() => setOverwriteDialogOpen(false)}>
        <div slot="header">{t("user.wrongbookSync.overwriteConfirmTitle")}</div>
        <div className="stack">
          <p>{t("user.wrongbookSync.overwriteConfirm", {
            target: overwriteTarget?.source === "custom"
              ? `${t("user.wrongbookSync.customTarget")}: ${overwriteTarget.profileId}`
              : overwriteTarget?.name ?? t("user.wrongbookSync.unknownTarget")
          })}</p>
          <p className="helper-text">{t("user.wrongbookSync.overwriteScope")}</p>
        </div>
        <div slot="actions">
          <M3eButton variant="text" onClick={() => setOverwriteDialogOpen(false)}>{t("common.cancel")}</M3eButton>
          <M3eButton variant="text" disabled={syncing} onClick={() => void confirmOverwrite()}>{t("user.wrongbookSync.overwriteConfirmAction")}</M3eButton>
        </div>
      </M3eDialog>

  </div>;
}
