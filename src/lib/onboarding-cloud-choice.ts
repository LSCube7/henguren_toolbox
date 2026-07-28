import { normalizeToolboxSettings, type ToolboxSettings } from "./types.ts";

export type OnboardingCloudChoice = {
  version: 1;
  userId: string;
  decision: "cloud" | "local";
  localSettings: ToolboxSettings;
};

export function parseOnboardingCloudChoice(value: string | null, fallbackSettings: ToolboxSettings): OnboardingCloudChoice | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<OnboardingCloudChoice>;
    if (
      parsed.version !== 1
      || typeof parsed.userId !== "string"
      || !parsed.userId
      || (parsed.decision !== "cloud" && parsed.decision !== "local")
      || !parsed.localSettings
      || typeof parsed.localSettings !== "object"
    ) return null;
    return {
      version: 1,
      userId: parsed.userId,
      decision: parsed.decision,
      localSettings: normalizeToolboxSettings(parsed.localSettings, fallbackSettings)
    };
  } catch {
    return null;
  }
}
