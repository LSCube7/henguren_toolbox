<<<<<<< HEAD
const CACHE_NAME = "henguren-toolbox-cache-v1.2";
=======
const CACHE_NAME = "henguren-toolbox-cache-v1.1";
>>>>>>> 44e0b73ec0ee4e544645b62476c2f3ac8e650fe3
const urlsToCache = [
  // Add paths to other static assets such as JavaScript files, images, etc.
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log("Opened cache");
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", function (event) {
  const { request } = event;
  if (request.url.startsWith("http")) {
    event.respondWith(
      caches.match(request).then(function (response) {
        if (response) {
          return response;
        }

        return fetch(request).then(function (response) {
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, responseToCache);
          });

          return response;
        });
      })
    );
  }
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
