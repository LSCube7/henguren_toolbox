"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useEffect, useSyncExternalStore } from "react";
import { onboardingChangeEvent, readOnboardingState } from "@/lib/onboarding";
import { useI18n } from "../i18n/AppI18nProvider";

function subscribeToOnboarding(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(onboardingChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(onboardingChangeEvent, onStoreChange);
  };
}

function encodeReturnPath(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const completed = useSyncExternalStore(
    subscribeToOnboarding,
    () => readOnboardingState().completed,
    () => false
  );
  const { t } = useI18n();

  useEffect(() => {
    if (completed || pathname === "/onboarding") return;
    const returnTo = encodeURIComponent(encodeReturnPath(pathname, searchParams));
    router.replace(`/onboarding?returnTo=${returnTo}` as Route);
  }, [completed, pathname, router, searchParams]);

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
