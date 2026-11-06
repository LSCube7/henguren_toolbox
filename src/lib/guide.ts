import { stripLocalePrefix } from "./localized-routing.ts";

export const guideStorageKey = "henguren-v3-guide";
export const guideChangeEvent = "henguren-guide-change";

export function isWelcomeDismissed(value: string | null, onboardingValue: string | null): boolean {
  try {
    if (onboardingValue && JSON.parse(onboardingValue)?.completed === true) return true;
  } catch { /* An invalid legacy value must not block the toolbox. */ }
  try {
    const state = value ? JSON.parse(value) : null;
    return state?.version === 1 && state?.welcomeDismissed === true;
  } catch {
    return false;
  }
}

export const desktopGuideSteps = ["edition", "tools", "settings", "account"] as const;
export const mobileGuideSteps = ["edition", "tools", "menu"] as const;
/** Only clear a tour request while still on home; preserve history destinations. */
export function guideExitPath(url: URL): string | null {
  if (stripLocalePrefix(url.pathname) !== "/" || url.searchParams.get("tour") !== "1") return null;
  const next = new URL(url);
  next.searchParams.delete("tour");
  return `${next.pathname}${next.search}${next.hash}`;
}

type Rect = { top: number; bottom: number; left: number; right: number };

/** Keep the bubble inside the visible viewport, preferring space below its target. */
export function placeGuideBubble(target: Rect, bubble: { width: number; height: number }, viewport: { width: number; height: number; left?: number; top?: number }) {
  const margin = 16;
  const gap = 16;
  const minTop = (viewport.top ?? 0) + margin;
  const minLeft = (viewport.left ?? 0) + margin;
  const maxTop = (viewport.top ?? 0) + viewport.height - bubble.height - margin;
  const maxLeft = (viewport.left ?? 0) + viewport.width - bubble.width - margin;
  const below = target.bottom + gap;
  const above = target.top - gap - bubble.height;
  const top = below <= maxTop ? below : above >= minTop ? above : minTop;
  return {
    top: Math.max(minTop, Math.min(top, maxTop)),
    left: Math.max(minLeft, Math.min(target.left, maxLeft))
  };
}
