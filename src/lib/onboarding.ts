"use client";

import { parseOnboardingCloudChoice, type OnboardingCloudChoice } from "./onboarding-cloud-choice";
import type { ToolboxSettings } from "./types";

export { parseOnboardingCloudChoice, type OnboardingCloudChoice } from "./onboarding-cloud-choice";

export type OnboardingState = {
  completed: boolean;
  version: 1;
  completedAt?: string;
};

export const onboardingStorageKey = "henguren-v3-onboarding";
export const onboardingStepStorageKey = "henguren-v3-onboarding-step";
export const onboardingLoginDecisionStorageKey = "henguren-v3-onboarding-login-decision";
export const onboardingCloudChoiceStorageKey = "henguren-v3-onboarding-cloud-choice";
export const onboardingChangeEvent = "henguren-onboarding-change";

export function readOnboardingCloudChoice(fallbackSettings: ToolboxSettings) {
  if (typeof window === "undefined") return null;
  return parseOnboardingCloudChoice(sessionStorage.getItem(onboardingCloudChoiceStorageKey), fallbackSettings);
}

export function writeOnboardingCloudChoice(choice: OnboardingCloudChoice) {
  sessionStorage.setItem(onboardingCloudChoiceStorageKey, JSON.stringify(choice));
}

export function clearOnboardingCloudChoice() {
  sessionStorage.removeItem(onboardingCloudChoiceStorageKey);
}

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
  clearOnboardingCloudChoice();
  window.dispatchEvent(new Event(onboardingChangeEvent));
}

export function restartOnboarding() {
  localStorage.removeItem(onboardingStorageKey);
  sessionStorage.removeItem(onboardingStepStorageKey);
  sessionStorage.removeItem(onboardingLoginDecisionStorageKey);
  clearOnboardingCloudChoice();
  window.dispatchEvent(new Event(onboardingChangeEvent));
}
