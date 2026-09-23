'use strict';

const CACHE_PREFIX = 'orbisv-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v8.0-20260923`;
const BUILD = '8.0.0';
const MODULE_SHELL = [
  `./css/platform.css?v=${BUILD}`,
  `./css/workbench.css?v=${BUILD}`,
  `./js/catalog.js?v=${BUILD}`,
  `./js/platform.js?v=${BUILD}`,
  `./js/labs/kernel.js?v=${BUILD}`,
  `./js/labs/fundamentals.js?v=${BUILD}`,
  `./js/labs/geometry.js?v=${BUILD}`,
  `./js/labs/vectors.js?v=${BUILD}`,
  `./js/labs/calculus1.js?v=${BUILD}`,
  `./js/labs/calculus2.js?v=${BUILD}`,
  `./js/labs/multivariable.js?v=${BUILD}`,
  `./js/labs/extend-catalog.js?v=${BUILD}`,
  `./js/labs/worker-source.js?v=${BUILD}`,
  `./js/labs/workbench.js?v=${BUILD}`,
];
const APP_SHELL = [
  ...MODULE_SHELL,
  './',
  './index.html',
  `./manifest.webmanifest?v=${BUILD}`,
  `./css/style.css?v=${BUILD}`,
  `./js/mathEngine.js?v=${BUILD}`,
  `./js/models.js?v=${BUILD}`,
  `./js/graphObjects.js?v=${BUILD}`,
  `./js/graphEngine.js?v=${BUILD}`,
  `./js/ui.js?v=${BUILD}`,
  `./js/main.js?v=${BUILD}`,
  './assets/orbisv-v-32.png',
  './assets/orbisv-v-64.png',
  './assets/orbisv-v-180.png',
  './assets/orbisv-v-192.png',
  './assets/orbisv-v-512.png',
  './assets/orbisv-v-maskable-192.png',
  './assets/orbisv-v-maskable-512.png',
  './assets/orbisv-v-symbol.png',
  './assets/orbisv-v-symbol-light.png',
  './assets/orbisv-wordmark-official.png',
  './assets/orbisv-wordmark-transparent.png',
  './assets/orbisv-logo-official.png',
  './assets/orbisv-logo-transparent.png',
  './assets/orbisv-logo-horizontal.png',
  './assets/orbisv-logo-symbol.png',
  './manual/index.html',
  './manual/manual.css',
  './manual/manual.js',
  './manual/assets/interface-principal.png',
  './manual/assets/menu-projeto.png',
  './manual/assets/editor-matematico.png',
  './manual/assets/discos-aneis-3d.png',
  './manual/assets/exportacao.png',
];

const REQUIRED_SHELL = new Set([
  ...MODULE_SHELL,
  './', './index.html', `./manifest.webmanifest?v=${BUILD}`, `./css/style.css?v=${BUILD}`,
  `./js/mathEngine.js?v=${BUILD}`, `./js/models.js?v=${BUILD}`, `./js/graphObjects.js?v=${BUILD}`,
  `./js/graphEngine.js?v=${BUILD}`, `./js/ui.js?v=${BUILD}`, `./js/main.js?v=${BUILD}`
]);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const failedRequired = [];
    await Promise.all(APP_SHELL.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        await cache.put(url, response.clone());
      } catch (error) {
        if (REQUIRED_SHELL.has(url)) failedRequired.push(url);
        else console.warn('OrbisV SW: recurso opcional não foi pré-cacheado.', url, error);
      }
    }));
    if (failedRequired.length) throw new Error(`Falha ao preparar recursos essenciais: ${failedRequired.join(', ')}`);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function matchCached(request) {
  const exact = await caches.match(request, { ignoreSearch: false });
  if (exact) return exact;
  try {
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return null;
    const base = new URL('./', self.location.href);
    const relative = './' + url.pathname.slice(base.pathname.length).replace(/^\/+/, '');
    return (await caches.match(relative, { ignoreSearch: true })) || null;
  } catch { return null; }
}

async function navigationFallback(request) {
  const url = new URL(request.url);
  const manualPath = new URL('./manual/index.html', self.location.href).pathname;
  if (url.pathname === manualPath) return (await caches.match('./manual/index.html')) || Response.error();
  return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
}

async function networkFirst(request, navigation = false) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
      return response;
    }
    const cached = await matchCached(request);
    if (cached) return cached;
    if (navigation) return navigationFallback(request);
    return response || Response.error();
  } catch (error) {
    const cached = await matchCached(request);
    if (cached) return cached;
    if (navigation) return navigationFallback(request);
    return Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await matchCached(request);
  const network = fetch(request).then(async (response) => {
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const isCode = /\.(?:js|css)$/.test(url.pathname) || url.pathname.endsWith('/manifest.webmanifest');
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, true));
    return;
  }
  if (isCode) {
    event.respondWith(networkFirst(request, false));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});
