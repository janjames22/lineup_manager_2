/* global __APP_BUILD_VERSION__ */
import { getMetadata, NOTIFICATION_METADATA_KEYS } from './indexedDbNotifications';

const PUSH_SUBSCRIPTION_ENDPOINT_KEY = 'lineupManagerPushSubscriptionEndpoint';
const PUSH_DEVICE_ID_KEY = 'lineupManagerPushDeviceId';
const STABLE_PRODUCTION_HOST = 'ccfbc-lineup-manager-code.vercel.app';
const API_BASE = '/api/push';
const IS_DEV = import.meta.env.DEV;
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
const BUILD_VERSION = typeof __APP_BUILD_VERSION__ === 'string' ? __APP_BUILD_VERSION__ : 'dev';

let cachedVapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function debugPush(message, details) {
  if (!IS_DEV) return;
  if (typeof details === 'undefined') {
    console.log(`[PushNotifications] ${message}`);
    return;
  }
  console.log(`[PushNotifications] ${message}`, details);
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isSafariBrowser() {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent;
  return /Safari/i.test(userAgent) && !/(CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Edg|Firefox)/i.test(userAgent);
}

function isAndroidDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function getDeviceLabel() {
  if (typeof navigator === 'undefined') return 'Unknown browser';
  const browser = /Edg\//.test(navigator.userAgent)
    ? 'Edge'
    : /CriOS|Chrome\//.test(navigator.userAgent)
      ? 'Chrome'
      : /Safari\//.test(navigator.userAgent)
        ? 'Safari'
        : 'Browser';
  const platform = isIosDevice() ? 'iPhone/iPad' : isAndroidDevice() ? 'Android' : navigator.platform || 'Device';
  return `${platform} ${browser}`;
}

function createDeviceId() {
  const cryptoObject = typeof crypto !== 'undefined' ? crypto : null;
  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID();
  const randomValues = cryptoObject?.getRandomValues
    ? Array.from(cryptoObject.getRandomValues(new Uint8Array(16)))
    : Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));

  return randomValues
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export function getPushDeviceId() {
  if (typeof window === 'undefined') return '';
  const existing = window.localStorage.getItem(PUSH_DEVICE_ID_KEY);
  if (existing) return existing;

  const deviceId = createDeviceId();
  window.localStorage.setItem(PUSH_DEVICE_ID_KEY, deviceId);
  return deviceId;
}

async function readJsonResponse(response, fallbackMessage) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || fallbackMessage);
  }
  return body;
}

async function fetchJson(url, options, fallbackMessage) {
  const response = await fetch(url, options);
  return readJsonResponse(response, fallbackMessage);
}

async function getApplicationServerKey() {
  if (cachedVapidPublicKey) return cachedVapidPublicKey;

  const body = await fetchJson(
    `${API_BASE}/public-key`,
    { method: 'GET' },
    'Web Push public key is not configured.'
  );

  cachedVapidPublicKey = body.publicKey || '';
  if (!cachedVapidPublicKey) {
    throw new Error('Web Push public key is not configured.');
  }

  return cachedVapidPublicKey;
}

async function getServiceWorkerRegistration({ ensure = false } = {}) {
  if (!('serviceWorker' in navigator)) return null;

  if (ensure) {
    const registered = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    debugPush('service worker registered', { scope: registered.scope });
    const ready = await navigator.serviceWorker.ready;
    debugPush('service worker ready', { scope: ready.scope, active: Boolean(ready.active) });
    return ready || registered;
  }

  const existing = await navigator.serviceWorker.getRegistration('/');
  return existing || null;
}

async function saveSubscriptionToServer(subscription) {
  const json = subscription.toJSON();
  const payload = {
    subscription: json,
    userAgent: navigator.userAgent || '',
    deviceLabel: getDeviceLabel(),
    deviceId: getPushDeviceId(),
  };

  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Browser did not return a complete push subscription.');
  }

  const result = await fetchJson(
    `${API_BASE}/subscribe`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Unable to save push subscription.'
  );

  debugPush('subscription saved to Supabase', { endpoint: result.endpoint });
  storePushSubscriptionEndpoint(json.endpoint);
  return result;
}

async function checkSubscriptionSavedToServer(endpoint) {
  if (!endpoint) return null;

  return fetchJson(
    `${API_BASE}/check-subscription`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    },
    'Unable to check push subscription storage.'
  );
}

export function getPushSupportStatus() {
  const hasWindow = typeof window !== 'undefined';
  const hasNavigator = typeof navigator !== 'undefined';
  const hasNotification = hasWindow && 'Notification' in window;
  const hasServiceWorker = hasNavigator && 'serviceWorker' in navigator;
  const hasPushManager = hasWindow && 'PushManager' in window;
  const isStandalone = isStandalonePwa();
  const isIos = isIosDevice();
  const isAndroid = isAndroidDevice();
  const isSafari = isSafariBrowser();
  const navigatorStandalone = hasWindow ? window.navigator.standalone === true : false;
  const displayModeStandalone = hasWindow ? Boolean(window.matchMedia?.('(display-mode: standalone)').matches) : false;
  const permission = hasNotification ? Notification.permission : 'unsupported';
  const userAgent = hasNavigator ? navigator.userAgent : '';
  const hostname = hasWindow ? window.location.hostname : '';
  const isVercelPreview = hostname.endsWith('.vercel.app') && hostname !== STABLE_PRODUCTION_HOST;
  const supported = hasNotification && hasServiceWorker && hasPushManager;
  const canEnable = supported && permission !== 'denied' && (!isIos || isStandalone);

  let reason = 'Ready to enable phone notifications.';
  if (!hasNotification) reason = 'Browser does not support notifications.';
  else if (!hasServiceWorker) reason = 'Browser does not support service workers.';
  else if (isIos && !isStandalone) reason = 'iPhone/iPad requires installing this PWA to the Home Screen first.';
  else if (!hasPushManager) reason = 'Browser does not support the Push API.';
  else if (permission === 'denied') reason = 'Permission denied. Allow notifications in browser or OS settings.';
  else if (permission === 'granted') reason = 'Notification permission granted. Checking push subscription.';
  else if (isAndroid) reason = 'Android Chrome/Edge can receive Web Push after permission is granted.';

  const status = {
    hasNotification,
    hasServiceWorker,
    hasPushManager,
    isStandalone,
    permission,
    userAgent,
    supported,
    canEnable,
    isIos,
    isAndroid,
    isSafari,
    navigatorStandalone,
    displayModeStandalone,
    isVercelPreview,
    hostname,
    reason,
  };

  debugPush('support status', status);
  return status;
}

export function getStoredPushSubscriptionEndpoint() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(PUSH_SUBSCRIPTION_ENDPOINT_KEY) || '';
}

function storePushSubscriptionEndpoint(endpoint) {
  if (typeof window === 'undefined' || !endpoint) return;
  window.localStorage.setItem(PUSH_SUBSCRIPTION_ENDPOINT_KEY, endpoint);
}

function clearStoredPushSubscriptionEndpoint() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PUSH_SUBSCRIPTION_ENDPOINT_KEY);
}

export async function checkLineupPushSubscriptionHealth({ refreshServer = false, ensureRegistration = false } = {}) {
  const support = getPushSupportStatus();

  if (!support.supported) {
    return { ok: false, code: 'unsupported', message: support.reason, support };
  }

  if (support.permission === 'denied') {
    return { ok: false, code: 'permission_denied', message: 'Permission denied. Allow notifications in browser or OS settings.', support };
  }

  if (support.permission !== 'granted') {
    return { ok: false, code: 'permission_not_granted', message: 'Permission not granted. Enable phone notifications first.', support };
  }

  if (support.isIos && !support.isStandalone) {
    return { ok: false, code: 'ios_not_installed', message: 'Install this app to Home Screen, then open it from the Home Screen icon.', support };
  }

  const registration = await getServiceWorkerRegistration({ ensure: ensureRegistration });
  if (!registration?.active) {
    return { ok: false, code: 'service_worker_inactive', message: 'Service worker not active yet. Reload the app, then try again.', support, registration };
  }

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    clearStoredPushSubscriptionEndpoint();
    return { ok: false, code: 'no_subscription', message: 'No push subscription found. Enable phone notifications again.', support, registration };
  }

  storePushSubscriptionEndpoint(subscription.endpoint);

  if (refreshServer) {
    await saveSubscriptionToServer(subscription);
  }

  let serverSubscription = null;
  try {
    serverSubscription = await checkSubscriptionSavedToServer(subscription.endpoint);
  } catch (error) {
    debugPush('subscription server check failed', error);
  }

  return {
    ok: true,
    code: 'ok',
    message: 'Phone notifications enabled for this device.',
    support,
    registration,
    subscription,
    serverSubscription,
  };
}

export async function subscribeToLineupPushNotifications({ forceNew = false } = {}) {
  const support = getPushSupportStatus();
  if (!support.supported) {
    throw new Error(support.reason);
  }

  if (support.isIos && !support.isStandalone) {
    throw new Error('Install this app to Home Screen, then open it from the Home Screen icon to enable notifications.');
  }

  const permission = support.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error(permission === 'denied' ? 'Permission denied.' : 'Permission was not granted.');
  }

  const publicKey = await getApplicationServerKey();
  const registration = await getServiceWorkerRegistration({ ensure: true });

  if (!registration?.active) {
    throw new Error('Service worker not active yet. Reload the app, then try again.');
  }

  const existing = await registration.pushManager.getSubscription();
  if (existing && forceNew) {
    await fetchJson(
      `${API_BASE}/unsubscribe`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: existing.endpoint }),
      },
      'Unable to remove old push subscription.'
    );
    await existing.unsubscribe();
    clearStoredPushSubscriptionEndpoint();
  }

  const current = forceNew ? null : existing;
  const subscription = current || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  debugPush(current ? 'existing push subscription found' : 'push subscription created', {
    endpoint: subscription.endpoint,
  });

  await saveSubscriptionToServer(subscription);

  return {
    message: 'Phone notifications enabled for this device.',
    subscription,
  };
}

export async function resubscribeToLineupPushNotifications() {
  return subscribeToLineupPushNotifications({ forceNew: true });
}

export async function unsubscribeFromLineupPushNotifications() {
  const registration = await getServiceWorkerRegistration({ ensure: false });
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  const endpoint = subscription?.endpoint || getStoredPushSubscriptionEndpoint();

  if (!endpoint) {
    clearStoredPushSubscriptionEndpoint();
    return { message: 'No push subscription found on this device.' };
  }

  await fetchJson(
    `${API_BASE}/unsubscribe`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    },
    'Unable to remove push subscription.'
  );

  if (subscription) {
    await subscription.unsubscribe();
  }

  clearStoredPushSubscriptionEndpoint();
  return { message: 'Phone notifications disabled for this device.' };
}

export async function sendTestPushNotification() {
  const health = await checkLineupPushSubscriptionHealth({ ensureRegistration: true, refreshServer: true });
  if (!health.ok) {
    throw new Error(health.message);
  }

  const result = await fetchJson(
    `${API_BASE}/send-test`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetEndpoint: health.subscription.endpoint,
        title: 'Line Up Manager',
        body: 'Test phone notification',
        url: '/lineups',
      }),
    },
    'Unable to send test notification.'
  );

  if ((result.sent || 0) < 1) {
    throw new Error('Test push was accepted, but no active subscription was reached.');
  }

  debugPush('backend push send result', result);
  return result;
}

export async function sendLocalDiagnosticNotification() {
  const support = getPushSupportStatus();
  if (!support.hasNotification) {
    throw new Error('Browser does not support notifications.');
  }

  const permission = support.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error(permission === 'denied' ? 'Permission denied.' : 'Permission was not granted.');
  }

  const registration = await getServiceWorkerRegistration({ ensure: true });
  const options = {
    body: 'This local test only proves notifications can display while the app is open.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'lineup-local-diagnostic',
    renotify: true,
    silent: false,
    data: {
      url: '/lineups',
      type: 'diagnostic',
    },
  };

  if (registration?.showNotification) {
    await registration.showNotification('Line Up local test', options);
  } else {
    new Notification('Line Up local test', options);
  }

  return { ok: true };
}

export async function getNotificationDiagnostics({ refreshServer = false, ensureRegistration = false } = {}) {
  const support = getPushSupportStatus();
  let registration = null;
  let registrationError = '';
  let subscription = null;
  let serverSubscription = null;
  let health = null;

  try {
    registration = await getServiceWorkerRegistration({ ensure: ensureRegistration });
  } catch (error) {
    registrationError = error?.message || 'Unable to inspect service worker.';
  }

  try {
    if (registration?.pushManager) {
      subscription = await registration.pushManager.getSubscription();
    }
  } catch (error) {
    debugPush('subscription diagnostics check failed', error);
  }

  if (subscription) {
    storePushSubscriptionEndpoint(subscription.endpoint);

    if (refreshServer) {
      await saveSubscriptionToServer(subscription);
    }

    try {
      serverSubscription = await checkSubscriptionSavedToServer(subscription.endpoint);
    } catch (error) {
      serverSubscription = {
        saved: false,
        error: error?.message || 'Unable to check Supabase subscription.',
      };
    }
  }

  try {
    health = await checkLineupPushSubscriptionHealth({ refreshServer: false, ensureRegistration: false });
  } catch (error) {
    health = { ok: false, code: 'health_check_failed', message: error?.message || 'Unable to check setup.' };
  }

  const readMetadata = async (key) => {
    try {
      return await getMetadata(key);
    } catch {
      return null;
    }
  };

  return {
    support,
    health,
    registration: {
      supported: support.hasServiceWorker,
      registered: Boolean(registration),
      active: Boolean(registration?.active),
      waiting: Boolean(registration?.waiting),
      installing: Boolean(registration?.installing),
      scope: registration?.scope || '',
      activeScriptUrl: registration?.active?.scriptURL || '',
      error: registrationError,
    },
    subscription: {
      exists: Boolean(subscription),
      endpoint: subscription?.endpoint || '',
      savedInSupabase: Boolean(serverSubscription?.saved),
      activeInSupabase: Boolean(serverSubscription?.saved) && serverSubscription?.active !== false,
      serverLastSeenAt: serverSubscription?.lastSeenAt || null,
      serverUpdatedAt: serverSubscription?.updatedAt || null,
      serverError: serverSubscription?.error || '',
    },
    metadata: {
      lastSubscriptionSyncAt: serverSubscription?.lastSeenAt || serverSubscription?.updatedAt || null,
      lastPushReceivedAt: await readMetadata(NOTIFICATION_METADATA_KEYS.lastPushReceivedAt),
      lastBadgeSyncAt: await readMetadata(NOTIFICATION_METADATA_KEYS.lastBadgeSyncAt),
      latestLineupId: await readMetadata(NOTIFICATION_METADATA_KEYS.latestLineupId),
      latestNotificationId: await readMetadata(NOTIFICATION_METADATA_KEYS.latestNotificationId),
    },
    app: {
      version: APP_VERSION,
      buildVersion: BUILD_VERSION,
      serviceWorkerVersion: BUILD_VERSION,
      deviceId: getPushDeviceId(),
    },
  };
}

export async function sendLineupPushNotification(lineup) {
  if (!lineup?.id) return null;

  const targetUrl = `/lineups/${lineup.id}`;
  const result = await fetchJson(
    `${API_BASE}/send-lineup`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineupId: lineup.id,
        url: targetUrl,
        excludeEndpoint: getStoredPushSubscriptionEndpoint(),
      }),
    },
    'Unable to send lineup push notification.'
  );

  debugPush('lineup push send result', result);
  return result;
}
