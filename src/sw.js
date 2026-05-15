/// <reference lib="webworker" />
/* global __APP_BUILD_VERSION__, clients */

import { clientsClaim, setCacheNameDetails } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

const SW_VERSION = typeof __APP_BUILD_VERSION__ === 'string' ? __APP_BUILD_VERSION__ : 'sw-2026-05-13-push-metadata-save-fix-4';
const CACHE_NAME = `lineup-manager-${SW_VERSION}`;
const BUILD_VERSION = SW_VERSION;
const CACHE_PREFIX = 'lineup-manager';
const PRECACHE_SUFFIX = `precache-${SW_VERSION}`;
const RUNTIME_SUFFIX = `runtime-${SW_VERSION}`;
const APP_SHELL_CACHE = CACHE_NAME;
const STATIC_ASSET_CACHE = `${CACHE_NAME}-assets`;
const IMAGE_CACHE = `${CACHE_NAME}-images`;
const CACHE_PREFIXES_TO_CLEAN = ['lineup-manager', 'workbox-precache', 'workbox-runtime'];
const IS_DEV_HOST = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname);
const IS_DEV_BUILD = BUILD_VERSION === 'dev' || IS_DEV_HOST;
const NOTIFICATIONS_DB_NAME = 'lineup-manager-notifications';
const NOTIFICATIONS_DB_VERSION = 1;
const METADATA_STORE = 'metadata';
const PENDING_PUSH_STORE = 'pendingPushNotifications';
const NOTIFICATION_METADATA_KEYS = {
  unreadCount: 'unreadCount',
  lastPushReceivedAt: 'lastPushReceivedAt',
  lastBadgeSyncAt: 'lastBadgeSyncAt',
  latestNotificationId: 'latestNotificationId',
  latestLineupId: 'latestLineupId',
};

function debugPush(message, details) {
  if (!IS_DEV_BUILD) return;
  if (typeof details === 'undefined') {
    console.log(`[PushNotifications] ${message}`);
    return;
  }
  console.log(`[PushNotifications] ${message}`, details);
}

function readPushPayload(event) {
  if (!event.data) return {};

  try {
    return event.data.json();
  } catch (jsonError) {
    try {
      return { body: event.data.text() };
    } catch (textError) {
      console.warn('[PushNotifications] push payload could not be parsed', { jsonError, textError });
      return {};
    }
  }
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openNotificationsDb() {
  return new Promise((resolve, reject) => {
    if (!self.indexedDB) {
      reject(new Error('IndexedDB is not available.'));
      return;
    }

    const request = self.indexedDB.open(NOTIFICATIONS_DB_NAME, NOTIFICATIONS_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(PENDING_PUSH_STORE)) {
        db.createObjectStore(PENDING_PUSH_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getMetadata(key) {
  const db = await openNotificationsDb();
  try {
    const transaction = db.transaction(METADATA_STORE, 'readonly');
    const record = await requestToPromise(transaction.objectStore(METADATA_STORE).get(key));
    return record?.value ?? null;
  } finally {
    db.close();
  }
}

async function setMetadata(key, value) {
  const db = await openNotificationsDb();
  try {
    const transaction = db.transaction(METADATA_STORE, 'readwrite');
    transaction.objectStore(METADATA_STORE).put({
      key,
      value,
      updatedAt: new Date().toISOString(),
    });
    await transactionDone(transaction);
    return value;
  } finally {
    db.close();
  }
}

async function getLocalUnreadCount() {
  try {
    return Math.max(0, Number(await getMetadata(NOTIFICATION_METADATA_KEYS.unreadCount)) || 0);
  } catch (error) {
    debugPush('badge count could not be read', error);
    return 0;
  }
}

async function setLocalUnreadCount(count) {
  try {
    const normalizedCount = Math.max(0, Number(count) || 0);
    await setMetadata(NOTIFICATION_METADATA_KEYS.unreadCount, normalizedCount);
    return normalizedCount;
  } catch (error) {
    debugPush('badge count could not be written', error);
    return Math.max(0, Number(count) || 0);
  }
}

async function syncAppBadgeFromServiceWorker(serverBadgeCount) {
  const normalizedCount = Math.max(
    0,
    Number(typeof serverBadgeCount === 'undefined' ? await getLocalUnreadCount() : serverBadgeCount) || 0
  );
  const serviceWorkerNavigator = self.navigator;

  if (typeof serverBadgeCount !== 'undefined') {
    await setLocalUnreadCount(normalizedCount);
  }

  try {
    await setMetadata(NOTIFICATION_METADATA_KEYS.lastBadgeSyncAt, new Date().toISOString());
  } catch (error) {
    debugPush('badge sync metadata could not be written', error);
  }

  if (!serviceWorkerNavigator || !('setAppBadge' in serviceWorkerNavigator)) return normalizedCount;

  try {
    if (normalizedCount > 0) {
      await serviceWorkerNavigator.setAppBadge(normalizedCount);
    } else if ('clearAppBadge' in serviceWorkerNavigator) {
      await serviceWorkerNavigator.clearAppBadge();
    } else {
      await serviceWorkerNavigator.setAppBadge(0);
    }
    debugPush('app badge updated from service worker', { count: normalizedCount });
  } catch (error) {
    debugPush('service worker app badge update was blocked or unsupported', error);
  }

  return normalizedCount;
}

async function incrementLocalUnreadCount(_payload = {}) {
  const currentCount = await getLocalUnreadCount();
  return syncAppBadgeFromServiceWorker(currentCount + 1);
}

async function decrementLocalUnreadCount() {
  const currentCount = await getLocalUnreadCount();
  return syncAppBadgeFromServiceWorker(currentCount - 1);
}

async function clearLocalUnreadCount() {
  return syncAppBadgeFromServiceWorker(0);
}

async function markNotificationReadFromServiceWorker(notificationId) {
  const markedRead = await markPendingPushNotificationRead(notificationId);
  if (markedRead) await decrementLocalUnreadCount();
  return markedRead;
}

function createPendingPushNotification(payload = {}, options = {}) {
  const lineupId = options.data?.lineupId;
  if (!lineupId) return null;

  const timestamp = options.data?.timestamp || options.timestamp || Date.now();
  const createdAt = new Date(timestamp).toISOString();

  return {
    id: options.data?.notificationId || `lineup-${lineupId}`,
    type: options.data?.type || payload.type || 'lineup',
    title: payload.title || 'Line Up Updated',
    message: payload.body || options.body || 'Tap to open lineup',
    body: payload.body || options.body || '',
    lineupId,
    url: options.data?.url || `/lineups/${lineupId}`,
    timestamp: createdAt,
    createdAt,
    read: false,
    source: 'web_push',
  };
}

async function postPushNotificationToOpenClients(payload = {}, options = {}, pendingNotification = null) {
  const data = options.data || {};
  const clientPayload = {
    id: data.notificationId || payload.notificationId || payload.id || pendingNotification?.id || null,
    notificationId: data.notificationId || payload.notificationId || payload.id || pendingNotification?.id || null,
    type: data.type || payload.type || (data.lineupId ? 'lineup' : 'push'),
    title: payload.title || (data.lineupId ? 'Line Up Updated' : 'Line Up Manager'),
    body: payload.body || options.body || '',
    message: payload.message || payload.body || options.body || '',
    lineupId: data.lineupId || payload.lineupId || null,
    url: data.url || payload.url || (data.lineupId ? `/lineups/${data.lineupId}` : '/'),
    tag: options.tag || payload.tag || '',
    createdAt: payload.createdAt || payload.timestamp || new Date(data.timestamp || Date.now()).toISOString(),
    timestamp: payload.timestamp || payload.createdAt || new Date(data.timestamp || Date.now()).toISOString(),
  };

  const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  await Promise.all(clientList.map(async (client) => {
    try {
      const clientUrl = new URL(client.url);
      if (clientUrl.origin !== self.location.origin) return;
      client.postMessage?.({
        type: clientPayload.lineupId ? 'LINEUP_NOTIFICATION' : 'PUSH_NOTIFICATION',
        payload: clientPayload,
      });
    } catch (error) {
      debugPush('foreground push message could not be posted to client', error);
    }
  }));
}

async function readPendingPushNotification(notificationId) {
  if (!notificationId) return null;

  try {
    const db = await openNotificationsDb();
    const transaction = db.transaction(PENDING_PUSH_STORE, 'readonly');
    const record = await requestToPromise(transaction.objectStore(PENDING_PUSH_STORE).get(notificationId));
    db.close();
    return record || null;
  } catch (error) {
    debugPush('pending push notification could not be read', error);
    return null;
  }
}

async function writePendingPushNotification(record) {
  try {
    const db = await openNotificationsDb();
    const transaction = db.transaction(PENDING_PUSH_STORE, 'readwrite');
    transaction.objectStore(PENDING_PUSH_STORE).put(record);
    await transactionDone(transaction);
    db.close();
    return true;
  } catch (error) {
    debugPush('pending push notification could not be written', error);
    return false;
  }
}

async function storePendingPushNotification(record) {
  if (!record?.id) return false;

  const existing = await readPendingPushNotification(record.id);
  const shouldIncreaseBadge = !existing || existing.read;
  const didWrite = await writePendingPushNotification({
    ...(existing || {}),
    ...record,
    read: false,
  });

  return didWrite ? shouldIncreaseBadge : true;
}

async function recordLatestPushMetadata(record) {
  const now = new Date().toISOString();

  try {
    await Promise.all([
      setMetadata(NOTIFICATION_METADATA_KEYS.lastPushReceivedAt, now),
      record?.id ? setMetadata(NOTIFICATION_METADATA_KEYS.latestNotificationId, record.id) : Promise.resolve(),
      record?.lineupId ? setMetadata(NOTIFICATION_METADATA_KEYS.latestLineupId, record.lineupId) : Promise.resolve(),
    ]);
  } catch (error) {
    debugPush('latest push metadata could not be written', error);
  }
}

async function markPendingPushNotificationRead(notificationId) {
  if (!notificationId) return false;

  const existing = await readPendingPushNotification(notificationId);
  if (!existing || existing.read) return false;

  return writePendingPushNotification({
    ...existing,
    read: true,
    readAt: new Date().toISOString(),
  });
}

function getNotificationUrl(payload = {}) {
  const fallbackUrl = payload.lineupId ? `/lineups/${payload.lineupId}` : '/lineups';
  const rawUrl = payload.url || payload.data?.url || fallbackUrl;
  return new URL(rawUrl, self.location.origin).href;
}

function createNotificationOptions(payload = {}) {
  const lineupId = payload.lineupId || payload.lineup_id || payload.data?.lineupId || null;
  const url = getNotificationUrl({ ...payload, lineupId });
  const timestampValue = payload.timestamp ? Date.parse(payload.timestamp) : Date.now();
  const timestamp = Number.isFinite(timestampValue) ? timestampValue : Date.now();
  const notificationId = payload.notificationId || payload.id || (lineupId ? `lineup-${lineupId}` : `push-${timestamp}`);

  return {
    body: payload.body || 'A new worship lineup has been posted.',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    tag: payload.tag || (lineupId ? `lineup-${lineupId}` : 'lineup-manager'),
    timestamp,
    renotify: payload.renotify !== false,
    requireInteraction: payload.requireInteraction === true,
    silent: payload.silent === true,
    vibrate: [200, 100, 200],
    actions: Array.isArray(payload.actions)
      ? payload.actions
      : lineupId
        ? [
            { action: 'view-lineup', title: 'View lineup' },
            { action: 'mark-read', title: 'Mark read' },
          ]
        : [],
    data: {
      ...(payload.data || {}),
      notificationId,
      url,
      lineupId,
      type: payload.type || payload.data?.type || (lineupId ? 'lineup_created' : 'push'),
      timestamp,
    },
  };
}

async function focusOrOpenNotificationUrl(urlToOpen, notificationData = {}) {
  const targetUrl = new URL(urlToOpen, self.location.origin);
  const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });

  for (const client of clientList) {
    const clientUrl = new URL(client.url);
    if (clientUrl.origin !== self.location.origin) continue;

    let targetClient = client;
    if ('focus' in targetClient) {
      await targetClient.focus();
    }

    targetClient.postMessage?.({
      type: 'OPEN_LINEUP_FROM_NOTIFICATION',
      lineupId: notificationData.lineupId || null,
      notificationId: notificationData.notificationId || null,
      url: `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`,
    });

    if ('navigate' in targetClient) {
      await targetClient.navigate(targetUrl.href);
    }

    return;
  }

  if (clients.openWindow) {
    await clients.openWindow(targetUrl.href);
  }
}

async function handleNotificationClick(event) {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  if (action === 'mark-read') {
    await markNotificationReadFromServiceWorker(data.notificationId);
    await syncAppBadgeFromServiceWorker();
    return;
  }

  const targetUrl = new URL(data.url || '/', self.location.origin).href;

  await markNotificationReadFromServiceWorker(data.notificationId);
  await syncAppBadgeFromServiceWorker();
  await focusOrOpenNotificationUrl(targetUrl, data);
}

setCacheNameDetails({
  prefix: CACHE_PREFIX,
  precache: 'precache',
  runtime: 'runtime',
  suffix: BUILD_VERSION,
});

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

self.addEventListener('install', (event) => {
  console.log('[PWA] service worker installed', { buildVersion: BUILD_VERSION });
  event.waitUntil(Promise.resolve());
});

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
    return;
  }

  if (event.data?.type === 'LINEUP_BADGE_SYNC') {
    const nextCount = Math.max(0, Number(event.data.count) || 0);
    event.waitUntil?.(nextCount > 0 ? syncAppBadgeFromServiceWorker(nextCount) : clearLocalUnreadCount());
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const cachesToDelete = cacheNames.filter((cacheName) => {
        if (!CACHE_PREFIXES_TO_CLEAN.some((prefix) => cacheName.startsWith(prefix))) return false;
        const isCurrentCache = cacheName === CACHE_NAME
          || cacheName.startsWith(`${CACHE_NAME}-`)
          || cacheName.includes(SW_VERSION);
        return !isCurrentCache;
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
  const payload = readPushPayload(event);
  const title = payload.title || 'New lineup added';
  const options = createNotificationOptions(payload);

  debugPush('push event received', { title, options });

  event.waitUntil(
    (async () => {
      const pendingNotification = createPendingPushNotification(payload, options);
      if (pendingNotification) {
        await recordLatestPushMetadata(pendingNotification);
        const shouldIncreaseBadge = await storePendingPushNotification(pendingNotification);
        if (shouldIncreaseBadge) {
          await incrementLocalUnreadCount(payload);
        } else {
          await syncAppBadgeFromServiceWorker();
        }
      } else {
        try {
          await setMetadata(NOTIFICATION_METADATA_KEYS.lastPushReceivedAt, new Date().toISOString());
        } catch (error) {
          debugPush('last push metadata could not be written', error);
        }
      }

      await postPushNotificationToOpenClients(payload, options, pendingNotification);
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  debugPush('notification click URL', {
    action: event.action || 'default',
    url: event.notification.data?.url || '/',
    lineupId: event.notification.data?.lineupId || null,
  });

  event.waitUntil(handleNotificationClick(event));
});

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification?.data);
  debugPush('notification closed', {
    tag: event.notification.tag,
    lineupId: event.notification.data?.lineupId || null,
  });
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
