/// <reference lib="webworker" />
/* global __APP_BUILD_VERSION__, clients */

import { clientsClaim, setCacheNameDetails } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

const BUILD_VERSION = typeof __APP_BUILD_VERSION__ === 'string' ? __APP_BUILD_VERSION__ : 'dev';
const CACHE_PREFIX = 'lineup-manager';
const PRECACHE_SUFFIX = `precache-${BUILD_VERSION}`;
const RUNTIME_SUFFIX = `runtime-${BUILD_VERSION}`;
const APP_SHELL_CACHE = `${CACHE_PREFIX}-app-shell-${BUILD_VERSION}`;
const STATIC_ASSET_CACHE = `${CACHE_PREFIX}-assets-${BUILD_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${BUILD_VERSION}`;
const CACHE_PREFIXES_TO_CLEAN = ['lineup-manager', 'workbox-precache', 'workbox-runtime'];

setCacheNameDetails({
  prefix: CACHE_PREFIX,
  precache: 'precache',
  runtime: 'runtime',
  suffix: BUILD_VERSION,
});

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

const appShellHandler = createHandlerBoundToURL('index.html');
const navigationHandler = new NetworkFirst({
  cacheName: APP_SHELL_CACHE,
  networkTimeoutSeconds: 3,
  plugins: [
    new CacheableResponsePlugin({
      statuses: [200],
    }),
    new ExpirationPlugin({
      maxEntries: 10,
      purgeOnQuotaError: true,
    }),
  ],
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[PWA] activating new service worker', { buildVersion: BUILD_VERSION });
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const cachesToDelete = cacheNames.filter((cacheName) => {
        if (!CACHE_PREFIXES_TO_CLEAN.some((prefix) => cacheName.startsWith(prefix))) return false;
        return !cacheName.includes(BUILD_VERSION);
      });

      await Promise.all(cachesToDelete.map((cacheName) => caches.delete(cacheName)));
      console.log('[PWA] old caches deleted', {
        buildVersion: BUILD_VERSION,
        deletedCaches: cachesToDelete,
        activeCaches: [PRECACHE_SUFFIX, RUNTIME_SUFFIX, APP_SHELL_CACHE, STATIC_ASSET_CACHE, IMAGE_CACHE],
      });
      await self.clients.claim();
    })()
  );
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    console.warn('[PWA] push payload could not be parsed as JSON', error);
  }

  const title = payload.title || 'Line Up Manager';
  const url = payload.url || '/lineups';
  const options = {
    body: payload.body || 'New notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || (payload.lineupId ? `lineup-${payload.lineupId}` : 'lineup-manager'),
    renotify: true,
    data: {
      url,
      lineupId: payload.lineupId || null,
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data?.url || '/lineups', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) return client.navigate(urlToOpen);
          return undefined;
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }

      return undefined;
    })
  );
});

registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ event }) => {
    try {
      return await navigationHandler.handle({ event, request: event.request });
    } catch (error) {
      console.warn('[PWA] navigation network request failed, using cached app shell fallback', error);
      return appShellHandler({ event, request: event.request });
    }
  }
);

registerRoute(
  ({ request, url }) =>
    ['script', 'style', 'worker'].includes(request.destination) && url.origin === self.location.origin,
  new StaleWhileRevalidate({
    cacheName: STATIC_ASSET_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [200],
      }),
      new ExpirationPlugin({
        maxEntries: 64,
        maxAgeSeconds: 7 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  })
);

registerRoute(
  ({ request, url }) => request.destination === 'image' && url.origin === self.location.origin,
  new CacheFirst({
    cacheName: IMAGE_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [200],
      }),
      new ExpirationPlugin({
        maxEntries: 48,
        maxAgeSeconds: 30 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  })
);
