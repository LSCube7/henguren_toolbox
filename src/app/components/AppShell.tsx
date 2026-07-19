"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { UserSession } from "@/lib/types";
import { useEffect, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { OnboardingGate } from "./OnboardingGate";
import { useEdition } from "@/lib/edition";
import { readWrongBookSyncSummary, type SyncStatus, type WrongBookSyncSummary } from "@/lib/client-sync";

const toolItems = [
  { edition: "junior", href: "/shici", label: "寻找实词", icon: "search" },
  { edition: "junior", href: "/wenchang", label: "文学常识", icon: "menu_book" },
  { edition: "senior", href: "/vocab", label: "单词测试", icon: "spellcheck" },
  { edition: "senior", href: "/text", label: "课文测试", icon: "article" }
] as const;

const overviewItem = { href: "/", label: "工具总览", icon: "home" } as const;

const personalItems = [
  { href: "/changelog", label: "更新记录", icon: "history" },
  { href: "/settings", label: "个人设置", icon: "settings" }
] as const;

const syncStatusLabel: Record<SyncStatus, string> = {
  "signed-out": "未登录，错题本仅保存在本地",
  offline: "当前离线，云端错题本不可用",
  ready: "云同步可用",
  syncing: "正在同步",
  synced: "已同步",
  error: "同步状态异常"
};

const syncStatusIcon: Record<SyncStatus, string> = {
  "signed-out": "cloud_off",
  offline: "cloud_off",
  ready: "cloud_sync",
  syncing: "cloud_upload",
  synced: "cloud_done",
  error: "cloud_alert"
};

const footerColumns = [
  {
    title: "项目",
    links: [
      { href: "https://github.com/LSCube7/henguren_toolbox", label: "GitHub", external: true },
      { href: "/license", label: "项目许可" }
    ]
  },
  {
    title: "开发者",
    links: [{ href: "https://www.lsc7.top", label: "LSCube", external: true }]
  },
  {
    title: "反馈",
    links: [
      { href: "https://github.com/LSCube7/henguren_toolbox/issues", label: "提交 Issue", external: true },
      { href: "https://github.com/LSCube7/henguren_toolbox/discussions", label: "参与讨论", external: true }
    ]
  }
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [user, setUser] = useState<UserSession | null>(null);
  const edition = useEdition();
  const [syncSummary, setSyncSummary] = useState<WrongBookSyncSummary | null>(null);

  useEffect(() => {
    let active = true;
    async function loadUser() {
      try {
        const response = await fetch("/api/me");
        const data = (await response.json()) as { authenticated: boolean; user: UserSession | null };
        if (active) setUser(data.user);
      } catch {
        if (active) setUser(null);
      }
    }
    void loadUser();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadSyncSummary() {
      try {
        const summary = await readWrongBookSyncSummary();
        if (!active) return;
        setSyncSummary(summary);
        setUser(summary.user);
      } catch {
        if (active) setSyncSummary({ status: "error", user: null, localCount: 0, message: "同步状态读取失败。" });
      }
    }

    function reloadSyncSummary() {
      void loadSyncSummary();
    }

    void loadSyncSummary();
    window.addEventListener("online", reloadSyncSummary);
    window.addEventListener("offline", reloadSyncSummary);
    return () => {
      active = false;
      window.removeEventListener("online", reloadSyncSummary);
      window.removeEventListener("offline", reloadSyncSummary);
    };
  }, []);

  const selectedTools = toolItems.filter((item) => item.edition === edition);
  const syncStatus = syncSummary?.status ?? (user ? "ready" : "signed-out");
  const syncTitle = syncSummary?.message ?? syncStatusLabel[syncStatus];
  const userTitle = user ? `${user.name}${user.email ? ` · ${user.email}` : ""}` : "未登录";

  function renderNavIcon(icon: string) {
    return (
      <span className="app-nav__icon-state" aria-hidden="true">
        <span className="app-nav__icon">
          <MaterialIcon name={icon} />
        </span>
      </span>
    );
  }

  return (
    <div className="app-drawer__panel">
      <nav className="app-nav" aria-label="工具导航">
        <Link
          href={overviewItem.href as Route}
          className="app-nav__item"
          aria-current={pathname === overviewItem.href ? "page" : undefined}
          onClick={onNavigate}
        >
          {renderNavIcon(overviewItem.icon)}
          <span className="app-nav__label">{overviewItem.label}</span>
        </Link>
        <div className="app-nav__group">
          <div className="app-nav__group-title">学习工具</div>
          {selectedTools.map((item) => {
            const selected = pathname.startsWith(item.href);
            return (
              <Link
                href={item.href as Route}
                className="app-nav__item"
                aria-current={selected ? "page" : undefined}
                key={item.href}
                onClick={onNavigate}
              >
                {renderNavIcon(item.icon)}
                <span className="app-nav__label">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="app-drawer__footer" aria-label="个人快捷入口">
        <Link href="/user#wrongbook-sync" className="rail-action" data-status={syncStatus} aria-label={syncStatusLabel[syncStatus]} title={syncTitle} onClick={onNavigate}>
          <MaterialIcon name={syncStatusIcon[syncStatus]} />
        </Link>
        {personalItems.map((item) => (
          <Link
            href={item.href as Route}
            className="rail-action"
            aria-current={pathname.startsWith(item.href) ? "page" : undefined}
            aria-label={item.label}
            title={item.label}
            key={item.href}
            onClick={onNavigate}
          >
            <MaterialIcon name={item.icon} />
          </Link>
        ))}
        <Link
          href="/user"
          className="user-nav-card"
          aria-current={pathname.startsWith("/user") ? "page" : undefined}
          aria-label={user ? `用户与同步：${user.name}` : "未登录"}
          title={userTitle}
          onClick={onNavigate}
        >
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="user-nav-avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="user-nav-icon" aria-hidden="true">
              <MaterialIcon name={user ? "account_circle" : "person"} />
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}

function FooterLink({ href, label, external = false }: { href: string; label: string; external?: boolean }) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {label}
      </a>
    );
  }

  return <Link href={href as Route}>{label}</Link>;
}

function AppFooter() {
  return (
    <footer className="app-footer" aria-label="站点信息">
      <div className="app-footer__wave" aria-hidden="true" />
      <div className="app-footer__body">
        <section className="app-footer__brand" aria-label="项目信息">
          <span className="app-footer__mark" aria-hidden="true">
            恨
          </span>
          <div className="stack">
            <div>
              <p className="app-footer__eyebrow">Henguren Toolbox v3.0.0</p>
              <h2 className="app-footer__title">恨古人工具箱</h2>
            </div>
            <p className="app-footer__description">面向语文与英语学习的轻量工具箱。</p>
          </div>
        </section>
        <nav className="app-footer__links" aria-label="页脚导航">
          {footerColumns.map((column) => (
            <div className="app-footer__column" key={column.title}>
              <h3>{column.title}</h3>
              {column.links.map((link) => (
                <FooterLink href={link.href} label={link.label} external={"external" in link ? link.external : false} key={link.href} />
              ))}
            </div>
          ))}
        </nav>
      </div>
      <div className="app-footer__bottom">
        <a className="app-footer__developer" href="https://www.lsc7.top" target="_blank" rel="noreferrer" aria-label="开发者 LSCube 个人主页">
          <strong>LSCube</strong>
        </a>
        <nav className="app-footer__legal" aria-label="法律信息">
          <FooterLink href="/privacy" label="隐私政策" />
          <FooterLink href="/terms" label="用户协议" />
        </nav>
        <span className="app-footer__copyright">Copyright © LSCube. All rights reserved.</span>
      </div>
    </footer>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/onboarding") {
    return (
      <main className="onboarding-route-main">
        {children}
        <OnboardingGate />
      </main>
    );
  }

  return (
    <div className="app-shell">
      <button className="mobile-menu" type="button" aria-label="打开导航" onClick={() => setMobileOpen(true)}>
        ☰
      </button>
      <button className="drawer-scrim" data-open={mobileOpen} aria-label="关闭导航" onClick={() => setMobileOpen(false)} />
      <aside className="app-drawer" data-open={mobileOpen} aria-label="侧边导航">
        <NavList onNavigate={() => setMobileOpen(false)} />
      </aside>
      <main className="app-main">
        <div className="app-content">{children}</div>
        <AppFooter />
      </main>
      <OnboardingGate />
    </div>
  );
}
