import { supabase, isSupabaseConfigured } from './supabase';

const PUSH_SUBSCRIPTION_ENDPOINT_KEY = 'lineupManagerPushSubscriptionEndpoint';
const STABLE_PRODUCTION_HOST = 'ccfbc-lineup-manager-code.vercel.app';

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

function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function getPushSupportStatus() {
  const hasWindow = typeof window !== 'undefined';
  const hasNavigator = typeof navigator !== 'undefined';
  const hasNotification = hasWindow && 'Notification' in window;
  const hasServiceWorker = hasNavigator && 'serviceWorker' in navigator;
  const hasPushManager = hasWindow && 'PushManager' in window;
  const isStandalone = isStandalonePwa();
  const isIos = isIosDevice();
  const hasVapidPublicKey = Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY);
  const permission = hasNotification ? Notification.permission : 'unsupported';
  const userAgent = hasNavigator ? navigator.userAgent : '';
  const hostname = hasWindow ? window.location.hostname : '';
  const isVercelPreview = hostname.endsWith('.vercel.app') && hostname !== STABLE_PRODUCTION_HOST;
  const supported = hasNotification && hasServiceWorker && hasPushManager && hasVapidPublicKey;
  const canEnable = supported && permission !== 'denied' && (!isIos || isStandalone);

  let reason = 'Supported — tap Enable phone notifications';
  if (!hasNotification) reason = 'Missing Notification API support';
  else if (permission === 'denied') reason = 'Notifications permission denied';
  else if (!hasServiceWorker) reason = 'Missing service worker support';
  else if (!hasPushManager) reason = 'Missing PushManager support';
  else if (!hasVapidPublicKey) reason = 'Missing VAPID public key';
  else if (isIos && !isStandalone) reason = 'Open from Home Screen app first';

  const status = {
    hasNotification,
    hasServiceWorker,
    hasPushManager,
    isStandalone,
    hasVapidPublicKey,
    permission,
    userAgent,
    supported,
    canEnable,
    isIos,
    isVercelPreview,
    hostname,
    reason,
  };

  console.log('[PushNotifications] support status:', status);

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

async function saveSubscription(subscription) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured before phone notifications can be saved.');
  }

  const json = subscription.toJSON();
  const payload = {
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    user_agent: navigator.userAgent || '',
  };

  if (!payload.endpoint || !payload.p256dh || !payload.auth) {
    throw new Error('Browser did not return a complete push subscription.');
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(payload, {
      onConflict: 'endpoint',
    });

  if (error) {
    console.error('[PushNotifications] failed to save push subscription:', error);
    throw new Error(error.message || 'Unable to save push subscription.');
  }

  console.log('[PushNotifications] subscription saved:', payload);
  storePushSubscriptionEndpoint(payload.endpoint);
  return payload;
}

export async function subscribeToLineupPushNotifications() {
  const support = getPushSupportStatus();
  if (!support.supported) {
    throw new Error(support.reason);
  }

  if (support.isIos && !support.isStandalone) {
    throw new Error('Install this app to Home Screen, then open it from the Home Screen icon to enable notifications.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('[PushNotifications] permission not granted:', permission);
    throw new Error(permission === 'denied' ? 'Permission denied.' : 'Permission was not granted.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
  });
  console.log('[PushNotifications] service worker registered:', registration);

  await navigator.serviceWorker.ready;
  console.log('[PushNotifications] service worker ready');

  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
  });

  console.log('[PushNotifications] subscription created:', subscription);

  await saveSubscription(subscription);

  return {
    message: 'Phone notifications enabled for this device.',
    subscription,
  };
}

export async function sendTestPushNotification() {
  const response = await fetch('/api/send-lineup-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      test: true,
      title: 'Line Up Manager',
      body: 'Test phone notification',
      url: '/lineups',
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Unable to send test notification.');
  }

  return response.json();
}

export async function sendLineupPushNotification(lineup) {
  if (!lineup?.id) return;

  const targetUrl = `/lineups/${lineup.id}`;
  const response = await fetch('/api/send-lineup-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lineupId: lineup.id,
      url: targetUrl,
      excludeEndpoint: getStoredPushSubscriptionEndpoint(),
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Unable to send lineup push notification.');
  }
}
