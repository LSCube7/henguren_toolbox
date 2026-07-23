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
import type { MaterialSymbolName } from "@/generated/material-symbols";
import { useI18n } from "../i18n/AppI18nProvider";
import type { MessageKey } from "@/i18n/config";
import { useClientSettings } from "@/lib/client-settings";

const toolItems = [
  { edition: "junior", href: "/shici", label: "nav.shici", icon: "search" },
  { edition: "junior", href: "/wenchang", label: "nav.wenchang", icon: "menu_book" },
  { edition: "senior", href: "/vocab", label: "nav.vocab", icon: "spellcheck" },
  { edition: "senior", href: "/text", label: "nav.text", icon: "article" }
] as const;

const overviewItem = { href: "/", label: "nav.overview", icon: "home" } as const;

const personalItems = [
  { href: "/changelog", label: "nav.changelog", icon: "history" },
  { href: "/settings", label: "nav.settings", icon: "settings" }
] as const;

const syncStatusLabel: Record<SyncStatus, MessageKey> = {
  "signed-out": "sync.signedOut",
  offline: "sync.offline",
  ready: "sync.ready",
  syncing: "sync.syncing",
  synced: "sync.synced",
  error: "sync.error"
};

const syncStatusIcon: Record<SyncStatus, MaterialSymbolName> = {
  "signed-out": "cloud_off",
  offline: "cloud_off",
  ready: "cloud_sync",
  syncing: "cloud_upload",
  synced: "cloud_done",
  error: "cloud_alert"
};

const footerColumns = [
  {
    title: "footer.project",
    links: [
      { href: "https://github.com/LSCube7/henguren_toolbox", label: "GitHub", external: true },
      { href: "/license", label: "footer.license" }
    ]
  },
  {
    title: "footer.developer",
    links: [{ href: "https://www.lsc7.top", label: "LSCube", external: true }]
  },
  {
    title: "footer.feedback",
    links: [
      { href: "https://github.com/LSCube7/henguren_toolbox/issues", label: "footer.issue", external: true },
      { href: "https://github.com/LSCube7/henguren_toolbox/discussions", label: "footer.discussion", external: true }
    ]
  }
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [user, setUser] = useState<UserSession | null>(null);
  const edition = useEdition();
  const [syncSummary, setSyncSummary] = useState<WrongBookSyncSummary | null>(null);
  const settings = useClientSettings();
  const { t } = useI18n();

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
        if (active) setSyncSummary({ status: "error", user: null, localCount: 0, message: t("sync.readError") });
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
  }, [t]);

  const selectedTools = toolItems.filter((item) => item.edition === edition);
  const syncStatus = syncSummary?.status ?? (user ? "ready" : "signed-out");
  const syncTitle = t(syncStatusLabel[syncStatus]);
  const userTitle = user ? `${user.name}${user.email ? ` · ${user.email}` : ""}` : t("user.signedOut");

  function renderNavIcon(icon: MaterialSymbolName) {
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
      <nav className="app-nav" aria-label={t("nav.toolsAria")}>
        <Link
          href={overviewItem.href as Route}
          className="app-nav__item"
          aria-current={pathname === overviewItem.href ? "page" : undefined}
          onClick={onNavigate}
        >
          {renderNavIcon(overviewItem.icon)}
          <span className="app-nav__label">{t(overviewItem.label)}</span>
        </Link>
        <div className="app-nav__group">
          <div className="app-nav__group-title">{t("nav.learningTools")}</div>
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
                <span className="app-nav__label">{t(item.label)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="app-drawer__footer" aria-label={t("nav.personalAria")}>
        <Link href="/user#wrongbook-sync" className="rail-action" data-status={syncStatus} aria-label={t(syncStatusLabel[syncStatus])} title={syncTitle} onClick={onNavigate}>
          <MaterialIcon name={syncStatusIcon[syncStatus]} />
        </Link>
        {personalItems.map((item) => (
          <Link
            href={item.href as Route}
            className="rail-action"
            aria-current={pathname.startsWith(item.href) ? "page" : undefined}
            aria-label={t(item.label)}
            title={t(item.label)}
            key={item.href}
            onClick={onNavigate}
          >
            <MaterialIcon name={item.icon} />
          </Link>
        ))}
        {settings.developerMode ? (
          <Link
            href={"/developer" as Route}
            className="rail-action"
            aria-current={pathname.startsWith("/developer") ? "page" : undefined}
            aria-label={t("nav.developer")}
            title={t("nav.developer")}
            onClick={onNavigate}
          >
            <MaterialIcon name="code" />
          </Link>
        ) : null}
        <Link
          href="/user"
          className="user-nav-card"
          aria-current={pathname.startsWith("/user") ? "page" : undefined}
          aria-label={user ? t("user.aria", { name: user.name }) : t("user.signedOut")}
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

function FooterLink({ href, label, external = false }: { href: string; label: MessageKey | "GitHub" | "LSCube"; external?: boolean }) {
  const { t } = useI18n();
  const content = label === "GitHub" || label === "LSCube" ? label : t(label);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }

  return <Link href={href as Route}>{content}</Link>;
}

function AppFooter() {
  const { t } = useI18n();
  return (
    <footer className="app-footer" aria-label={t("footer.siteInfo")}>
      <div className="app-footer__wave" aria-hidden="true" />
      <div className="app-footer__body">
        <section className="app-footer__brand" aria-label={t("footer.projectInfo")}>
          <span className="app-footer__mark" aria-hidden="true">
            恨
          </span>
          <div className="stack">
            <div>
              <p className="app-footer__eyebrow">Henguren Toolbox v3.0.0</p>
              <h2 className="app-footer__title">{t("app.name")}</h2>
            </div>
            <p className="app-footer__description">{t("app.description")}</p>
          </div>
        </section>
        <nav className="app-footer__links" aria-label={t("footer.navigation")}>
          {footerColumns.map((column) => (
            <div className="app-footer__column" key={column.title}>
              <h3>{t(column.title)}</h3>
              {column.links.map((link) => (
                <FooterLink href={link.href} label={link.label} external={"external" in link ? link.external : false} key={link.href} />
              ))}
            </div>
          ))}
        </nav>
      </div>
      <div className="app-footer__bottom">
        <a className="app-footer__developer" href="https://www.lsc7.top" target="_blank" rel="noreferrer" aria-label={t("footer.developerHome")}>
          <strong>LSCube</strong>
        </a>
        <nav className="app-footer__legal" aria-label={t("footer.legal")}>
          <FooterLink href="/privacy" label="footer.privacy" />
          <FooterLink href="/terms" label="footer.terms" />
        </nav>
        <span className="app-footer__copyright">Copyright © LSCube. All rights reserved.</span>
      </div>
    </footer>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();

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
      <button className="mobile-menu" type="button" aria-label={t("nav.open")} onClick={() => setMobileOpen(true)}>
        ☰
      </button>
      <button className="drawer-scrim" data-open={mobileOpen} aria-label={t("nav.close")} onClick={() => setMobileOpen(false)} />
      <aside className="app-drawer" data-open={mobileOpen} aria-label={t("nav.sidebar")}>
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
