"use client";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { useLearningSync } from "@/lib/client-auto-sync";
import { currentLearningOwner } from "@/lib/client-learning-storage";
import { logoutAccount } from "@/lib/client-account";
import { localizePath } from "@/lib/localized-routing";
import { useI18n } from "../i18n/AppI18nProvider";
import { useSnackbar } from "./Snackbar";
import { MaterialIcon } from "./MaterialIcon";

export function AccountMenu({ onNavigate }: { onNavigate?: () => void }) {
  const sync = useLearningSync();
  const user = sync.summary?.user;
  const { locale, t } = useI18n();
  const { showSnackbar } = useSnackbar();
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();
  const menu = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const offline = sync.status === "offline" || sync.summary?.status === "offline";
  const expired = sync.error === "UNAUTHORIZED" || (!user && sync.summary?.status === "signed-out" && currentLearningOwner().startsWith("account:"));
  const loading = !sync.summary;
  useEffect(() => {
    const element = menu.current;
    const closed = () => setOpen(false);
    element?.addEventListener("closed", closed);
    return () => element?.removeEventListener("closed", closed);
  }, []);
  function navigate() {
    setOpen(false);
    router.push(localizePath(locale, "/user") as Route);
    onNavigate?.();
  }
  function login() {
    if (offline || loading) return;
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
    <button ref={trigger} id={id} type="button" className="user-nav-card" aria-label={t("account.menu")} title={t("account.menu")} aria-haspopup="menu" aria-expanded={open} aria-controls={id + "-menu"} disabled={changing} onClick={() => setOpen(!open)} onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); } if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); } }}>
      {user?.avatarUrl ? (
        // OAuth avatars use the original URL and no-referrer, matching the existing rail.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="user-nav-avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />) : <span className="user-nav-icon" aria-hidden="true"><MaterialIcon name={user ? "account_circle" : "person"} /></span>}
    </button>
    <md-menu aria-hidden={!open} ref={menu} id={id + "-menu"} anchor={id} open={open} positioning="popover" anchor-corner="start-end" menu-corner="end-start" aria-label={t("account.menu")}>
      <div className="account-menu-heading" role="presentation"><div className="account-menu-profile">{user?.avatarUrl ? (
        // Match the rail avatar's no-referrer policy without proxying account images.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="user-nav-avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
      ) : <span className="user-nav-icon" aria-hidden="true"><MaterialIcon name={user ? "account_circle" : "person"} /></span>}<div className="account-menu-identity"><strong>{user?.name ?? t(loading ? "account.loading" : expired ? "account.expired" : "user.signedOut")}</strong>{user?.email ? <span className="account-menu-email">{user.email}</span> : null}</div></div>{offline ? <span>{t("account.offline")}</span> : null}</div>
      {user ? <md-menu-item md-menu-item="" tabIndex={-1} onClick={navigate}><span slot="headline">{t("account.details")}</span></md-menu-item> : null}
      {user ? <md-menu-item md-menu-item="" tabIndex={-1} disabled={offline || changing} onClick={() => void logout()}><span slot="headline">{t(changing ? "account.signingOut" : "user.logout")}</span></md-menu-item> : <md-menu-item md-menu-item="" tabIndex={-1} disabled={offline || loading} onClick={login}><span slot="headline">{t(expired ? "account.signInAgain" : "account.signIn")}</span></md-menu-item>}
    </md-menu>
  </div>;
}
