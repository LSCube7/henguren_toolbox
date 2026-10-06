"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLearningSync } from "@/lib/client-auto-sync";
import type { SyncStatus } from "@/lib/client-sync";
import type { MaterialSymbolName } from "@/generated/material-symbols";
import type { MessageKey } from "@/i18n/config";
import { useI18n } from "../i18n/AppI18nProvider";
import { MaterialIcon } from "./MaterialIcon";
import { LearningSyncPanel } from "./LearningSyncPanel";
const syncStatusLabel: Record<SyncStatus | "pending", MessageKey> = {
  "signed-out": "sync.signedOut",
  offline: "sync.offline",
  ready: "sync.ready",
  pending: "sync.pending",
  syncing: "sync.syncing",
  synced: "sync.synced",
  error: "sync.error"
};

const syncStatusIcon: Record<SyncStatus | "pending", MaterialSymbolName> = {
  "signed-out": "cloud_off",
  offline: "cloud_off",
  ready: "cloud_sync",
  pending: "cloud_sync",
  syncing: "cloud_upload",
  synced: "cloud_done",
  error: "cloud_alert"
};


export function SyncMenu({ onOpen }: { onOpen?: () => void }) {
  const sync = useLearningSync();
  const { t } = useI18n();
  const pathname = usePathname();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const status: SyncStatus | "pending" = sync.status === "idle" ? sync.summary?.status ?? "signed-out" : sync.status;
  const title = t("nav.syncSettings") + " · " + t(syncStatusLabel[status]);
  const show = useCallback(() => {
    const dialog = panel.current;
    if (!dialog || dialog.open) return;
    const bounds = trigger.current?.getBoundingClientRect();
    dialog.style.setProperty("--sync-panel-left", Math.min((bounds?.right ?? 64) + 12, Math.max(12, window.innerWidth - 372)) + "px");
    dialog.style.setProperty("--sync-panel-bottom", Math.max(12, window.innerHeight - (bounds?.bottom ?? window.innerHeight - 12)) + "px");
    dialog.showModal(); setOpen(true); onOpen?.();
  }, [onOpen]);
  useEffect(() => {
    const legacy = () => { if (window.location.hash === "#wrongbook-sync") show(); };
    window.addEventListener("hashchange", legacy);
    const task = window.setTimeout(legacy, 0);
    return () => { window.clearTimeout(task); window.removeEventListener("hashchange", legacy); };
  }, [pathname, show]);
  return <>
    <button ref={trigger} type="button" className="rail-action" data-status={status} aria-label={title} title={title} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={show}><MaterialIcon name={syncStatusIcon[status]} /></button>
    <dialog ref={panel} id={id} className="sync-menu-panel" aria-labelledby={id + "-title"} onClose={() => { setOpen(false); if (window.matchMedia("(max-width: 899px)").matches) document.querySelector<HTMLButtonElement>(".mobile-menu")?.focus(); else trigger.current?.focus(); }} onClick={(event) => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close(); } }}>
      <header className="spread"><h2 id={id + "-title"} className="section-title">{t("sync.panel.title")}</h2><md-icon-button data-aria-label={t("common.close")} onClick={() => panel.current?.close()}><MaterialIcon name="close" /></md-icon-button></header>
      <LearningSyncPanel />
    </dialog>
  </>;
}
