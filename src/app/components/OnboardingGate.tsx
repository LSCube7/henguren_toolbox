"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { useEffect, useSyncExternalStore } from "react";
import { onboardingChangeEvent, readOnboardingState } from "@/lib/onboarding";
import { useI18n } from "../i18n/AppI18nProvider";
import { localizePath, stripLocalePrefix } from "@/lib/localized-routing";

function subscribeToOnboarding(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(onboardingChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(onboardingChangeEvent, onStoreChange);
  };
}

function getOnboardingCompleted() {
  return readOnboardingState().completed;
}

function getServerOnboardingCompleted() {
  return true;
}

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const completed = useSyncExternalStore(subscribeToOnboarding, getOnboardingCompleted, getServerOnboardingCompleted);
  const { locale, t } = useI18n();
  const logicalPath = stripLocalePrefix(pathname);

  useEffect(() => {
    if (completed || logicalPath === "/onboarding") return;
    const returnTo = encodeURIComponent(`${pathname}${window.location.search}${window.location.hash}`);
    router.replace(localizePath(locale, `/onboarding?returnTo=${returnTo}`) as Route);
  }, [completed, logicalPath, locale, pathname, router]);

  return (
    <>
      <div className="onboarding-gate__content" data-ready={completed} aria-hidden={!completed}>
        {children}
      </div>
      {!completed ? (
        <div className="onboarding-gate__fallback" role="status">
          {t("onboarding.signIn.loading")}
        </div>
      ) : null}
    </>
  );
}
