"use client";

import { Dialog as M3eDialog } from "@/app/components/Dialog";
import { M3eButton } from "@m3e/react/button";

import type { UserSession } from "@/lib/types";
import { useSnackbar } from "../components/Snackbar";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLearningSync } from "@/lib/client-auto-sync";
import { logoutAccount } from "@/lib/client-account";
import { isOnline } from "@/lib/offline-cache";
import { adoptGuestLearning, currentLearningOwner, readLearningPartition } from "@/lib/client-learning-storage";
import { accountLearningOwner, guestLearningOwner } from "@/lib/learning-ownership";
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

function syncSummaryLoadErrorKey(error: unknown): MessageKey {
  return error instanceof Error && error.message.includes("IDB_UPGRADE_BLOCKED")
    ? "user.wrongbookSync.loadBlocked"
    : "user.wrongbookSync.loadError";
}


export function UserClient() {
  const searchParams = useSearchParams();
  const { locale, t } = useI18n();
  const { showSnackbar } = useSnackbar();
  const authStatus = searchParams.get("auth") ?? "";
  const authMessageKey = authMessages[authStatus];
  const sync = useLearningSync();
  const syncSummary = sync.summary;
  const user = syncSummary?.user ?? null;
  const syncing = sync.busy;
  const refreshShared = sync.refresh;
  const [refreshing, setRefreshing] = useState(false);
  const loading = !syncSummary || refreshing;
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
    if (markLoading) setRefreshing(true);
    try {
      await refreshShared();
    } catch (error) {
      showSnackbar(t(syncSummaryLoadErrorKey(error)), "error");
    } finally {
      setRefreshing(false);
    }
  }, [refreshShared, showSnackbar, t]);

  async function logout() {
    if (!isOnline()) { showSnackbar(t("user.localOwner.logoutOffline"), "error"); return; }
    setAccountChanging(true);
    try {
      await logoutAccount(user?.id);
    } catch {
      showSnackbar(t("user.localOwner.logoutFailed"), "error");
    }
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
          <M3eButton variant="outlined" disabled={syncing} onClick={() => void refresh(true)}>{t("common.refresh")}</M3eButton>
          {user || currentLearningOwner() !== guestLearningOwner ? (
            <M3eButton variant="outlined" disabled={syncing || accountChanging} onClick={() => void logout()}>{t("user.logout")}</M3eButton>
          ) : null}
          {!user ? <M3eButton variant="filled" href={loginHref}>{t("user.login")}</M3eButton> : null}
        </div>
      </section>
      <section className="md-card stack" aria-label={t("user.localOwner.title")}>
        <h2 className="section-title">{t("user.localOwner.title")}</h2>
        <p>{currentLearningOwner() === guestLearningOwner ? t("user.localOwner.guest") : user ? t("user.localOwner.account", { name: user.name }) : t("user.localOwner.expired")}</p>
        <p className="helper-text">{t("user.localOwner.description")}</p>
        {user && guestCount > 0 ? <M3eButton variant="outlined" disabled={syncing || accountChanging} onClick={() => setAdoptDialogOpen(true)}>{t("user.localOwner.adopt")}</M3eButton> : null}
      </section>
      <M3eDialog open={adoptDialogOpen} onClosed={() => setAdoptDialogOpen(false)} onCancel={() => setAdoptDialogOpen(false)}>
        <div slot="header">{t("user.localOwner.adopt")}</div>
        <div>{t("user.localOwner.adoptConfirm", { name: user?.name ?? "" })}</div>
        <div slot="actions"><M3eButton variant="text" onClick={() => setAdoptDialogOpen(false)}>{t("common.cancel")}</M3eButton><M3eButton variant="text" onClick={() => void adoptGuest()}>{t("user.localOwner.adoptAction")}</M3eButton></div>
      </M3eDialog>
    </div>
  );
}
