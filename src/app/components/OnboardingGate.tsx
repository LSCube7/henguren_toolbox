"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useEffect, useSyncExternalStore } from "react";
import { readOnboardingState } from "@/lib/onboarding";

function subscribeNoop() {
  return () => undefined;
}

function encodeReturnPath(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

export function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  useEffect(() => {
    if (!mounted || pathname === "/onboarding") return;
    if (readOnboardingState().completed) return;
    const returnTo = encodeURIComponent(encodeReturnPath(pathname, searchParams));
    router.replace(`/onboarding?returnTo=${returnTo}` as Route);
  }, [mounted, pathname, router, searchParams]);

  return null;
}
