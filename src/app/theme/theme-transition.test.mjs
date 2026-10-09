import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { defaultThemeSeed, resolveThemeSeed } from "../../lib/theme-presets.ts";
import { themeSettingsKey, themeStyleCacheKey } from "./theme-cache.ts";

const require = createRequire(import.meta.url);
const typescript = require("typescript");
const source = await readFile(new URL("./AppThemeProvider.tsx", import.meta.url), "utf8");
const compiled = typescript.transpileModule(source, {
  compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022, jsx: typescript.JsxEmit.ReactJSX }
}).outputText;

// Drive the provider's real event handlers with delayed View Transition callbacks.
// skipTransition deliberately leaves callbacks queued, matching the browser contract.
function harness() {
  const element = { color: defaultThemeSeed, scheme: "light", updateComplete: Promise.resolve() };
  const listeners = new Map();
  const applied = [];
  const queued = [];
  let cleanup;
  let refIndex = 0;
  let reducedMotion = false;
  const document = {
    startViewTransition(callback) {
      let done;
      let finished;
      const transition = {
        skipped: false,
        skipTransition() { this.skipped = true; },
        updateCallbackDone: new Promise((resolve) => { done = resolve; }),
        finished: new Promise((resolve) => { finished = resolve; })
      };
      queued.push(async () => { await callback(); done(); finished(); });
      return transition;
    }
  };
  const dependencies = {
    "react": {
      useRef: () => ({ current: refIndex++ === 0 ? element : null }),
      useState: (initialize) => [initialize(), (next) => {
        applied.push(next);
        element.color = resolveThemeSeed(next.themeSeedColor);
        element.scheme = next.colorMode === "system" ? "auto" : next.colorMode;
      }],
      useLayoutEffect() {},
      useEffect: (effect) => { cleanup = effect(); }
    },
    "react-dom": { flushSync: (callback) => callback() },
    "react/jsx-runtime": { jsx: () => null },
    "@m3e/react/theme": { M3eTheme: () => null },
    "@/lib/theme-presets": { defaultThemeSeed, resolveThemeSeed },
    "./theme-cache": { themeSettingsKey, themeStyleCacheKey }
  };
  const compiledModule = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: compiledModule.exports,
    require: (name) => { assert.ok(name in dependencies, name); return dependencies[name]; },
    localStorage: { getItem: () => JSON.stringify({ colorMode: "light" }) },
    window: {
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name) => listeners.delete(name),
      matchMedia: () => ({ matches: reducedMotion })
    },
    document,
    console
  });
  compiledModule.exports.AppThemeProvider({ children: null });
  return {
    applied, queued, document,
    preview: (detail) => listeners.get("henguren-theme-preview")({ detail }),
    reduce: () => { reducedMotion = true; },
    cleanup: () => cleanup()
  };
}

test("returning to the current theme invalidates the skipped callback", async () => {
  const h = harness();
  h.preview({ colorMode: "dark" });
  h.preview({ colorMode: "light" });
  await h.queued[0]();
  assert.deepEqual(h.applied.map((theme) => theme.colorMode), ["light"]);
});

test("only the latest queued palette is applied after previews are skipped", async () => {
  const h = harness();
  h.preview({ themeSeedColor: "#ff0000" });
  h.preview({ themeSeedColor: "#0000ff" });
  await h.queued[1]();
  await h.queued[0]();
  assert.deepEqual(h.applied.map((theme) => theme.themeSeedColor), ["#0000ff"]);
});

for (const fallback of ["reduced motion", "unsupported API"]) {
  test(`${fallback} updates also invalidate prior queued callbacks`, async () => {
    const h = harness();
    h.preview({ colorMode: "dark" });
    if (fallback === "reduced motion") h.reduce();
    else h.document.startViewTransition = undefined;
    h.preview({ themeSeedColor: "#0000ff" });
    await h.queued[0]();
    assert.equal(h.applied.length, 1);
    assert.equal(h.applied[0].themeSeedColor, "#0000ff");
  });
}

test("unmount invalidates pending theme updates", async () => {
  const h = harness();
  h.preview({ colorMode: "dark" });
  h.cleanup();
  await h.queued[0]();
  assert.equal(h.applied.length, 0);
});
