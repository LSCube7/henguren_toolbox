import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const origin = "https://example.test";

function absoluteUrl(value) {
  return new URL(typeof value === "string" ? value : value.url, origin).href;
}

class MemoryCache {
  constructor(fetchResponse, entries = []) {
    this.fetchResponse = fetchResponse;
    this.entries = new Map(entries.map(([request, response]) => [absoluteUrl(request), response]));
  }

  async addAll(requests) {
    await Promise.all(
      requests.map(async (request) => {
        const response = await this.fetchResponse(request);
        if (!response.ok) throw new Error(`Could not cache ${absoluteUrl(request)}`);
        await this.put(request, response);
      })
    );
  }

  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }

  async match(request) {
    return this.entries.get(absoluteUrl(request))?.clone();
  }

  async put(request, response) {
    this.entries.set(absoluteUrl(request), response.clone());
  }
}

async function loadServiceWorker(networkFetch) {
  const listeners = new Map();
  let claimed = false;

  async function fetchResponse(request) {
    const url = new URL(absoluteUrl(request));
    if (url.pathname === "/_next/static/app.css") return new Response("@font-face { src: url('/fonts/icons.woff2'); }");
    if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/")) return new Response("asset");
    return new Response('<link rel="stylesheet" href="/_next/static/app.css"><script src="/_next/static/app.js"></script>', {
      headers: { "Content-Type": "text/html" }
    });
  }

  const network = networkFetch ?? fetchResponse;

  const cachesByName = new Map([
    ["henguren-v3-offline-v1-data", new MemoryCache(fetchResponse, [["/api/data/vocab/sample", new Response("cached lesson")]])],
    ["henguren-v3-offline-v2-app", new MemoryCache(fetchResponse)],
    ["henguren-v3-offline-v2-static", new MemoryCache(fetchResponse)]
  ]);
  const cacheStorage = {
    async keys() {
      return [...cachesByName.keys()];
    },
    async open(name) {
      if (!cachesByName.has(name)) cachesByName.set(name, new MemoryCache(fetchResponse));
      return cachesByName.get(name);
    },
    async delete(name) {
      return cachesByName.delete(name);
    }
  };
  const serviceWorkerGlobal = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    clients: {
      async claim() {
        claimed = true;
      }
    },
    location: new URL(origin),
    skipWaiting: async () => undefined
  };
  const context = vm.createContext({ caches: cacheStorage, console, fetch: network, Request, Response, self: serviceWorkerGlobal, Set, URL });
  const source = await readFile(new URL("../../public/sw.js", import.meta.url), "utf8");
  vm.runInContext(source, context);

  return { cachesByName, listeners, wasClaimed: () => claimed };
}

function runExtendableEvent(listener) {
  let promise;
  listener({ waitUntil(value) { promise = value; } });
  return promise;
}

function runFetchEvent(listener, request) {
  let responsePromise;
  listener({
    request,
    respondWith(value) {
      responsePromise = value;
    }
  });
  return responsePromise;
}

test("precaches current shell assets and migrates legacy learning data", async () => {
  const worker = await loadServiceWorker();

  await runExtendableEvent(worker.listeners.get("install"));
  const appCache = worker.cachesByName.get("henguren-v3-offline-v3-app");
  assert.ok(await appCache.match("/zh-CN"));
  assert.ok(await appCache.match("/en-US/settings"));
  assert.ok(await appCache.match("/vocab"));
  const staticCache = worker.cachesByName.get("henguren-v3-offline-v3-static");
  assert.ok(await staticCache.match("/_next/static/app.js"));
  assert.ok(await staticCache.match("/_next/static/app.css"));
  assert.ok(await staticCache.match("/fonts/icons.woff2"));

  await runExtendableEvent(worker.listeners.get("activate"));
  const dataCache = worker.cachesByName.get("henguren-v3-offline-v2-data");
  assert.equal(await (await dataCache.match("/api/data/vocab/sample")).text(), "cached lesson");
  assert.equal(worker.cachesByName.has("henguren-v3-offline-v1-data"), false);
  assert.equal(worker.cachesByName.has("henguren-v3-offline-v2-app"), false);
  assert.equal(worker.cachesByName.has("henguren-v3-offline-v2-static"), false);
  assert.equal(worker.wasClaimed(), true);
});

test("serves a cached pathname for an offline query navigation", async () => {
  const worker = await loadServiceWorker(async () => {
    throw new Error("offline");
  });

  await runExtendableEvent(worker.listeners.get("install"));
  const response = await runFetchEvent(worker.listeners.get("fetch"), {
    method: "GET",
    mode: "navigate",
    destination: "document",
    url: `${origin}/zh-CN/settings?tab=theme#colors`
  });

  assert.ok(response);
  assert.equal(response.ok, true);
});
