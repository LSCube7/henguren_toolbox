"use client";

import { M3eButton } from "@m3e/react/button";
import { useSearchParams } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";
import { guideChangeEvent, guideStorageKey, isWelcomeDismissed, guideExitPath } from "@/lib/guide";
import { onboardingChangeEvent, onboardingStorageKey } from "@/lib/onboarding";
import { FeatureTour } from "./components/FeatureTour";
import { useSnackbar } from "./components/Snackbar";
import { useI18n } from "./i18n/AppI18nProvider";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(guideChangeEvent, callback);
  window.addEventListener(onboardingChangeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(guideChangeEvent, callback);
    window.removeEventListener(onboardingChangeEvent, callback);
  };
}

function readDismissed() {
  try {
    return isWelcomeDismissed(localStorage.getItem(guideStorageKey), localStorage.getItem(onboardingStorageKey));
  } catch {
    return false;
  }
}

export function HomeWelcome() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const { t } = useI18n();
  const { showSnackbar } = useSnackbar();
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
  const [dismissedHere, setDismissedHere] = useState(false);
  const [started, setStarted] = useState(false);
  const params = useSearchParams();
  const requested = params.get("tour") === "1";

  function dismiss() {
    setDismissedHere(true);
    try {
      localStorage.setItem(guideStorageKey, JSON.stringify({ version: 1, welcomeDismissed: true }));
      window.dispatchEvent(new Event(guideChangeEvent));
    } catch {
      showSnackbar(t("guide.saveError"), "error");
    }
  }

  const close = useCallback(() => {
    setStarted(false);
    const returnPath = guideExitPath(new URL(window.location.href));
    if (returnPath) window.history.replaceState(null, "", returnPath);
  }, []);

  return (
    <>
      {!dismissed && !dismissedHere && !requested ? (
        <section className="home-welcome" aria-labelledby="home-welcome-title">
          <div className="stack">
            <h2 className="section-title" id="home-welcome-title">{t("guide.welcome.title")}</h2>
            <p className="card-description">{t("guide.welcome.description")}</p>
          </div>
          <div className="cluster">
            <M3eButton variant="filled" onClick={() => { dismiss(); setStarted(true); }}>{t("guide.start")}</M3eButton>
            <M3eButton variant="text" onClick={() => {
              dismiss();
              document.querySelector<HTMLElement>('[data-tour="edition"] m3e-button[tabindex="0"]')?.focus();
            }}>{t("guide.dismiss")}</M3eButton>
          </div>
        </section>
      ) : null}
      {mounted && (started || requested) ? <FeatureTour onClose={close} /> : null}
    </>
  );
}
