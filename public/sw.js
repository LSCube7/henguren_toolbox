const CACHE_PREFIX = "henguren-v3-offline";
// Increment shell and data versions independently so an app-shell update does
// not discard vocabulary or text lists that users explicitly cached offline.
const SHELL_VERSION = "v3";
// Keep this value in sync with dataCacheVersion in src/lib/offline-cache.ts.
const DATA_VERSION = "v2";
const APP_CACHE = `${CACHE_PREFIX}-${SHELL_VERSION}-app`;
const STATIC_CACHE = `${CACHE_PREFIX}-${SHELL_VERSION}-static`;
const DATA_CACHE = `${CACHE_PREFIX}-${DATA_VERSION}-data`;
const CURRENT_CACHES = new Set([APP_CACHE, STATIC_CACHE, DATA_CACHE]);
const LEGACY_DATA_CACHES = [`${CACHE_PREFIX}-v1-data`];

const APP_SHELL_ROUTES = ["/", "/shici", "/wenchang", "/vocab", "/text", "/settings", "/developer", "/user", "/onboarding", "/changelog", "/license", "/privacy", "/terms", "/offline.html"];
const NEVER_CACHE_PREFIXES = ["/api/auth/", "/api/me", "/api/wrongbook"];

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell());
});

function addStaticAssetUrl(assetUrls, value, baseUrl) {
  try {
    const url = new URL(value, baseUrl);
    if (url.origin !== self.location.origin) return;
    if (!url.pathname.startsWith("/_next/") && !/\.(?:css|js|mjs|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|ico|webmanifest)$/i.test(url.pathname)) return;
    url.hash = "";
    assetUrls.add(url.href);
  } catch {
    // Ignore malformed or unsupported asset references in generated markup.
  }
}

function collectMarkupAssetUrls(markup, baseUrl) {
  const assetUrls = new Set();
  for (const match of markup.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
    addStaticAssetUrl(assetUrls, match[1], baseUrl);
  }
  return assetUrls;
}

function collectStyleAssetUrls(stylesheet, baseUrl) {
  const assetUrls = new Set();
  for (const match of stylesheet.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)) {
    addStaticAssetUrl(assetUrls, match[2], baseUrl);
  }
  return assetUrls;
}

async function precacheAppShell() {
  const appCache = await caches.open(APP_CACHE);
  await appCache.addAll(APP_SHELL_ROUTES);

  const assetUrls = new Set();
  for (const route of APP_SHELL_ROUTES) {
    const response = await appCache.match(route);
    if (!response) continue;
    const markup = await response.text();
    for (const assetUrl of collectMarkupAssetUrls(markup, new URL(route, self.location.origin))) assetUrls.add(assetUrl);
  }

  const staticCache = await caches.open(STATIC_CACHE);
  await staticCache.addAll([...assetUrls]);

  const styleAssetUrls = new Set();
  for (const assetUrl of assetUrls) {
    if (!new URL(assetUrl).pathname.endsWith(".css")) continue;
    const response = await staticCache.match(assetUrl);
    if (!response) continue;
    const stylesheet = await response.text();
    for (const styleAssetUrl of collectStyleAssetUrls(stylesheet, assetUrl)) styleAssetUrls.add(styleAssetUrl);
  }
  await staticCache.addAll([...styleAssetUrls]);
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    migrateLegacyDataCaches()
      .then(() => caches.keys())
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && !CURRENT_CACHES.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function migrateLegacyDataCaches() {
  const existingCacheNames = new Set(await caches.keys());
  const sourceNames = LEGACY_DATA_CACHES.filter((name) => existingCacheNames.has(name));
  if (sourceNames.length === 0) return;

  const targetCache = await caches.open(DATA_CACHE);
  for (const sourceName of sourceNames) {
    const sourceCache = await caches.open(sourceName);
    const requests = await sourceCache.keys();
    await Promise.all(
      requests.map(async (request) => {
        if (await targetCache.match(request)) return;
        const response = await sourceCache.match(request);
        if (response) await targetCache.put(request, response);
      })
    );
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
    return;
  }

  if (event.data?.type === "CACHE_VOCAB_LISTS") {
    const names = Array.isArray(event.data.names) ? event.data.names : [];
    event.waitUntil(cacheVocabLists(names));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;

  if (url.pathname.startsWith("/api/data/vocab/") || url.pathname.startsWith("/api/data/text/")) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (["script", "style", "font", "image", "manifest"].includes(request.destination) || url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});

async function cacheVocabLists(names) {
  const cache = await caches.open(DATA_CACHE);
  await Promise.all(
    names.map(async (name) => {
      const request = new Request(`/api/data/vocab/${encodeURIComponent(name)}`, { credentials: "same-origin" });
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
    })
  );
}

async function networkFirstPage(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached ?? (await cache.match("/offline.html")) ?? Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached ?? (await network) ?? new Response(JSON.stringify({ error: "offline_cache_miss" }), { status: 503, headers: { "Content-Type": "application/json" } });
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
