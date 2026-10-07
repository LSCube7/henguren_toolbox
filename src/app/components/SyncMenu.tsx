"use client";
import { M3eCard } from "@m3e/react/card";
import { M3eIconButton } from "@m3e/react/icon-button";
import { focusWhenReady } from "@m3e/web/core";
import { createPortal } from "react-dom";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
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


const subscribeClient = () => () => {};

export function SyncMenu({ onOpen }: { onOpen?: () => void }) {
  const sync = useLearningSync();
  const { t } = useI18n();
  const pathname = usePathname();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const mounted = useSyncExternalStore(subscribeClient, () => true, () => false);
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
  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (!restoreFocus) return;
    const anchor = window.matchMedia("(max-width: 899px)").matches
      ? document.querySelector<HTMLElement>(".mobile-menu") : trigger.current;
    anchor?.focus();
  }, []);

  useEffect(() => {
    const element = panel.current;
    if (!open || !element) return;
    // A manual popover stays open underneath the overwrite confirmation dialog.
    element.showPopover();
    const position = () => {
      const mobile = window.matchMedia("(max-width: 899px)").matches;
      const anchor = mobile ? document.querySelector<HTMLElement>(".mobile-menu") : trigger.current;
      if (!anchor) return;
      const bounds = anchor.getBoundingClientRect();
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const left = mobile ? 16 : bounds.right + 12;
      const top = mobile ? bounds.bottom + 12 : bounds.bottom - height;
      element.style.left = `${Math.max(16, Math.min(left, window.innerWidth - width - 16))}px`;
      element.style.top = `${Math.max(16, Math.min(top, window.innerHeight - height - 16))}px`;
    };
    position();
    const navigation = trigger.current?.closest("m3e-drawer-container");
    let active = true;
    const focusPanel = () => queueMicrotask(() => {
      if (active) void focusWhenReady(element, 1000);
    });
    // Wait until the drawer releases its focus trap before focusing the popover.
    if (navigation) void navigation.updateComplete.then(focusPanel);
    else focusPanel();
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || element.contains(event.target) || trigger.current?.contains(event.target)) return;
      // A modal confirmation owns dismissal while it is open.
      if (element.querySelector("m3e-dialog[open]")) return;
      close(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || element.querySelector("m3e-dialog[open]")) return;
      event.preventDefault();
      close();
    };
    const observer = new ResizeObserver(position);
    observer.observe(element);
    window.addEventListener("resize", position);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      active = false;
      observer.disconnect();
      window.removeEventListener("resize", position);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      if (element.matches(":popover-open")) element.hidePopover();
    };
  }, [open, mounted, close]);

  return <>
    <button ref={trigger} type="button" className="rail-action" data-status={status} aria-label={title} title={title} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => open ? close() : show()}><MaterialIcon name={syncStatusIcon[status]} /></button>
    {mounted && createPortal(
      <section ref={panel} id={id} className="sync-settings-popover" popover="manual" role="dialog" aria-modal="false" aria-labelledby={id + "-title"} tabIndex={-1}>
        <M3eCard variant="elevated">
          <div slot="content" className="sync-settings-popover-content">
            <div className="theme-preset-panel-title">
              <h2 id={id + "-title"}>{t("sync.panel.title")}</h2>
              <M3eIconButton aria-label={t("common.close")} onClick={() => close()}><MaterialIcon name="close" /></M3eIconButton>
            </div>
            <LearningSyncPanel />
          </div>
        </M3eCard>
      </section>, document.body)}
  </>;
}
