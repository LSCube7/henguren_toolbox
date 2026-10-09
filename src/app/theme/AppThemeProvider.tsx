"use client";

import { M3eTheme, type M3eThemeElement } from "@m3e/react/theme";
import { defaultThemeSeed, resolveThemeSeed } from "@/lib/theme-presets";
import { flushSync } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { themeSettingsKey, themeStyleCacheKey, type CachedThemeStyle } from "./theme-cache";

type StoredTheme = {
  themePreset?: string;
  themeSeedColor?: string;
  colorMode?: "light" | "dark" | "system";
};

function getStoredTheme(): StoredTheme {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(themeSettingsKey);
    const parsed: unknown = saved ? JSON.parse(saved) : {};
    return parsed && typeof parsed === "object" ? parsed as StoredTheme : {};
  } catch {
    // Storage is optional: private browsing still has a usable default theme.
    return {};
  }
}

/** Cache M3eTheme's output for first paint; never generate a second palette. */
function cacheTheme(element: M3eThemeElement) {
  const root = document.documentElement;
  // Bootstrap's inline snapshot must yield to M3eTheme's adopted stylesheet.
  for (const name of Array.from(root.style)) {
    if (name.startsWith("--md-sys-color-")) root.style.removeProperty(name);
  }
  const computed = getComputedStyle(root);
  const properties: Record<string, string> = {};
  for (const name of Array.from(computed)) {
    if (name.startsWith("--md-sys-color-")) properties[name] = computed.getPropertyValue(name).trim();
  }
  const mode = element.isDark ? "dark" : "light";
  root.dataset.theme = mode;
  const cache: CachedThemeStyle = { seed: element.color.toLowerCase(), mode, properties };
  try {
    localStorage.setItem(themeStyleCacheKey, JSON.stringify(cache));
  } catch {
    // Theme application does not depend on persisting its paint cache.
  }
  root.removeAttribute("data-theme-pending");
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const themeRef = useRef<M3eThemeElement>(null);
  const transitionRef = useRef<ViewTransition | null>(null);
  // These non-reflected Lit properties do not change the server's HTML markup.
  const [theme, setTheme] = useState<StoredTheme>(() => getStoredTheme());

  useLayoutEffect(() => {
    const element = themeRef.current;
    if (!element) return;
    const scheme = theme.colorMode === "light" || theme.colorMode === "dark" ? theme.colorMode : "auto";
    // M3E 2.9's top-level auto resolver honors inline color-scheme first.
    // Release bootstrap's fixed paint mode before it computes the auto scheme.
    document.documentElement.style.colorScheme = scheme === "auto" ? "light dark" : scheme;
    element.color = resolveThemeSeed(theme.themeSeedColor);
    element.scheme = scheme;
    element.requestUpdate();
    let active = true;
    void element.updateComplete.then(() => { if (active) cacheTheme(element); });
    return () => { active = false; };
  }, [theme]);

  useEffect(() => {
    function updateTheme(next: StoredTheme) {
      const element = themeRef.current;
      const seed = resolveThemeSeed(next.themeSeedColor);
      const scheme = next.colorMode === "light" || next.colorMode === "dark" ? next.colorMode : "auto";
      const changed = element && (element.color !== seed || element.scheme !== scheme);
      transitionRef.current?.skipTransition();
      if (!changed || !document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setTheme(next);
        return;
      }
      // Capture the old palette before React/Lit apply the new one, then wait
      // for M3E's stylesheet before capturing the new palette.
      const transition = document.startViewTransition(async () => {
        flushSync(() => setTheme(next));
        await element.updateComplete;
      });
      transitionRef.current = transition;
      void transition.updateCallbackDone.catch(() => {
        console.error("Theme transition update failed: THEME_UPDATE_FAILED");
      });
      void transition.finished.catch(() => {
        // Skipping an animation is expected during rapid theme previews.
      }).finally(() => {
        if (transitionRef.current === transition) transitionRef.current = null;
      });
    }
    const refresh = () => updateTheme(getStoredTheme());
    const preview = (event: Event) => updateTheme({ ...getStoredTheme(), ...(event as CustomEvent<StoredTheme>).detail });
    window.addEventListener("storage", refresh);
    window.addEventListener("henguren-theme-change", refresh);
    window.addEventListener("henguren-theme-preview", preview);
    return () => {
      transitionRef.current?.skipTransition();
      window.removeEventListener("storage", refresh);
      window.removeEventListener("henguren-theme-change", refresh);
      window.removeEventListener("henguren-theme-preview", preview);
    };
  }, []);

  return <M3eTheme ref={themeRef} color={resolveThemeSeed(theme.themeSeedColor || defaultThemeSeed)}
    scheme={theme.colorMode === "light" || theme.colorMode === "dark" ? theme.colorMode : "auto"}
    motion="expressive" density={0} strongFocus contrast="standard" variant="tonal-spot"
    onChange={(event) => { if (event.target === themeRef.current && themeRef.current) cacheTheme(themeRef.current); }}>
    {children}
  </M3eTheme>;
}
