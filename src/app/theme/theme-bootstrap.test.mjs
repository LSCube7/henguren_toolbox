import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { defaultThemeSeed } from "../../lib/theme-presets.ts";
import { themeSettingsKey, themeStyleCacheKey } from "./theme-cache.ts";

const require = createRequire(import.meta.url);
const typescript = require("typescript");
const source = await readFile(new URL("./theme-bootstrap.ts", import.meta.url), "utf8");
const compiledSource = typescript.transpileModule(source, {
  compilerOptions: {
    module: typescript.ModuleKind.CommonJS,
    target: typescript.ScriptTarget.ES2022
  }
}).outputText;

function loadThemeBootstrapScript() {
  const compiledModule = { exports: {} };
  const dependencies = {
    "@/lib/theme-presets": { defaultThemeSeed },
    "./theme-cache": { themeSettingsKey, themeStyleCacheKey }
  };

  vm.runInNewContext(compiledSource, {
    module: compiledModule,
    exports: compiledModule.exports,
    require(specifier) {
      if (!(specifier in dependencies)) throw new Error(`Unexpected import: ${specifier}`);
      return dependencies[specifier];
    }
  }, { filename: "theme-bootstrap.ts" });

  return compiledModule.exports.themeBootstrapScript;
}

function createBrowserHarness({ settings, cache, prefersDark = false, storageThrows = false } = {}) {
  const storage = new Map();
  if (settings !== undefined) storage.set(themeSettingsKey, JSON.stringify(settings));
  if (cache !== undefined) storage.set(themeStyleCacheKey, JSON.stringify(cache));

  const properties = new Map();
  const pendingTimers = new Map();
  let nextTimerId = 1;
  const root = {
    dataset: { themePending: "true" },
    style: {
      colorScheme: "",
      setProperty(name, value) {
        properties.set(name, value);
      }
    },
    removeAttribute(name) {
      if (name === "data-theme-pending") delete this.dataset.themePending;
    }
  };
  const browserWindow = {
    matchMedia(query) {
      assert.equal(query, "(prefers-color-scheme: dark)");
      return { matches: prefersDark };
    },
    setTimeout(callback, delay) {
      const timerId = nextTimerId++;
      pendingTimers.set(timerId, { callback, delay });
      return timerId;
    },
    clearTimeout(timerId) {
      pendingTimers.delete(timerId);
    }
  };
  const localStorage = {
    getItem(key) {
      if (storageThrows) throw new Error("Storage is unavailable");
      return storage.get(key) ?? null;
    }
  };

  vm.runInNewContext(loadThemeBootstrapScript(), {
    document: { documentElement: root },
    localStorage,
    window: browserWindow
  });

  return { pendingTimers, properties, root };
}

test("applies matching saved dark theme styles before the fallback timer", () => {
  const seed = "#2f6f4e";
  const harness = createBrowserHarness({
    settings: { colorMode: "dark", themeSeedColor: seed },
    cache: {
      seed,
      mode: "dark",
      properties: {
        "--md-sys-color-primary": "#2f6f4e",
        "--other-library-color": "#ffffff",
        "--md-sys-motion-spring-fast-spatial": "0s linear",
        "--md-sys-color-on-primary": 42
      }
    }
  });

  assert.equal(harness.root.dataset.theme, "dark");
  assert.equal(harness.root.style.colorScheme, "dark");
  assert.deepEqual([...harness.properties], [["--md-sys-color-primary", "#2f6f4e"]]);
  assert.equal(harness.root.dataset.themePending, undefined);
  assert.equal(harness.pendingTimers.size, 0);
});

test("resolves system color mode from the operating system preference", () => {
  for (const [prefersDark, expectedMode] of [[false, "light"], [true, "dark"]]) {
    const harness = createBrowserHarness({
      settings: { colorMode: "system", themeSeedColor: defaultThemeSeed },
      prefersDark
    });

    assert.equal(harness.root.dataset.theme, expectedMode);
    assert.equal(harness.root.style.colorScheme, expectedMode);
    assert.equal(harness.root.dataset.themePending, "true");
  }
});

test("does not apply cached styles when the seed or mode differs", () => {
  const seed = "#2f6f4e";
  const mismatchCases = [
    {
      settings: { colorMode: "dark", themeSeedColor: seed },
      cache: { seed: "#006a97", mode: "dark", properties: { "--md-sys-color-primary": "#006a97" } },
      expectedMode: "dark"
    },
    {
      settings: { colorMode: "light", themeSeedColor: seed },
      cache: { seed, mode: "dark", properties: { "--md-sys-color-primary": "#2f6f4e" } },
      expectedMode: "light"
    }
  ];

  for (const scenario of mismatchCases) {
    const harness = createBrowserHarness(scenario);

    assert.equal(harness.root.dataset.theme, scenario.expectedMode);
    assert.equal(harness.properties.size, 0);
    assert.equal(harness.root.dataset.themePending, "true");
    assert.equal(harness.pendingTimers.size, 1);
  }
});

test("survives storage errors and clears pending state when the fallback timer fires", () => {
  assert.doesNotThrow(() => {
    const harness = createBrowserHarness({ storageThrows: true });
    assert.equal(harness.root.dataset.themePending, "true");
    assert.equal(harness.pendingTimers.size, 1);

    const [[timerId, timer]] = harness.pendingTimers;
    assert.equal(timer.delay, 3000);
    harness.pendingTimers.delete(timerId);
    timer.callback();
    assert.equal(harness.root.dataset.themePending, undefined);
  });
});
