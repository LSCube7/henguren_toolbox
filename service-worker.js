
const CACHE_NAME = 'henguren-toolbox-cache-v1.4-hotfix-2';
const urlsToCache = [
  // Add paths to other static assets such as JavaScript files, images, etc.
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        console.log("Version: "+ CACHE_NAME)
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  const { request } = event;
  if (request.url.startsWith('http')) {
    event.respondWith(
      caches.match(request)
        .then(function(response) {
          if (response) {
            return response;
          }

          return fetch(request)
            .then(function(response) {
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }

              const responseToCache = response.clone();

              caches.open(CACHE_NAME)
                .then(function(cache) {
                  cache.put(request, responseToCache);
                });

              return response;
            });
        })
    );
  }
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      // 发送消息通知客户端更新
      self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: 'NEW_VERSION_AVAILABLE' });
        });
      });
    })
  );
});

// 当客户端接收到新版本的消息时，重新加载页面
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'RELOAD_PAGE') {
    console.log('Received reload request from client');
    self.skipWaiting();
    self.clients.claim();
    self.clients.matchAll().then(clients => {
      clients.forEach(client => client.postMessage({ type: 'RELOAD_PAGE_NOW' }));
    });
  }
});
