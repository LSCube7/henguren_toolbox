const CACHE_PREFIX = "henguren-v3-offline";
// Keep this value in sync with cacheVersion in src/lib/offline-cache.ts.
// Increment it whenever the cached app shell or data contract changes.
const VERSION = "v2";
const APP_CACHE = `${CACHE_PREFIX}-${VERSION}-app`;
const STATIC_CACHE = `${CACHE_PREFIX}-${VERSION}-static`;
const DATA_CACHE = `${CACHE_PREFIX}-${VERSION}-data`;
const CURRENT_CACHES = new Set([APP_CACHE, STATIC_CACHE, DATA_CACHE]);

const APP_SHELL_ROUTES = ["/", "/shici", "/wenchang", "/vocab", "/text", "/settings", "/developer", "/user", "/onboarding", "/changelog", "/license", "/privacy", "/terms", "/offline.html"];
const NEVER_CACHE_PREFIXES = ["/api/auth/", "/api/me", "/api/wrongbook"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL_ROUTES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && !CURRENT_CACHES.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

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
