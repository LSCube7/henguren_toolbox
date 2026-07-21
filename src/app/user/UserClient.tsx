"use client";

import type { UserSession } from "@/lib/types";
import { StatusAlert } from "../components/StatusAlert";
import { MaterialIcon } from "../components/MaterialIcon";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { mergeUploadWrongBook, overwriteCloudWrongBook, pullAndMergeWrongBook, readWrongBookSyncSummary, type WrongBookSyncSummary } from "@/lib/client-sync";
import { isOnline } from "@/lib/offline-cache";
import type { MaterialSymbolName } from "@/generated/material-symbols";

const authMessages: Record<string, string> = {
  ok: "已完成登录。",
  missing_code_state: "登录回调缺少授权码或 state，请重新登录。",
  missing_oauth_cookie: "登录会话已过期或浏览器未带回 OAuth 临时 cookie，请重新登录。",
  state_mismatch: "LSCube OAuth state 校验失败，请重新登录。",
  unconfigured: "LSCube OAuth 环境变量尚未配置完整。",
  code_expired: "LSCube OAuth 授权码已过期或已被使用，请重新点击登录。",
  invalid_grant: "LSCube OAuth 授权码无效，请确认回调地址、PKCE 和客户端配置后重试。",
  token_http: "LSCube OAuth token exchange 失败，请查看服务端日志。",
  token_no_access_token: "LSCube OAuth token 响应缺少 access_token。",
  userinfo_http: "LSCube OAuth 用户信息请求失败，请查看服务端日志。"
};

type SyncAction = "pull" | "overwrite" | "merge";

const syncActionIcon: Record<SyncAction, MaterialSymbolName> = {
  pull: "cloud_download",
  overwrite: "cloud_upload",
  merge: "cloud_sync"
};

const syncActionLabel: Record<SyncAction, string> = {
  pull: "正在拉取云端错题本",
  overwrite: "正在上传覆盖云端",
  merge: "正在合并上传"
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
  const [user, setUser] = useState<UserSession | null>(null);
  const [syncSummary, setSyncSummary] = useState<WrongBookSyncSummary | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncAction, setSyncAction] = useState<SyncAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(() => authMessages[searchParams.get("auth") ?? ""] ?? "");

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
    setMessage("已退出登录。");
    await refresh(true);
  }

  async function runSync(action: "pull" | "overwrite" | "merge") {
    if (syncSummary?.status === "offline" || !isOnline()) {
      setMessage("当前离线，云端错题本不可用；本地错题本仍可使用。");
      return;
    }
    setSyncing(true);
    setSyncAction(action);
    setMessage("");
    try {
      if (action === "pull") {
        await pullAndMergeWrongBook();
        setMessage("已拉取云端错题本并合并到本地。");
      } else if (action === "overwrite") {
        await overwriteCloudWrongBook();
        setMessage("已用本地错题本上传覆盖云端。");
      } else {
        await mergeUploadWrongBook();
        setMessage("已完成本地与云端合并上传。");
      }
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "错题本同步失败。");
    } finally {
      setSyncing(false);
      setSyncAction(null);
    }
  }

  const syncDisabled = !user || syncing || syncSummary?.status === "offline";
  const currentSyncIcon = syncing && syncAction ? syncActionIcon[syncAction] : syncSummaryIcon(syncSummary, user);
  const currentSyncText = syncing && syncAction ? syncActionLabel[syncAction] : syncSummary?.message ?? "正在读取错题本同步状态。";
  const currentSyncStatus = syncing ? "syncing" : syncSummary?.status ?? (user ? "ready" : "signed-out");

  return (
    <div className="stack">
      <section className="md-card spread" aria-label="用户登录状态">
        <div className="cluster">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="user-avatar" src={user.avatarUrl} alt={`${user.name} 的头像`} referrerPolicy="no-referrer" />
          ) : (
            <span className="app-brand__mark" aria-hidden="true">
              用
            </span>
          )}
          <div>
            <h2 className="section-title">{loading ? "正在读取登录状态" : user ? user.name : "未登录"}</h2>
            <p className="helper-text">{user ? user.email || user.id : "登录后可以使用云端错题本和设置同步。"}</p>
          </div>
        </div>
        <div className="cluster">
          <md-outlined-button onClick={() => void refresh(true)}>刷新</md-outlined-button>
          {user ? (
            <md-outlined-button onClick={() => void logout()}>退出登录</md-outlined-button>
          ) : (
            <md-filled-button href="/api/auth/login">登录 LSCube OAuth</md-filled-button>
          )}
        </div>
      </section>
      <section className="md-card spread" id="wrongbook-sync" aria-label="错题本云同步">
        <div>
          <h2 className="section-title">错题本云同步</h2>
          <p className="helper-text">{syncSummary?.message ?? "正在读取错题本同步状态。"}</p>
          <span className="sync-status-chip" data-status={currentSyncStatus}>
            <MaterialIcon name={currentSyncIcon} />
            <span>{currentSyncText}</span>
          </span>
        </div>
        <div className="cluster">
          <md-outlined-button disabled={syncDisabled} onClick={() => void runSync("pull")}>拉取云端并合并本地</md-outlined-button>
          <md-outlined-button disabled={syncDisabled} onClick={() => void runSync("overwrite")}>上传覆盖云端</md-outlined-button>
          <md-filled-button disabled={syncDisabled} onClick={() => void runSync("merge")}>合并上传</md-filled-button>
        </div>
      </section>
      <StatusAlert message={message} />
    </div>
  );
}
