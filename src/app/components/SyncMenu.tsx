"use client";
import { M3eButton } from "@m3e/react/button";
import { Dialog } from "./Dialog";
import type { M3eDialogElement } from "@m3e/react/dialog";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
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
  const [open, setOpen] = useState(false);
  const status: SyncStatus | "pending" = sync.status === "idle" ? sync.summary?.status ?? "signed-out" : sync.status;
  const title = t("nav.syncSettings") + " · " + t(syncStatusLabel[status]);
  const show = useCallback(() => {
    setOpen(true);
    onOpen?.();
  }, [onOpen]);
  useEffect(() => {
    const legacy = () => { if (window.location.hash === "#wrongbook-sync") show(); };
    window.addEventListener("hashchange", legacy);
    const task = window.setTimeout(legacy, 0);
    return () => { window.clearTimeout(task); window.removeEventListener("hashchange", legacy); };
  }, [pathname, show]);
  function handlePanelKeyDown(event: KeyboardEvent<M3eDialogElement>) {
    // Let a nested confirmation handle its own Escape without closing this dialog.
    const nested = event.target instanceof Element ? event.target.closest("m3e-dialog") : null;
    if (event.key !== "Escape" || event.shiftKey || event.ctrlKey ||
      (nested && nested !== event.currentTarget && event.currentTarget.contains(nested))) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
  }
  function handleClosed() {
    setOpen(false);
    if (window.matchMedia("(max-width: 899px)").matches) document.querySelector<HTMLElement>(".mobile-menu")?.focus();
    else trigger.current?.focus();
  }
  return <>
    <button ref={trigger} type="button" className="rail-action" data-status={status} aria-label={title} title={title} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={show}><MaterialIcon name={syncStatusIcon[status]} /></button>
    <Dialog id={id} className="sync-settings-dialog" open={open} aria-labelledby={id + "-title"}
      onKeyDownCapture={handlePanelKeyDown} onCancel={() => setOpen(false)} onClosed={handleClosed}>
      <h2 slot="header" id={id + "-title"}>{t("sync.panel.title")}</h2>
      <LearningSyncPanel />
      <div slot="actions"><M3eButton variant="text" onClick={() => setOpen(false)}>{t("common.close")}</M3eButton></div>
    </Dialog>
  </>;
}
