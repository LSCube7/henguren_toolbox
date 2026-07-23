"use client";

export type OnboardingState = {
  completed: boolean;
  version: 1;
  completedAt?: string;
};

export const onboardingStorageKey = "henguren-v3-onboarding";
export const onboardingStepStorageKey = "henguren-v3-onboarding-step";
export const onboardingLoginDecisionStorageKey = "henguren-v3-onboarding-login-decision";
export const onboardingChangeEvent = "henguren-onboarding-change";

export function readOnboardingState(): OnboardingState {
  if (typeof window === "undefined") return { completed: false, version: 1 };
  try {
    const saved = localStorage.getItem(onboardingStorageKey);
    if (!saved) return { completed: false, version: 1 };
    const parsed = JSON.parse(saved) as Partial<OnboardingState>;
    return {
      completed: Boolean(parsed.completed),
      version: 1,
      completedAt: parsed.completedAt
    };
  } catch {
    return { completed: false, version: 1 };
  }
}

export function completeOnboarding() {
  const state: OnboardingState = {
    completed: true,
    version: 1,
    completedAt: new Date().toISOString()
  };
  localStorage.setItem(onboardingStorageKey, JSON.stringify(state));
  sessionStorage.removeItem(onboardingStepStorageKey);
  sessionStorage.removeItem(onboardingLoginDecisionStorageKey);
  window.dispatchEvent(new Event(onboardingChangeEvent));
}

export function restartOnboarding() {
  localStorage.removeItem(onboardingStorageKey);
  sessionStorage.removeItem(onboardingStepStorageKey);
  sessionStorage.removeItem(onboardingLoginDecisionStorageKey);
  window.dispatchEvent(new Event(onboardingChangeEvent));
}
