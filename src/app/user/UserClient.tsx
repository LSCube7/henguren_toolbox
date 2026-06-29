"use client";

import type { UserSession } from "@/lib/types";
import { StatusAlert } from "../components/StatusAlert";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const authMessages: Record<string, string> = {
  ok: "已完成登录。",
  missing_code_state: "登录回调缺少授权码或 state，请重新登录。",
  missing_oauth_cookie: "登录会话已过期或浏览器未带回 OAuth 临时 cookie，请重新登录。",
  state_mismatch: "OAuth state 校验失败，请重新登录。",
  unconfigured: "OAuth 环境变量尚未配置完整。",
  code_expired: "OAuth 授权码已过期或已被使用，请重新点击登录。",
  invalid_grant: "OAuth 授权码无效，请确认回调地址、PKCE 和客户端配置后重试。",
  token_http: "OAuth token exchange 失败，请查看服务端日志。",
  token_no_access_token: "OAuth token 响应缺少 access_token。",
  userinfo_http: "OAuth 用户信息请求失败，请查看服务端日志。"
};

export function UserClient() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(() => authMessages[searchParams.get("auth") ?? ""] ?? "");

  const refresh = useCallback(async (markLoading = false) => {
    if (markLoading) setLoading(true);
    const response = await fetch("/api/me");
    const data = (await response.json()) as { authenticated: boolean; user: UserSession | null };
    setUser(data.user);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      const response = await fetch("/api/me");
      const data = (await response.json()) as { authenticated: boolean; user: UserSession | null };
      if (!active) return;
      setUser(data.user);
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMessage("已退出登录。");
    await refresh(true);
  }

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
      <StatusAlert message={message} />
    </div>
  );
}
