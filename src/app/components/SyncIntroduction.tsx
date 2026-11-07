"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLearningSync } from "@/lib/client-auto-sync";
import { currentLearningOwner } from "@/lib/client-learning-storage";
import { accountLearningOwner } from "@/lib/learning-ownership";
import { guideExitPath, shouldShowSyncIntroduction } from "@/lib/guide";
import { isOnline } from "@/lib/offline-cache";
import { FeatureTour, type FeatureTourStep } from "./FeatureTour";
import { useI18n } from "../i18n/AppI18nProvider";
import { useSnackbar } from "./Snackbar";

const syncSteps: readonly FeatureTourStep[] = [
  { id: "sync-panel", target: '[data-tour="sync-panel"]', title: "guide.syncPanel.title", description: "guide.syncPanel.description" },
  { id: "auto-sync", target: '[data-tour="sync-panel"] [data-tour="auto-sync"]', title: "guide.autoSync.title", description: "guide.autoSync.description" }
];

export function SyncIntroduction({ open, onOpen, onClose }: { open: boolean; onOpen: () => void; onClose: () => void }) {
  const sync = useLearningSync();
  const { t } = useI18n();
  const { showSnackbar } = useSnackbar();
  const userId = sync.summary?.user?.id;
  const [requested, setRequested] = useState(false);
  const [ready, setReady] = useState(false);
  const attemptedAccount = useRef<string | undefined>(undefined);
  const eligible = shouldShowSyncIntroduction({
    enabled: sync.enabled, introductionSeen: sync.introductionSeen, online: isOnline(),
    userId, owner: currentLearningOwner(), source: sync.summary?.source, status: sync.summary?.status
  });

  useEffect(() => {
    if (!eligible || !userId || requested || attemptedAccount.current === userId) return;
    let active = true;
    const start = () => {
      if (!active || attemptedAccount.current === userId || document.visibilityState !== "visible") return;
      let focused = document.activeElement;
      while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;
      if (focused?.matches('input,textarea,select,[role="textbox"],m3e-select')
        || (focused instanceof HTMLElement && focused.isContentEditable)) return;
      if (document.querySelector(".feature-tour") || guideExitPath(new URL(window.location.href))) return;
      // Do not interrupt another tour, a form, or an overwrite confirmation.
      const blockingSurface = Array.from(document.querySelectorAll('dialog[open],m3e-dialog[open],[popover]:popover-open'))
        .some((element) => !element.matches('.sync-settings-drawer-dialog,[data-tour="sync-panel"]'));
      if (blockingSurface) return;
      attemptedAccount.current = userId;
      setRequested(true);
      onOpen();
    };
    const observer = new MutationObserver(start);
    const focusChanged = () => queueMicrotask(start);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    document.addEventListener("visibilitychange", start);
    document.addEventListener("toggle", start, true);
    document.addEventListener("focusout", focusChanged, true);
    start();
    return () => {
      active = false;
      observer.disconnect();
      document.removeEventListener("visibilitychange", start);
      document.removeEventListener("toggle", start, true);
      document.removeEventListener("focusout", focusChanged, true);
    };
  }, [eligible, onOpen, requested, userId]);

  useEffect(() => {
    if (!requested || !open || !eligible) return;
    let frame = 0;
    let previous: DOMRect | undefined;
    let settledFrames = 0;
    const waitForPanel = () => {
      const panel = document.querySelector<HTMLElement>('[data-tour="sync-panel"]');
      const bounds = panel?.getBoundingClientRect();
      if (bounds && bounds.width > 0 && bounds.height > 0 && bounds.right > 0 && bounds.left < window.innerWidth) {
        const settled = previous && Math.abs(bounds.left - previous.left) < 0.1 && Math.abs(bounds.top - previous.top) < 0.1
          && Math.abs(bounds.width - previous.width) < 0.1 && Math.abs(bounds.height - previous.height) < 0.1;
        settledFrames = settled ? settledFrames + 1 : 0;
        previous = bounds;
        if (settledFrames >= 2) { setReady(true); return; }
      }
      frame = requestAnimationFrame(waitForPanel);
    };
    frame = requestAnimationFrame(waitForPanel);
    return () => cancelAnimationFrame(frame);
  }, [eligible, open, requested]);

  function finish() {
    setRequested(false);
    setReady(false);
    if (userId && currentLearningOwner() === accountLearningOwner(userId)) {
      void sync.markIntroductionSeen().catch(() => showSnackbar(t("sync.guide.saveError"), "error"));
    }
    onClose();
  }

  // Escape the closed navigation drawer's inert subtree on small screens.
  return requested && open && ready && eligible ? createPortal(<FeatureTour steps={syncSteps} onClose={finish} />, document.body) : null;
}
