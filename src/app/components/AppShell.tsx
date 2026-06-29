"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserSession } from "@/lib/types";
import { useEffect, useState } from "react";

const toolItems = [
  { href: "/", label: "工具总览", icon: "⌂" },
  { href: "/shici", label: "寻找实词", icon: "言" },
  { href: "/wenchang", label: "文学常识", icon: "典" },
  { href: "/vocab", label: "单词测试", icon: "Aa" },
  { href: "/text", label: "课文测试", icon: "段" },
  { href: "/license", label: "项目许可", icon: "MIT" }
] as const;

const personalItems = [
  { href: "/settings", label: "个人设置", icon: "⚙" },
  { href: "/user", label: "用户与同步", icon: "人" }
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [user, setUser] = useState<UserSession | null>(null);

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

  return (
    <div className="app-drawer__panel">
      <Link href="/" className="app-brand" onClick={onNavigate}>
        <span className="app-brand__mark" aria-hidden="true">
          恨
        </span>
        <span>
          <span className="app-brand__title">恨古人工具箱</span>
          <br />
          <span className="app-brand__subtitle">学习工具箱 v3</span>
        </span>
      </Link>
      <md-divider />
      <nav className="app-nav" aria-label="工具导航">
        <div className="app-nav__group">
          <div className="app-nav__group-title">学习工具</div>
          {toolItems.map((item) => {
            const selected = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                href={item.href}
                className="app-nav__item"
                aria-current={selected ? "page" : undefined}
                key={item.href}
                onClick={onNavigate}
              >
                <span className="app-nav__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="app-nav__label">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="app-drawer__footer" aria-label="个人快捷入口">
        <Link href="/user" className="user-nav-card" aria-current={pathname.startsWith("/user") ? "page" : undefined} onClick={onNavigate}>
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="user-nav-avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="user-nav-avatar user-nav-avatar--fallback" aria-hidden="true">
              {user?.name?.[0] ?? "未"}
            </span>
          )}
          <span>
            <span className="app-nav__label">{user ? user.name : "未登录"}</span>
            <br />
            <span className="app-brand__subtitle">{user ? user.email || "已登录" : "点击登录同步"}</span>
          </span>
        </Link>
        <Link
          href="/settings"
          className="app-nav__item app-nav__item--footer"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          onClick={onNavigate}
        >
          <span className="app-nav__icon" aria-hidden="true">
            {personalItems[0].icon}
          </span>
          <span className="app-nav__label">{personalItems[0].label}</span>
        </Link>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-shell">
      <button className="mobile-menu" type="button" aria-label="打开导航" onClick={() => setMobileOpen(true)}>
        ☰
      </button>
      <button className="drawer-scrim" data-open={mobileOpen} aria-label="关闭导航" onClick={() => setMobileOpen(false)} />
      <aside className="app-drawer" data-open={mobileOpen} aria-label="侧边导航">
        <NavList onNavigate={() => setMobileOpen(false)} />
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}
