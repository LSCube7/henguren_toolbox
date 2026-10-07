"use client";

import Link from "next/link";
import { M3eNavRail } from "@m3e/react/nav-rail";
import { M3eNavItem } from "@m3e/react/nav-bar";
import { M3eDialog } from "@m3e/react/dialog";
import { M3eIconButton } from "@m3e/react/icon-button";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { defaultSettingsForLocale } from "@/lib/types";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { SyncMenu } from "./SyncMenu";
import { AccountMenu } from "./AccountMenu";
import { MaterialIcon } from "./MaterialIcon";
import { OnboardingGate } from "./OnboardingGate";
import { useEdition } from "@/lib/edition";
import type { MaterialSymbolName } from "@/generated/material-symbols";
import { useI18n } from "../i18n/AppI18nProvider";
import type { MessageKey } from "@/i18n/config";
import { useClientSettings } from "@/lib/client-settings";
import { localizePath, pathWithoutLocale, stripLocalePrefix } from "@/lib/localized-routing";

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

type NavigationEvent = Event | React.MouseEvent<HTMLElement>;
type NavigationRequest = (href: string, event: NavigationEvent) => void;

function modifiedNavigation(event: NavigationEvent) {
  return (event instanceof MouseEvent || "nativeEvent" in event) &&
    (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}
type PendingNavigation = { path: string; originPath: string };

function navigationKey(href: string) {
  return stripLocalePrefix(pathWithoutLocale(href));
}

function NavList({
  onNavigate,
  expanded = false,
  pendingPath,
  pendingSlowPath,
  onNavigationRequest
}: {
  onNavigate?: () => void;
  expanded?: boolean;
  pendingPath: string | null;
  pendingSlowPath: string | null;
  onNavigationRequest: NavigationRequest;
}) {
  const pathname = usePathname();
  const edition = useEdition();
  const { locale, t } = useI18n();
  const fallbackSettings = useMemo(() => defaultSettingsForLocale(locale), [locale]);
  const settings = useClientSettings(fallbackSettings);
  const currentPath = stripLocalePrefix(pathname);

  const selectedTools = toolItems.filter((item) => item.edition === edition);
  function handleClick(href: string, event: NavigationEvent) {
    onNavigationRequest(href, event);
    onNavigate?.();
  }

  const router = useRouter();
  function navItem(item: { href: string; label: MessageKey; icon: MaterialSymbolName }) {
    const href = localizePath(locale, item.href);
    const selected = item.href === "/" ? currentPath === "/" : currentPath === item.href || currentPath.startsWith(`${item.href}/`);
    const pending = pendingPath === item.href;
    return <M3eNavItem key={item.href} role="link" href={href} selected={selected}
      aria-current={selected ? "page" : undefined} aria-busy={pending ? "true" : undefined}
      data-pending={pending ? "true" : undefined} data-pending-slow={pendingSlowPath === item.href ? "true" : undefined}
      // Capture before M3E activates its pseudo link, preserving the Next layout.
      onClickCapture={(event) => {
        if (event.defaultPrevented || modifiedNavigation(event)) return;
        handleClick(href, event);
        event.preventDefault();
        router.push(href as Route);
      }}>
      <span slot="icon" aria-hidden="true"><MaterialIcon name={item.icon} /></span>
      <span slot="selected-icon" className="rail-selected-icon" aria-hidden="true"><MaterialIcon name={item.icon} /></span>
      {t(item.label)}
    </M3eNavItem>;
  }

  return (
    <div className="app-drawer__panel">
      <nav className="app-nav" aria-label={t("nav.toolsAria")} aria-busy={Boolean(pendingPath)}>
        <M3eNavRail mode={expanded ? "expanded" : "compact"} aria-label={t("nav.toolsAria")}>
          {navItem(overviewItem)}
          <div className="app-nav__group">
            <div className="app-nav__group-title">{t("nav.learningTools")}</div>
            {selectedTools.map(navItem)}
          </div>
        </M3eNavRail>
      </nav>
      <div className="app-drawer__footer" aria-label={t("nav.personalAria")}>
        <SyncMenu onOpen={onNavigate} />
        {personalItems.map((item) => {
          const href = localizePath(locale, item.href);
          const selected = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
          const pending = pendingPath === item.href;
          return (
            <Link
              href={href as Route}
              className="rail-action"
              aria-current={selected ? "page" : undefined}
              data-pending={pending ? "true" : undefined}
              data-pending-slow={pendingSlowPath === item.href ? "true" : undefined}
              aria-busy={pending ? true : undefined}
              aria-label={t(item.label)}
              title={t(item.label)}
              key={item.href}
              onClick={(event) => handleClick(href, event)}
            >
              <MaterialIcon name={item.icon} />
            </Link>
          );
        })}
        {settings.developerMode ? (
          (() => {
            const href = localizePath(locale, "/developer");
            const pending = pendingPath === "/developer";
            return (
              <Link
                href={href as Route}
                className="rail-action"
                aria-current={currentPath.startsWith("/developer") ? "page" : undefined}
                data-pending={pending ? "true" : undefined}
                data-pending-slow={pendingSlowPath === "/developer" ? "true" : undefined}
                aria-busy={pending ? true : undefined}
                aria-label={t("nav.developer")}
                title={t("nav.developer")}
                onClick={(event) => handleClick(href, event)}
              >
                <MaterialIcon name="code" />
              </Link>
            );
          })()
        ) : null}
        <AccountMenu onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function FooterLink({ href, label, external = false }: { href: string; label: MessageKey | "GitHub" | "LSCube"; external?: boolean }) {
  const { locale, t } = useI18n();
  const content = label === "GitHub" || label === "LSCube" ? label : t(label);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }

  return <Link href={localizePath(locale, href) as Route}>{content}</Link>;
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
              <p className="app-footer__eyebrow">Henguren Toolbox v3.1.0</p>
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

function subscribeMobile(callback: () => void) {
  const media = window.matchMedia("(max-width: 899px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia("(max-width: 899px)").matches, () => false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [pendingSlowNavigation, setPendingSlowNavigation] = useState<PendingNavigation | null>(null);
  const pathname = usePathname();
  const [navigationPathname, setNavigationPathname] = useState(pathname);
  const { t } = useI18n();
  const slowTimerRef = useRef<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const currentPath = stripLocalePrefix(pathname);
  // Clear state as well as timers so revisiting an origin cannot revive it.
  if (navigationPathname !== pathname) {
    setNavigationPathname(pathname);
    setPendingNavigation(null);
    setPendingSlowNavigation(null);
  }
  const pendingPath = pendingNavigation?.originPath === pathname ? pendingNavigation.path : null;
  const pendingSlowPath = pendingSlowNavigation?.originPath === pathname ? pendingSlowNavigation.path : null;

  useEffect(() => {
    if (slowTimerRef.current !== null) window.clearTimeout(slowTimerRef.current);
    if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
    slowTimerRef.current = null;
    clearTimerRef.current = null;
  }, [pathname]);

  useEffect(
    () => {
      function cancelNavigation() {
        setPendingNavigation(null);
        setPendingSlowNavigation(null);
        if (slowTimerRef.current !== null) window.clearTimeout(slowTimerRef.current);
        if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
        slowTimerRef.current = null;
        clearTimerRef.current = null;
      }

      window.addEventListener("popstate", cancelNavigation);
      return () => {
        window.removeEventListener("popstate", cancelNavigation);
        if (slowTimerRef.current !== null) window.clearTimeout(slowTimerRef.current);
        if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
      };
    },
    []
  );

  function requestNavigation(href: string, event: NavigationEvent) {
    if (event.defaultPrevented || modifiedNavigation(event)) return;
    const targetPath = navigationKey(href);
    if (targetPath === currentPath) return;

    if (slowTimerRef.current !== null) window.clearTimeout(slowTimerRef.current);
    if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
    setPendingNavigation({ path: targetPath, originPath: pathname });
    setPendingSlowNavigation(null);
    slowTimerRef.current = window.setTimeout(() => {
      setPendingSlowNavigation({ path: targetPath, originPath: pathname });
    }, 150);
    clearTimerRef.current = window.setTimeout(() => {
      setPendingNavigation(null);
      setPendingSlowNavigation(null);
      slowTimerRef.current = null;
      clearTimerRef.current = null;
    }, 10000);
  }

  if (currentPath === "/onboarding") {
    return <main className="onboarding-route-main">{children}</main>;
  }

  return (
    <OnboardingGate>
      <div className="app-shell">
        <M3eIconButton className="mobile-menu" aria-label={t("nav.open")} aria-expanded={mobileOpen ? "true" : "false"} onClick={() => setMobileOpen(true)}>
          <MaterialIcon name="menu" />
        </M3eIconButton>
        {mobile ? <M3eDialog className="mobile-navigation-dialog" open={mobileOpen} dismissible closeLabel={t("nav.close")}
          onClosed={() => setMobileOpen(false)}>
          <h2 slot="header">{t("nav.sidebar")}</h2>
          <NavList expanded onNavigate={() => setMobileOpen(false)} pendingPath={pendingPath}
            pendingSlowPath={pendingSlowPath} onNavigationRequest={requestNavigation} />
        </M3eDialog> : <aside className="app-drawer" aria-label={t("nav.sidebar")}>
          <NavList pendingPath={pendingPath} pendingSlowPath={pendingSlowPath} onNavigationRequest={requestNavigation} />
        </aside>}
        <main className="app-main">
          <div className="app-content">{children}</div>
          <AppFooter />
        </main>
      </div>
    </OnboardingGate>
  );
}
