import { defaultThemeSeed } from "@/lib/theme-presets";
import { themeSettingsKey, themeStyleCacheKey } from "./theme-cache";

export const themeBootstrapScript = `(() => {
  const root = document.documentElement;
  const fallbackTimer = window.setTimeout(() => root.removeAttribute("data-theme-pending"), 3000);
  try {
    const settings = JSON.parse(localStorage.getItem(${JSON.stringify(themeSettingsKey)}) || "{}");
    const requestedMode = settings.colorMode;
    const mode = !requestedMode || requestedMode === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : requestedMode;
    const candidateSeed = typeof settings.themeSeedColor === "string" ? settings.themeSeedColor : ${JSON.stringify(defaultThemeSeed)};
    const seed = /^#[0-9a-f]{6}$/i.test(candidateSeed) ? candidateSeed.toLowerCase() : ${JSON.stringify(defaultThemeSeed)};
    const cache = JSON.parse(localStorage.getItem(${JSON.stringify(themeStyleCacheKey)}) || "null");
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
    if (cache && cache.seed === seed && cache.mode === mode && cache.properties && typeof cache.properties === "object") {
      for (const [name, value] of Object.entries(cache.properties)) {
        if (name.startsWith("--md-") && typeof value === "string") root.style.setProperty(name, value);
      }
      window.clearTimeout(fallbackTimer);
      root.removeAttribute("data-theme-pending");
    } else {
      root.dataset.themePending = "true";
    }
  } catch {
    root.dataset.themePending = "true";
  }
})();`;
