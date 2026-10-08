"use client";
import { M3eMenu, M3eMenuItem, M3eMenuTrigger, type M3eMenuElement } from "@m3e/react/menu";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { useLearningSync } from "@/lib/client-auto-sync";
import { currentLearningOwner } from "@/lib/client-learning-storage";
import { logoutAccount } from "@/lib/client-account";
import { localizePath } from "@/lib/localized-routing";
import { useI18n } from "../i18n/AppI18nProvider";
import { useSnackbar } from "./Snackbar";
import { MaterialIcon } from "./MaterialIcon";

export function AccountMenu({ onNavigate, expanded = false }: { onNavigate?: () => void; expanded?: boolean }) {
  const sync = useLearningSync();
  const user = sync.summary?.user;
  const { locale, t } = useI18n();
  const { showSnackbar } = useSnackbar();
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();
  const menu = useRef<M3eMenuElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const offline = sync.status === "offline" || sync.summary?.status === "offline";
  const expired = sync.error === "UNAUTHORIZED" || (!user && sync.summary?.status === "signed-out" && currentLearningOwner().startsWith("account:"));
  const loading = !sync.summary;
  useEffect(() => {
    const element = menu.current;
    const anchor = trigger.current;
    if (!element || !anchor) return;
    if (open && !element.isOpen) void element.show(anchor);
    else if (!open && element.isOpen) element.hide();
  }, [open]);
  function handleMenuKeyDown(event: KeyboardEvent<M3eMenuElement>) {
    // Close only this popup; M3E 2.9 otherwise bubbles Escape to the rail dialog.
    if (event.key !== "Escape" || event.shiftKey || event.ctrlKey) return;
    event.preventDefault();
    event.stopPropagation();
    menu.current?.hide(true);
  }
  function navigate() {
    setOpen(false);
    router.push(localizePath(locale, "/user") as Route);
    onNavigate?.();
  }
  function login() {
    if (offline || changing) return;
    const returnTo = pathname + window.location.search + window.location.hash;
    window.location.assign("/api/auth/login?returnTo=" + encodeURIComponent(returnTo));
  }
  async function logout() {
    if (offline || changing) return;
    setChanging(true);
    try { await logoutAccount(user?.id); }
    catch (error) { showSnackbar(t(error instanceof Error && error.message === "OFFLINE" ? "user.localOwner.logoutOffline" : "user.localOwner.logoutFailed"), "error"); }
    finally { setChanging(false); }
  }
  return <div className="account-menu-anchor">
    <button ref={trigger} id={id} type="button" className="user-nav-card" aria-label={t("account.menu")} title={t("account.menu")} disabled={changing} onKeyDownCapture={(event) => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); menu.current?.hide(true); setOpen(false); } if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); } }}>
      <M3eMenuTrigger htmlFor={id + "-menu"}>{user?.avatarUrl ? (
        // OAuth avatars use the original URL and no-referrer, matching the existing rail.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="user-nav-avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />) : <span className="user-nav-icon" aria-hidden="true"><MaterialIcon name={user ? "account_circle" : "person"} /></span>}
      {expanded && <span>{t("account.menu")}</span>}</M3eMenuTrigger>
    </button>
    <M3eMenu ref={menu} id={id + "-menu"} positionX="after" positionY="above" onKeyDownCapture={handleMenuKeyDown} aria-label={t("account.menu")} onToggle={(event) => setOpen((event as ToggleEvent).newState === "open")}>
      <div className="account-menu-heading" role="presentation"><div className="account-menu-profile">{user?.avatarUrl ? (
        // Match the rail avatar's no-referrer policy without proxying account images.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="user-nav-avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
      ) : <span className="user-nav-icon" aria-hidden="true"><MaterialIcon name={user ? "account_circle" : "person"} /></span>}<div className="account-menu-identity"><strong>{user?.name ?? t(loading ? "account.loading" : expired ? "account.expired" : "user.signedOut")}</strong>{user?.email ? <span className="account-menu-email">{user.email}</span> : null}</div></div>{offline ? <span>{t("account.offline")}</span> : null}</div>
      {user ? <M3eMenuItem onClick={navigate}>{t("account.details")}</M3eMenuItem> : null}
      {user ? <M3eMenuItem disabled={offline || changing} onClick={() => void logout()}>{t(changing ? "account.signingOut" : "user.logout")}</M3eMenuItem> : <M3eMenuItem disabled={offline || changing} onClick={login}>{t(expired ? "account.signInAgain" : "account.signIn")}</M3eMenuItem>}
    </M3eMenu>
  </div>;
}
