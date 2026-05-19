/* global __APP_BUILD_VERSION__, __APP_VERSION__ */
import { getMetadata, NOTIFICATION_METADATA_KEYS } from './indexedDbNotifications';

const PUSH_SUBSCRIPTION_ENDPOINT_KEY = 'lineupManagerPushSubscriptionEndpoint';
const LEGACY_PUSH_DEVICE_ID_KEY = 'lineupManagerPushDeviceId';
const DEVICE_ID_KEY = 'ccfbc_device_id';
const STABLE_PRODUCTION_HOST = 'ccfbc-lineup-manager-code.vercel.app';
const API_BASE = '/api/push';
const IS_DEV = import.meta.env.DEV;
const BUILD_VERSION = typeof __APP_BUILD_VERSION__ === 'string' ? __APP_BUILD_VERSION__ : 'dev';
const APP_VERSION = import.meta.env.VITE_APP_VERSION || (typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : BUILD_VERSION);

let cachedVapidPublicKey = IS_DEV ? import.meta.env.VITE_VAPID_PUBLIC_KEY || '' : '';

function debugPush(message, details) {
  if (!IS_DEV) return;
  if (typeof details === 'undefined') {
    console.log(`[PushNotifications] ${message}`);
    return;
  }
  console.log(`[PushNotifications] ${message}`, details);
}

function logPush(message, details) {
  if (!IS_DEV) return;
  if (typeof details === 'undefined') {
    console.info(`[PushNotifications] ${message}`);
    return;
  }
  console.info(`[PushNotifications] ${message}`, details);
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function arrayBufferToUrlBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

function isChromeBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /(Chrome|CriOS|Chromium|Edg\/|OPR\/)/i.test(navigator.userAgent);
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

function getPushPlatform() {
  if (typeof navigator === 'undefined') return 'desktop-other';

  const userAgent = navigator.userAgent || '';
  const navigatorPlatform = navigator.platform || '';
  const standalone = isStandalonePwa();
  const isIos = isIosDevice();
  const isAndroid = isAndroidDevice();
  const isMac = !isIos && (/Mac/i.test(navigatorPlatform) || /Macintosh|Mac OS X/i.test(userAgent));

  if (isIos) return standalone ? 'ios-pwa' : 'ios-safari';
  if (isAndroid) return standalone ? 'android-pwa' : 'android-chrome';
  if (isMac && isSafariBrowser()) return 'mac-safari';
  if (isChromeBrowser()) return 'desktop-chrome';
  return 'desktop-other';
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
  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    debugPush('device_id loaded from localStorage', { deviceId: existing });
    return existing;
  }

  const legacyDeviceId = window.localStorage.getItem(LEGACY_PUSH_DEVICE_ID_KEY);
  if (legacyDeviceId) {
    window.localStorage.setItem(DEVICE_ID_KEY, legacyDeviceId);
    debugPush('device_id migrated to ccfbc_device_id', { deviceId: legacyDeviceId });
    return legacyDeviceId;
  }

  const deviceId = createDeviceId();
  window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  debugPush('device_id generated', { deviceId });
  logPush('generated device_id', { deviceId, storageKey: DEVICE_ID_KEY });
  return deviceId;
}

async function readJsonResponse(response, fallbackMessage) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    debugPush('API error response', {
      status: response.status,
      statusText: response.statusText,
      error: body.error,
    });
    if (response.status === 404) {
      throw new Error('API route missing. Check that /api/push/subscribe is deployed.');
    }
    throw new Error(body.error || fallbackMessage);
  }
  return body;
}

async function fetchJson(url, options, fallbackMessage) {
  try {
    const response = await fetch(url, options);
    return readJsonResponse(response, fallbackMessage);
  } catch (error) {
    debugPush('API request failed', { url, error: error?.message || error });
    if (error instanceof TypeError) {
      throw new Error('API route unavailable. Check your network connection and deployed API routes.');
    }
    throw error;
  }
}

async function getApplicationServerKey() {
  if (cachedVapidPublicKey) return cachedVapidPublicKey;

  const body = await fetchJson(
    `${API_BASE}/public-key`,
    {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    },
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
    debugPush('registering service worker', { scope: '/' });
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
  const p256dhKey = subscription.getKey?.('p256dh');
  const authKey = subscription.getKey?.('auth');
  const p256dh = p256dhKey ? arrayBufferToUrlBase64(p256dhKey) : json.keys?.p256dh || '';
  const auth = authKey ? arrayBufferToUrlBase64(authKey) : json.keys?.auth || '';
  const endpoint = subscription.endpoint || json.endpoint || '';
  const device_id = getPushDeviceId();
  const platform = getPushPlatform();
  const user_agent = navigator.userAgent || '';
  const device_label = getDeviceLabel();
  const app_version = APP_VERSION;
  const service_worker_version = BUILD_VERSION;
  const sw_version = service_worker_version;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const notification_permission = 'Notification' in window ? Notification.permission : 'unsupported';
  const payload = {
    endpoint,
    p256dh,
    auth,
    keys: {
      p256dh,
      auth,
    },
    device_id,
    deviceId: device_id,
    platform,
    user_agent,
    userAgent: user_agent,
    device_label,
    deviceLabel: device_label,
    app_version,
    appVersion: app_version,
    service_worker_version,
    serviceWorkerVersion: service_worker_version,
    sw_version,
    swVersion: sw_version,
    timezone,
    notification_permission,
    notificationPermission: notification_permission,
    metadata: {
      device_id,
      deviceId: device_id,
      platform,
      user_agent,
      userAgent: user_agent,
      device_label,
      deviceLabel: device_label,
      app_version,
      appVersion: app_version,
      service_worker_version,
      serviceWorkerVersion: service_worker_version,
      sw_version,
      swVersion: sw_version,
      timezone,
      notification_permission,
      notificationPermission: notification_permission,
    },
    subscription: {
      endpoint,
      p256dh,
      auth,
      keys: {
        p256dh,
        auth,
      },
      device_id,
      deviceId: device_id,
      platform,
      user_agent,
      userAgent: user_agent,
      device_label,
      deviceLabel: device_label,
      app_version,
      appVersion: app_version,
      service_worker_version,
      serviceWorkerVersion: service_worker_version,
      sw_version,
      swVersion: sw_version,
      timezone,
      notification_permission,
      notificationPermission: notification_permission,
    },
  };
  const loggedPayload = {
    endpoint,
    p256dh: p256dh ? '[present]' : '[missing]',
    auth: auth ? '[present]' : '[missing]',
    keys: {
      p256dh: p256dh ? '[present]' : '[missing]',
      auth: auth ? '[present]' : '[missing]',
    },
    device_id,
    deviceId: device_id,
    platform,
    user_agent,
    userAgent: user_agent,
    device_label,
    deviceLabel: device_label,
    app_version,
    appVersion: app_version,
    service_worker_version,
    serviceWorkerVersion: service_worker_version,
    sw_version,
    swVersion: sw_version,
    timezone,
    notification_permission,
    notificationPermission: notification_permission,
    metadata: {
      device_id,
      deviceId: device_id,
      platform,
      user_agent,
      userAgent: user_agent,
      device_label,
      deviceLabel: device_label,
      app_version,
      appVersion: app_version,
      service_worker_version,
      serviceWorkerVersion: service_worker_version,
      sw_version,
      swVersion: sw_version,
      timezone,
      notification_permission,
      notificationPermission: notification_permission,
    },
    subscription: {
      endpoint,
      p256dh: p256dh ? '[present]' : '[missing]',
      auth: auth ? '[present]' : '[missing]',
      keys: {
        p256dh: p256dh ? '[present]' : '[missing]',
        auth: auth ? '[present]' : '[missing]',
      },
      device_id,
      deviceId: device_id,
      platform,
      user_agent,
      userAgent: user_agent,
      device_label,
      deviceLabel: device_label,
      app_version,
      appVersion: app_version,
      service_worker_version,
      serviceWorkerVersion: service_worker_version,
      sw_version,
      swVersion: sw_version,
      timezone,
      notification_permission,
      notificationPermission: notification_permission,
    },
  };

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Browser did not return a complete push subscription.');
  }

  logPush('detected platform', {
    platform,
    userAgent: user_agent,
    navigatorPlatform: navigator.platform || '',
    standalone: isStandalonePwa(),
  });
  logPush('current device_id', { device_id, storageKey: DEVICE_ID_KEY });
  logPush('current endpoint', { endpoint });
  logPush('payload sent to API', loggedPayload);
  logPush('RESUBSCRIBE_THIS_DEVICE payload sent to /api/push/subscribe', loggedPayload);
  debugPush('saving subscription through API', {
    endpoint,
    deviceId: device_id,
    platform,
    hasP256dh: Boolean(p256dh),
    hasAuth: Boolean(auth),
  });

  const result = await fetchJson(
    `${API_BASE}/subscribe`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Unable to save push subscription.'
  );

  debugPush('API save response', result);
  const verifiedDeviceId = result?.verification?.device_id || result?.upserted?.device_id || result?.device_id || result?.deviceId || '';
  const verifiedPlatform = result?.verification?.platform || result?.upserted?.platform || result?.platform || '';
  const verifiedAppVersion = result?.verification?.app_version || result?.upserted?.app_version || result?.app_version || result?.appVersion || '';
  const verifiedServiceWorkerVersion = result?.verification?.service_worker_version || result?.upserted?.service_worker_version || result?.service_worker_version || result?.serviceWorkerVersion || '';
  if (!verifiedDeviceId || !verifiedPlatform || !verifiedAppVersion || !verifiedServiceWorkerVersion) {
    console.warn('[PushNotifications] Supabase save response did not verify metadata:', {
      endpoint,
      sentDeviceId: device_id,
      sentPlatform: platform,
      sentAppVersion: app_version,
      sentServiceWorkerVersion: service_worker_version,
      verifiedDeviceId,
      verifiedPlatform,
      verifiedAppVersion,
      verifiedServiceWorkerVersion,
      result,
    });
  }
  storePushSubscriptionEndpoint(endpoint);
  return {
    ...result,
    sent: {
      endpoint,
      device_id,
      deviceId: device_id,
      platform,
      app_version,
      appVersion: app_version,
      service_worker_version,
      serviceWorkerVersion: service_worker_version,
      sw_version,
      swVersion: sw_version,
      user_agent_saved: Boolean(user_agent),
      userAgentSaved: Boolean(user_agent),
    },
  };
}

async function checkSubscriptionSavedToServer(endpoint) {
  if (!endpoint) return null;

  logPush('checking exact endpoint in Supabase', { endpoint });

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
    message: 'This device is subscribed.',
    support,
    registration,
    subscription,
    serverSubscription,
  };
}

export async function subscribeToLineupPushNotifications({ forceNew = false } = {}) {
  const support = getPushSupportStatus();
  debugPush('Enable Notifications tapped', {
    notificationPermission: support.permission,
    serviceWorkerSupported: support.hasServiceWorker,
    pushManagerSupported: support.hasPushManager,
  });

  if (!support.supported) {
    throw new Error(support.reason);
  }

  if (support.isIos && !support.isStandalone) {
    throw new Error('Install this app to Home Screen, then open it from the Home Screen icon to enable notifications.');
  }

  const permission = support.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();
  debugPush('notification permission result', { permission });

  if (permission !== 'granted') {
    throw new Error(permission === 'denied' ? 'Notification permission denied.' : 'Notification permission was not granted.');
  }

  const registration = await getServiceWorkerRegistration({ ensure: true });
  debugPush('service worker registration status', {
    active: Boolean(registration?.active),
    waiting: Boolean(registration?.waiting),
    installing: Boolean(registration?.installing),
    scope: registration?.scope || '',
  });

  if (!registration?.active) {
    throw new Error('Service worker not active yet. Reload the app, then try again.');
  }

  const publicKey = await getApplicationServerKey();
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

  const saveResult = await saveSubscriptionToServer(subscription);

  return {
    message: 'This device is subscribed.',
    subscription,
    saveResult,
  };
}

export async function resubscribeToLineupPushNotifications() {
  const result = await subscribeToLineupPushNotifications({ forceNew: true });
  return {
    ...result,
    message: 'Device resubscribed for phone notifications.',
  };
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
        subscription: health.subscription.toJSON(),
        targetEndpoint: health.subscription.endpoint,
        title: 'CCFBC Line Up Test',
        body: 'Push notifications are working on this device.',
        url: '/',
      }),
    },
    'Unable to send test notification.'
  );

  const successCount = result.successCount ?? result.sent ?? 0;

  if (successCount < 1) {
    throw new Error('Test push was accepted, but no active subscription was reached.');
  }

  debugPush('backend push send result', result);
  return result;
}

export async function sendTestPushNotificationToAllDevices() {
  const result = await fetchJson(
    `${API_BASE}/send-test`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'CCFBC Line Up Test',
        body: 'Push notifications are working on this device.',
        url: '/',
      }),
    },
    'Unable to send test notification to all devices.'
  );

  const totalSubscriptions = result.totalSubscriptions ?? result.total ?? 0;

  if (totalSubscriptions < 1) {
    throw new Error('No active push subscriptions were found.');
  }

  debugPush('backend push send-all result', result);
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
      metadataSavedInSupabase: Boolean(serverSubscription?.metadataSaved || serverSubscription?.metadata_saved),
      activeInSupabase: Boolean(serverSubscription?.saved) && serverSubscription?.active !== false,
      saveCheckUnavailable: Boolean(serverSubscription?.checkUnavailable),
      serverDeviceId: serverSubscription?.deviceId || serverSubscription?.device_id || '',
      serverPlatform: serverSubscription?.platform || '',
      serverUserAgentSaved: Boolean(serverSubscription?.userAgentSaved || serverSubscription?.user_agent_saved),
      serverAppVersion: serverSubscription?.appVersion || serverSubscription?.app_version || '',
      serverServiceWorkerVersion: serverSubscription?.serviceWorkerVersion || serverSubscription?.service_worker_version || '',
      serverSwVersion: serverSubscription?.sw_version || serverSubscription?.serviceWorkerVersion || serverSubscription?.service_worker_version || '',
      serverTimezone: serverSubscription?.timezone || '',
      serverNotificationPermission: serverSubscription?.notification_permission || '',
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
      platform: getPushPlatform(),
    },
  };
}

export async function sendLineupPushNotification(lineup, { eventType = 'UPDATE', excludeCurrentDevice = true } = {}) {
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
        eventType,
        updatedAt: lineup.updatedAt || lineup.updated_at || lineup.createdAt || lineup.created_at || new Date().toISOString(),
        excludeEndpoint: excludeCurrentDevice ? getStoredPushSubscriptionEndpoint() : '',
      }),
    },
    'Unable to send lineup push notification.'
  );

  debugPush('lineup push send result', result);
  return result;
}
