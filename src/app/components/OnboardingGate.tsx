"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

function encodeReturnPath(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const completed = useSyncExternalStore(subscribeToOnboarding, getOnboardingCompleted, getServerOnboardingCompleted);
  const { locale, t } = useI18n();
  const returnPath = encodeReturnPath(pathname, searchParams);
  const logicalPath = stripLocalePrefix(pathname);

  useEffect(() => {
    if (completed || logicalPath === "/onboarding") return;
    const returnTo = encodeURIComponent(returnPath);
    router.replace(localizePath(locale, `/onboarding?returnTo=${returnTo}`) as Route);
  }, [completed, logicalPath, locale, returnPath, router]);

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
