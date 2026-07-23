"use client";

import type { UserSession } from "@/lib/types";
import { StatusAlert } from "../components/StatusAlert";
import { MaterialIcon } from "../components/MaterialIcon";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { mergeUploadWrongBook, overwriteCloudWrongBook, pullAndMergeWrongBook, readWrongBookSyncSummary, type WrongBookSyncSummary } from "@/lib/client-sync";
import { isOnline } from "@/lib/offline-cache";
import type { MaterialSymbolName } from "@/generated/material-symbols";
import { useI18n } from "../i18n/AppI18nProvider";
import type { MessageKey } from "@/i18n/config";

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
  userinfo_http: "auth.userinfoHttp"
};

type SyncAction = "pull" | "overwrite" | "merge";

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
  if (summary?.status === "offline") return "cloud_off";
  if (summary?.status === "error") return "cloud_alert";
  if (summary?.status === "synced") return "cloud_done";
  if (summary?.status === "ready" || user) return "cloud_sync";
  return "cloud_off";
}

export function UserClient() {
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [user, setUser] = useState<UserSession | null>(null);
  const [syncSummary, setSyncSummary] = useState<WrongBookSyncSummary | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncAction, setSyncAction] = useState<SyncAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(() => {
    const key = authMessages[searchParams.get("auth") ?? ""];
    return key ? t(key) : "";
  });

  const refresh = useCallback(async (markLoading = false) => {
    if (markLoading) setLoading(true);
    const summary = await readWrongBookSyncSummary();
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
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      const summary = await readWrongBookSyncSummary();
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
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMessage(t("user.logoutSuccess"));
    await refresh(true);
  }

  async function runSync(action: "pull" | "overwrite" | "merge") {
    if (syncSummary?.status === "offline" || !isOnline()) {
      setMessage(t("user.wrongbookSync.offline"));
      return;
    }
    setSyncing(true);
    setSyncAction(action);
    setMessage("");
    try {
      if (action === "pull") {
        await pullAndMergeWrongBook();
        setMessage(t("user.wrongbookSync.pullSuccess"));
      } else if (action === "overwrite") {
        await overwriteCloudWrongBook();
        setMessage(t("user.wrongbookSync.overwriteSuccess"));
      } else {
        await mergeUploadWrongBook();
        setMessage(t("user.wrongbookSync.mergeSuccess"));
      }
      await refresh();
    } catch {
      setMessage(t("user.wrongbookSync.error"));
    } finally {
      setSyncing(false);
      setSyncAction(null);
    }
  }

  const syncDisabled = !user || syncing || syncSummary?.status === "offline";
  const currentSyncIcon = syncing && syncAction ? syncActionIcon[syncAction] : syncSummaryIcon(syncSummary, user);
  const summaryStatusKey: MessageKey = syncSummary?.status === "offline" ? "sync.offline" : syncSummary?.status === "error" ? "sync.error" : syncSummary?.status === "synced" ? "sync.synced" : syncSummary?.status === "ready" ? "sync.ready" : "sync.signedOut";
  const currentSyncText = syncing && syncAction ? t(syncActionLabel[syncAction]) : syncSummary ? t(summaryStatusKey) : t("user.wrongbookSync.loading");
  const currentSyncStatus = syncing ? "syncing" : syncSummary?.status ?? (user ? "ready" : "signed-out");

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
          {user ? (
            <md-outlined-button onClick={() => void logout()}>{t("user.logout")}</md-outlined-button>
          ) : (
            <md-filled-button href="/api/auth/login">{t("user.login")}</md-filled-button>
          )}
        </div>
      </section>
      <section className="md-card spread" id="wrongbook-sync" aria-label={t("user.wrongbookSyncAria")}>
        <div>
          <h2 className="section-title">{t("user.wrongbookSync.title")}</h2>
          <p className="helper-text">{currentSyncText}</p>
          <span className="sync-status-chip" data-status={currentSyncStatus}>
            <MaterialIcon name={currentSyncIcon} />
            <span>{currentSyncText}</span>
          </span>
        </div>
        <div className="cluster">
          <md-outlined-button disabled={syncDisabled} onClick={() => void runSync("pull")}>{t("user.wrongbookSync.pull")}</md-outlined-button>
          <md-outlined-button disabled={syncDisabled} onClick={() => void runSync("overwrite")}>{t("user.wrongbookSync.overwrite")}</md-outlined-button>
          <md-filled-button disabled={syncDisabled} onClick={() => void runSync("merge")}>{t("user.wrongbookSync.merge")}</md-filled-button>
        </div>
      </section>
      <StatusAlert message={message} />
    </div>
  );
}
