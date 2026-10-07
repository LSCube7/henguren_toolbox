"use client";
import { M3eDrawerContainer, type M3eDrawerContainerElement } from "@m3e/react/drawer-container";
import { M3eCard } from "@m3e/react/card";
import { M3eIconButton, type M3eIconButtonElement } from "@m3e/react/icon-button";
import { focusWhenReady } from "@m3e/web/core";
import { createPortal } from "react-dom";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
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

export function SyncMenu({ onOpen, expanded = false }: { onOpen?: () => void; expanded?: boolean }) {
  const sync = useLearningSync();
  const { t } = useI18n();
  const pathname = usePathname();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const mobileDialog = useRef<HTMLDialogElement>(null);
  const drawer = useRef<M3eDrawerContainerElement>(null);
  const closeButton = useRef<M3eIconButtonElement>(null);
  const mounted = useSyncExternalStore(subscribeClient, () => true, () => false);
  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
    setDrawerOpen(false);
    if (!restoreFocus) return;
    // The navigation drawer stays open underneath the sync drawer.
    const navigation = trigger.current?.closest("m3e-drawer-container");
    const anchor = window.matchMedia("(max-width: 899px)").matches && !navigation?.start
      ? document.querySelector<HTMLElement>(".mobile-menu") : trigger.current;
    if (mobileDialog.current?.open) mobileDialog.current.close();
    if (drawer.current) {
      drawer.current.start = false;
      void drawer.current.updateComplete.then(() => anchor?.focus());
    } else anchor?.focus();
  }, []);

  function handleDrawerTab(event: KeyboardEvent<M3eDrawerContainerElement>) {
    const element = panel.current;
    if (event.key !== "Tab" || event.defaultPrevented || !element || element.querySelector("m3e-dialog[open]")) return;
    const controls = Array.from(element.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea,m3e-button,m3e-icon-button,m3e-switch,[tabindex]"))
      .filter((control) => !control.closest("m3e-dialog") && control.tabIndex >= 0 && !control.matches(":disabled,[disabled]") && control.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (first && last && ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last))) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  useEffect(() => {
    const element = panel.current;
    if (!open || !element) return;
    if (expanded) {
      const dialog = mobileDialog.current;
      if (!dialog) return;
      let active = true;
      const previousOverflow = document.body.style.overflow;
      const ownsScrollLock = previousOverflow !== "hidden";
      let animationFrame = 0;
      if (ownsScrollLock) document.body.style.overflow = "hidden";
      dialog.showModal();
      // A hidden <dialog> gives M3E a zero drawer width. Wait for an actual
      // content measurement, then let its ResizeObserver settle before opening.
      const sizeObserver = new ResizeObserver((entries) => {
        if (!active || !entries.some((entry) => entry.contentRect.width > 0)) return;
        sizeObserver.disconnect();
        animationFrame = window.requestAnimationFrame(() => {
          animationFrame = window.requestAnimationFrame(() => {
            if (!active) return;
            setDrawerOpen(true);
            if (closeButton.current) void focusWhenReady(closeButton.current, 1000);
          });
        });
      });
      void drawer.current?.updateComplete.then(() => {
        if (active) sizeObserver.observe(element);
      });
      return () => {
        active = false;
        window.cancelAnimationFrame(animationFrame);
        sizeObserver.disconnect();
        if (dialog.open) dialog.close();
        if (ownsScrollLock) document.body.style.overflow = previousOverflow;
      };
    }
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
  }, [open, mounted, close, expanded]);

  const content = <>
    <div className="theme-preset-panel-title">
      <h2 id={id + "-title"}>{t("sync.panel.title")}</h2>
      <M3eIconButton ref={closeButton} aria-label={t("common.close")} onClick={() => close()}><MaterialIcon name="close" /></M3eIconButton>
    </div>
    <LearningSyncPanel />
  </>;

  return <>
    <button ref={trigger} type="button" className="rail-action" data-status={status} aria-label={title} title={title} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => open ? close() : show()}><MaterialIcon name={syncStatusIcon[status]} />{expanded && <span>{t("nav.syncSettings")}</span>}</button>
    {mounted && createPortal(expanded ?
      <dialog ref={mobileDialog} id={id} className="sync-settings-drawer-dialog" aria-labelledby={id + "-title"}
        onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }}
        onCancel={(event) => { event.preventDefault(); if (!panel.current?.querySelector("m3e-dialog[open]")) close(); }}>
        <M3eDrawerContainer ref={drawer} className="sync-settings-drawer" startMode="over" start={drawerOpen}
          onKeyDownCapture={handleDrawerTab} onChange={(event) => {
            if (event.target === drawer.current && drawer.current?.start === false && !panel.current?.querySelector("m3e-dialog[open]")) close();
          }}>
          <section ref={panel} slot="start" className="sync-settings-drawer-content">{content}</section>
        </M3eDrawerContainer>
      </dialog> :
      <section ref={panel} id={id} className="sync-settings-popover" popover="manual" role="dialog" aria-modal="false" aria-labelledby={id + "-title"} tabIndex={-1}>
        <M3eCard variant="elevated">
          <div slot="content" className="sync-settings-popover-content">{content}</div>
        </M3eCard>
      </section>, document.body)}
  </>;
}
