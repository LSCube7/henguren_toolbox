"use client";

import type { UserSession } from "@/lib/types";
import { useSnackbar } from "../components/Snackbar";
import { MaterialIcon } from "../components/MaterialIcon";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { mergeUploadWrongBook, overwriteCloudWrongBook, pullAndMergeWrongBook, readWrongBookSyncSummary, type WrongBookSyncSummary } from "@/lib/client-sync";
import { developerSyncSourceIdentity, readDeveloperSyncSource } from "@/lib/developer-sync-config";
import { isOnline } from "@/lib/offline-cache";
import { adoptGuestLearning, changeLearningOwner, currentLearningOwner, readLearningPartition } from "@/lib/client-learning-storage";
import { accountLearningOwner, guestLearningOwner } from "@/lib/learning-ownership";
import type { MaterialSymbolName } from "@/generated/material-symbols";
import { useI18n } from "../i18n/AppI18nProvider";
import type { MessageKey } from "@/i18n/config";
import { localizePath } from "@/lib/localized-routing";

const authMessages: Record<string, MessageKey> = {
  ok: "auth.ok",
  missing_code_state: "auth.missingCode",
  missing_oauth_cookie: "auth.missingCookie",
  state_mismatch: "auth.stateMismatch",
  unconfigured: "auth.unconfigured",
  code_expired: "auth.codeExpired",
  invalid_grant: "auth.invalidGrant",
  token_http: "auth.tokenHttp",
  token_no_access_token: "auth.noAccessToken",
  userinfo_http: "auth.userinfoHttp",
  userinfo_missing_subject: "auth.userinfoMissingSubject"
};

type SyncAction = "pull" | "overwrite" | "merge";
type OverwriteTarget = { identity: string; source: "account" | "custom"; name?: string; profileId?: string; version?: string };

function getOverwriteTarget(summary: WrongBookSyncSummary | null, fallbackUser: UserSession | null): OverwriteTarget | null {
  if (summary?.status !== "ready") return null;
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
    if (summary.source === "custom") return "sync.detail.customOffline";
    return summary.unavailableReason === "server-unavailable" ? "sync.detail.serverUnavailable" : "sync.detail.offline";
  }
  if (summary.status === "error") {
    if (summary.source === "local") return "user.wrongbookSync.loadError";
    return summary.source === "custom" ? "sync.detail.customError" : "sync.detail.cloudError";
  }
  if (summary.status === "ready") {
    return summary.source === "custom" ? "sync.detail.customReady" : "sync.detail.ready";
  }
  if (summary.status === "synced") return "sync.synced";
  return "sync.detail.signedOut";
}

function syncSummaryLoadErrorKey(error: unknown): MessageKey {
  return error instanceof Error && error.message.includes("IDB_UPGRADE_BLOCKED")
    ? "user.wrongbookSync.loadBlocked"
    : "user.wrongbookSync.loadError";
}

async function readSyncSummarySafely() {
  try {
    return { summary: await readWrongBookSyncSummary(), error: null };
  } catch (error) {
    return {
      summary: {
        status: "error",
        source: "local",
        unavailableReason: "source-unavailable",
        user: null,
        localCount: 0,
        localMasteryCount: 0,
        cloudMasteryCount: 0
      } satisfies WrongBookSyncSummary,
      error
    };
  }
}

export function UserClient() {
  const searchParams = useSearchParams();
  const { locale, t } = useI18n();
  const { clearSnackbar, showSnackbar } = useSnackbar();
  const authStatus = searchParams.get("auth") ?? "";
  const authMessageKey = authMessages[authStatus];
  const [user, setUser] = useState<UserSession | null>(null);
  const [syncSummary, setSyncSummary] = useState<WrongBookSyncSummary | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncAction, setSyncAction] = useState<SyncAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false);
  const [overwriteTarget, setOverwriteTarget] = useState<OverwriteTarget | null>(null);
  const [guestCount, setGuestCount] = useState(0);
  const [adoptDialogOpen, setAdoptDialogOpen] = useState(false);
  const [accountChanging, setAccountChanging] = useState(false);

  useEffect(() => {
    void readLearningPartition(guestLearningOwner, true).then((partition) => setGuestCount(partition.wrongbook.records.length + partition.masteryRecords.length + partition.wrongbook.deletedRecords.length + partition.wrongbook.deletedBatches.length))
      .catch(() => showSnackbar(t("user.localOwner.error"), "error"));
  }, [showSnackbar, t]);

  useEffect(() => {
    if (authMessageKey) showSnackbar(t(authMessageKey), authStatus === "ok" ? "info" : "error");
  }, [authMessageKey, authStatus, showSnackbar, t]);

  const refresh = useCallback(async (markLoading = false) => {
    if (markLoading) setLoading(true);
    const { summary, error } = await readSyncSummarySafely();
    if (error) showSnackbar(t(syncSummaryLoadErrorKey(error)), "error");
    if (isOnline()) {
      try {
        const meResponse = await fetch("/api/me");
        const data = (await meResponse.json()) as { authenticated: boolean; user: UserSession | null };
        setUser(data.user);
      } catch {
        setUser(summary.user);
      }
    }
    setSyncSummary(summary);
    setLoading(false);
  }, [showSnackbar, t]);

  useEffect(() => {
    let active = true;
    async function load() {
      const { summary, error } = await readSyncSummarySafely();
      let nextUser = summary.user;
      if (isOnline()) {
        try {
          const response = await fetch("/api/me");
          const data = (await response.json()) as { authenticated: boolean; user: UserSession | null };
          nextUser = data.user;
        } catch {
          nextUser = summary.user;
        }
      }
      if (!active) return;
      if (error) showSnackbar(t(syncSummaryLoadErrorKey(error)), "error");
      setUser(nextUser);
      setSyncSummary(summary);
      setLoading(false);
    }
    function reload() {
      void load();
    }

    void load();
    window.addEventListener("online", reload);
    window.addEventListener("offline", reload);
    return () => {
      active = false;
      window.removeEventListener("online", reload);
      window.removeEventListener("offline", reload);
    };
  }, [showSnackbar, t]);

  async function logout() {
    if (!isOnline()) { showSnackbar(t("user.localOwner.logoutOffline"), "error"); return; }
    setAccountChanging(true);
    try {
      const owner = currentLearningOwner();
      const ownerUserId: unknown = owner.startsWith("account:") ? JSON.parse(owner.slice("account:".length)) : undefined;
      const expectedUserId = typeof ownerUserId === "string" ? ownerUserId : user?.id;
      const response = await fetch("/api/auth/logout", { method: "POST", cache: "no-store", headers: expectedUserId ? { "X-Sync-User": expectedUserId } : {} });
      if (!response.ok) throw new Error("LOGOUT_FAILED");
      await changeLearningOwner(guestLearningOwner, true);
      window.location.reload();
    } catch { showSnackbar(t("user.localOwner.logoutFailed"), "error"); }
    finally { setAccountChanging(false); }
  }

  async function adoptGuest() {
    setAdoptDialogOpen(false);
    if (!user || currentLearningOwner() !== accountLearningOwner(user.id)) return;
    setAccountChanging(true);
    try {
      const response = await fetch("/api/me", { cache: "no-store" });
      const data = await response.json() as { authenticated: boolean; user: UserSession | null };
      if (!response.ok || !data.authenticated || data.user?.id !== user.id) {
        showSnackbar(t("user.wrongbookSync.targetChanged"), "error");
        return;
      }
      await adoptGuestLearning(user.id);
      setGuestCount(0);
      await refresh();
    }
    catch { showSnackbar(t("user.localOwner.error"), "error"); }
    finally { setAccountChanging(false); }
  }

  async function runSync(action: "pull" | "overwrite" | "merge", expectedTarget?: string, expectedVersion?: string) {
    if (!canSync || syncSummary?.status !== "ready" || !isOnline()) {
      showSnackbar(t("user.wrongbookSync.offline"), "error");
      return;
    }
    setSyncing(true);
    setSyncAction(action);
    clearSnackbar();
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
      await refresh();
    } catch (error) {
      showSnackbar(t(syncErrorMessageKey(error), { code: syncErrorCode(error) }), "error");
    } finally {
      setSyncing(false);
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
      showSnackbar(t("user.wrongbookSync.targetChanged"), "error");
      return;
    }
    try {
      const currentSummary = await readWrongBookSyncSummary();
      const currentTarget = getOverwriteTarget(currentSummary, user);
      if (currentTarget?.identity !== expectedTarget.identity) {
        setSyncSummary(currentSummary);
        showSnackbar(t("user.wrongbookSync.targetChanged"), "error");
        return;
      }
      setSyncSummary(currentSummary);
      if (currentTarget.version !== expectedTarget.version) {
        showSnackbar(t("user.wrongbookSync.conflict"), "error");
        return;
      }
      await runSync("overwrite", expectedTarget.identity, expectedTarget.version);
    } catch (error) {
      showSnackbar(t(syncErrorMessageKey(error), { code: syncErrorCode(error) }), "error");
    }
  }

  const canSync = syncSummary?.status === "ready" && (Boolean(user) || syncSummary.source === "custom");
  const syncUnavailable = !canSync || syncing || accountChanging || !isOnline();
  const syncReadDisabled = syncUnavailable;
  const currentSyncIcon = syncing && syncAction ? syncActionIcon[syncAction] : syncSummaryIcon(syncSummary, user);
  const currentSyncText = syncing && syncAction
    ? t(syncActionLabel[syncAction])
    : syncSummary
      ? t(syncSummaryMessageKey(syncSummary), {
          localCount: syncSummary.localCount,
          cloudCount: syncSummary.cloudCount ?? 0,
          localMasteryCount: syncSummary.localMasteryCount ?? 0,
          cloudMasteryCount: syncSummary.cloudMasteryCount ?? 0
        })
      : t("user.wrongbookSync.loading");
  const currentSyncStatus = syncing ? "syncing" : syncSummary?.status ?? (user ? "ready" : "signed-out");
  const loginHref = `/api/auth/login?returnTo=${encodeURIComponent(localizePath(locale, "/user"))}`;

  return (
    <div className="stack">
      <section className="md-card spread" aria-label={t("user.loginAria")}>
        <div className="cluster">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="user-avatar" src={user.avatarUrl} alt={t("user.avatarAlt", { name: user.name })} referrerPolicy="no-referrer" />
          ) : (
            <span className="app-brand__mark" aria-hidden="true">
              用
            </span>
          )}
          <div>
            <h2 className="section-title">{loading ? t("user.loading") : user ? user.name : t("user.signedOut")}</h2>
            <p className="helper-text">{user ? user.email || user.id : t("user.signedOutDescription")}</p>
          </div>
        </div>
        <div className="cluster">
          <md-outlined-button onClick={() => void refresh(true)}>{t("common.refresh")}</md-outlined-button>
          {user || currentLearningOwner() !== guestLearningOwner ? (
            <md-outlined-button disabled={syncing || accountChanging} onClick={() => void logout()}>{t("user.logout")}</md-outlined-button>
          ) : null}
          {!user ? <md-filled-button href={loginHref}>{t("user.login")}</md-filled-button> : null}
        </div>
      </section>
      <section className="md-card stack" aria-label={t("user.localOwner.title")}>
        <h2 className="section-title">{t("user.localOwner.title")}</h2>
        <p>{currentLearningOwner() === guestLearningOwner ? t("user.localOwner.guest") : user ? t("user.localOwner.account", { name: user.name }) : t("user.localOwner.expired")}</p>
        <p className="helper-text">{t("user.localOwner.description")}</p>
        {user && guestCount > 0 ? <md-outlined-button disabled={syncing || accountChanging} onClick={() => setAdoptDialogOpen(true)}>{t("user.localOwner.adopt")}</md-outlined-button> : null}
      </section>
      <md-dialog open={adoptDialogOpen} onClose={() => setAdoptDialogOpen(false)} onCancel={() => setAdoptDialogOpen(false)}>
        <div slot="headline">{t("user.localOwner.adopt")}</div>
        <div slot="content">{t("user.localOwner.adoptConfirm", { name: user?.name ?? "" })}</div>
        <div slot="actions"><md-text-button onClick={() => setAdoptDialogOpen(false)}>{t("common.cancel")}</md-text-button><md-text-button onClick={() => void adoptGuest()}>{t("user.localOwner.adoptAction")}</md-text-button></div>
      </md-dialog>
      <section className="md-card spread" id="wrongbook-sync" aria-label={t("user.wrongbookSyncAria")}>
        <div>
          <h2 className="section-title">{t("user.wrongbookSync.title")}</h2>
          <span className="sync-status-chip" data-status={currentSyncStatus}>
            <MaterialIcon name={currentSyncIcon} />
            <span>{currentSyncText}</span>
          </span>
          <p className="helper-text">{t("user.wrongbookSync.masteryMergeNote")}</p>
        </div>
        <div className="cluster">
          <md-outlined-button disabled={syncReadDisabled} onClick={() => void runSync("pull")}>{t("user.wrongbookSync.pull")}</md-outlined-button>
          <md-outlined-button disabled={syncUnavailable} onClick={openOverwriteDialog}>{t("user.wrongbookSync.overwrite")}</md-outlined-button>
          <md-filled-button disabled={syncReadDisabled} onClick={() => void runSync("merge")}>{t("user.wrongbookSync.merge")}</md-filled-button>
        </div>
      </section>
      <md-dialog open={overwriteDialogOpen} onClose={() => setOverwriteDialogOpen(false)} onCancel={() => setOverwriteDialogOpen(false)}>
        <div slot="headline">{t("user.wrongbookSync.overwriteConfirmTitle")}</div>
        <div slot="content" className="stack">
          <p>{t("user.wrongbookSync.overwriteConfirm", {
            target: overwriteTarget?.source === "custom"
              ? `${t("user.wrongbookSync.customTarget")}: ${overwriteTarget.profileId}`
              : overwriteTarget?.name ?? t("user.wrongbookSync.unknownTarget")
          })}</p>
          <p className="helper-text">{t("user.wrongbookSync.overwriteScope")}</p>
        </div>
        <div slot="actions">
          <md-text-button onClick={() => setOverwriteDialogOpen(false)}>{t("common.cancel")}</md-text-button>
          <md-text-button onClick={() => void confirmOverwrite()}>{t("user.wrongbookSync.overwriteConfirmAction")}</md-text-button>
        </div>
      </md-dialog>
    </div>
  );
}
