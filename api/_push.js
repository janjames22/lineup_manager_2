/* global process */
import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import webPush from 'web-push';

export const MISSING_COLUMN_CODES = new Set(['42P01', '42703', 'PGRST204', 'PGRST205']);
const MISSING_RPC_CODES = new Set(['42883', 'PGRST202']);
export const PUSH_PLATFORM_VALUES = new Set([
  'ios-pwa',
  'ios-safari',
  'android-pwa',
  'android-chrome',
  'mac-safari',
  'desktop-chrome',
  'desktop-other',
]);
const DUPLICATE_KEY_CODE = '23505';
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingRpcError(error) {
  return MISSING_RPC_CODES.has(error?.code)
    || /could not find the function/i.test(error?.message || '')
    || /function .* does not exist/i.test(error?.message || '');
}

export function debugPushServer(message, details) {
  if (IS_PRODUCTION) return;
  if (typeof details === 'undefined') {
    console.log(`[PushNotifications] ${message}`);
    return;
  }
  console.log(`[PushNotifications] ${message}`, details);
}

export function logPushServer(message, details) {
  if (IS_PRODUCTION) return;
  if (typeof details === 'undefined') {
    console.log(`[PushNotifications] ${message}`);
    return;
  }
  console.log(`[PushNotifications] ${message}`, details);
}

export function getRequestBody(request) {
  if (!request?.body) return {};
  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body);
    } catch {
      console.warn('[PushNotifications] request body could not be parsed as JSON');
      return {};
    }
  }
  return typeof request.body === 'object' ? request.body : {};
}

export function requireAdminToken(request, response) {
  const token = process.env.PUSH_ADMIN_TOKEN;
  if (!token) return false;
  const auth = getHeader(request, 'authorization') || getHeader(request, 'x-admin-token');
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (provided !== token) {
    response.status(401).json({ error: 'Unauthorized.' });
    return true;
  }
  return false;
}

export function getHeader(request, name) {
  return request?.headers?.[name] || request?.headers?.get?.(name) || '';
}

function detectPlatformFromUserAgent(userAgent = '', hintedPlatform = '') {
  const ua = String(userAgent || '');
  const hint = String(hintedPlatform || '');
  const isIos = /iPad|iPhone|iPod/i.test(ua) || /Macintosh/i.test(ua) && /Mobile\/\w+/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Edg|Firefox)/i.test(ua);
  const isChrome = /(Chrome|CriOS|Chromium|Edg\/|OPR\/)/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIos;

  if (PUSH_PLATFORM_VALUES.has(hint)) return hint;
  if (hint === 'ios') return 'ios-pwa';
  if (hint === 'android') return 'android-chrome';
  if (hint === 'web') return isMac && isSafari ? 'mac-safari' : isChrome ? 'desktop-chrome' : 'desktop-other';
  if (isIos) return 'ios-pwa';
  if (isAndroid) return 'android-chrome';
  if (isMac && isSafari) return 'mac-safari';
  if (isChrome) return 'desktop-chrome';
  return 'desktop-other';
}

function createFallbackDeviceId(endpoint = '', userAgent = '') {
  const hash = createHash('sha256')
    .update(`${endpoint}|${userAgent}`)
    .digest('hex')
    .slice(0, 32);
  return `server-${hash}`;
}

function firstTextValue(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }

  return null;
}

export function allowMethods(request, response, methods) {
  if (methods.includes(request.method)) return true;
  response.setHeader('Allow', methods.join(', '));
  response.status(405).json({ error: 'Method not allowed.' });
  return false;
}

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getSupabaseConfigStatus() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    return {
      ok: false,
      reason: 'Supabase URL missing. Add SUPABASE_URL or VITE_SUPABASE_URL on the server.',
    };
  }

  if (!serviceRoleKey) {
    return {
      ok: false,
      reason: 'Supabase service role key missing. Add SUPABASE_SERVICE_ROLE_KEY on the server.',
    };
  }

  return {
    ok: true,
    hasServiceRoleKey: true,
  };
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '';
}

export function getVapidConfig() {
  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  // BUG-014: VAPID_SUBJECT must be a real mailto: address. In production, the
  // placeholder breaks deliverability on some push services and exposes the
  // wrong identity. Throw in production; warn + fall back only in development.
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey) return null;

  if (!subject) {
    if (IS_PRODUCTION) {
      const error = new Error('VAPID_SUBJECT environment variable is required. Set it to mailto:your@email.com in Vercel project settings.');
      error.statusCode = 500;
      throw error;
    }
    console.warn('[PushNotifications] VAPID_SUBJECT is not set — using placeholder. Set VAPID_SUBJECT=mailto:your@email.com for production.');
    return { publicKey, privateKey, subject: 'mailto:admin@example.com' };
  }

  return { publicKey, privateKey, subject };
}

export function normalizeSubscription(body = {}, request) {
  const source = body.subscription || {};
  const metadata = body.metadata || source.metadata || {};
  const device = body.device || source.device || {};
  const keys = body.keys || source.keys || {};
  const endpoint = firstTextValue(body.endpoint, source.endpoint) || '';
  const p256dh = firstTextValue(body.p256dh, keys.p256dh, source.p256dh) || '';
  const auth = firstTextValue(body.auth, keys.auth, source.auth) || '';
  const userAgent = firstTextValue(
    body.user_agent,
    body.userAgent,
    source.user_agent,
    source.userAgent,
    metadata.user_agent,
    metadata.userAgent,
    getHeader(request, 'user-agent')
  );
  const requestedDeviceId = firstTextValue(
    body.device_id,
    body.deviceId,
    source.device_id,
    source.deviceId,
    metadata.device_id,
    metadata.deviceId,
    device.id,
    device.device_id,
    device.deviceId
  );
  const requestedPlatform = firstTextValue(
    body.platform,
    source.platform,
    metadata.platform,
    device.platform
  );
  const requestedAppVersion = firstTextValue(
    body.app_version,
    body.appVersion,
    source.app_version,
    source.appVersion,
    metadata.app_version,
    metadata.appVersion
  );
  const requestedServiceWorkerVersion = firstTextValue(
    body.service_worker_version,
    body.serviceWorkerVersion,
    body.sw_version,
    body.swVersion,
    source.service_worker_version,
    source.serviceWorkerVersion,
    source.sw_version,
    source.swVersion,
    metadata.service_worker_version,
    metadata.serviceWorkerVersion,
    metadata.sw_version,
    metadata.swVersion
  );
  const requestedTimezone = firstTextValue(
    body.timezone,
    source.timezone,
    metadata.timezone,
    device.timezone
  );
  const requestedNotificationPermission = firstTextValue(
    body.notification_permission,
    body.notificationPermission,
    source.notification_permission,
    source.notificationPermission,
    metadata.notification_permission,
    metadata.notificationPermission
  );
  const deviceId = requestedDeviceId || (endpoint ? createFallbackDeviceId(endpoint, userAgent || '') : null);
  const platform = detectPlatformFromUserAgent(userAgent || '', requestedPlatform || '');
  const appVersion = requestedAppVersion || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'server-unknown';
  const serviceWorkerVersion = requestedServiceWorkerVersion || appVersion;

  return {
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent,
    device_label: firstTextValue(
      body.device_label,
      body.deviceLabel,
      source.device_label,
      source.deviceLabel,
      metadata.device_label,
      metadata.deviceLabel,
      device.label,
      device.device_label,
      device.deviceLabel
    ),
    device_id: deviceId,
    platform,
    app_version: appVersion,
    service_worker_version: serviceWorkerVersion,
    sw_version: serviceWorkerVersion,
    timezone: requestedTimezone,
    notification_permission: requestedNotificationPermission,
    metadata_source: {
      device_id: requestedDeviceId ? 'client' : 'server-fallback',
      platform: requestedPlatform ? 'client' : 'server-fallback',
      app_version: requestedAppVersion ? 'client' : 'server-fallback',
      service_worker_version: requestedServiceWorkerVersion ? 'client' : 'server-fallback',
    },
  };
}

export function getPushSubscriptionMetadataStatus(row = {}) {
  const missing = [];
  const warnings = [];

  if (!row?.device_id) missing.push('device_id');
  if (!row?.platform) missing.push('platform');
  
  if (!row?.user_agent) warnings.push('user_agent');
  if (!row?.app_version) warnings.push('app_version');
  if (!row?.service_worker_version && !row?.sw_version) warnings.push('service_worker_version');

  return {
    saved: missing.length === 0,
    missing,
    warnings,
  };
}

export function assertPushSubscriptionMetadataSaved(row = {}, subscription = {}) {
  const status = getPushSubscriptionMetadataStatus(row);
  if (status.saved) return;

  const error = new Error(`Push subscription saved, but Supabase verification still has NULL metadata: ${status.missing.join(', ')}.`);
  error.code = 'PUSH_METADATA_NOT_SAVED';
  error.details = {
    endpoint: row?.endpoint || subscription.endpoint || '',
    missing: status.missing,
    expected: {
      device_id: subscription.device_id || '',
      platform: subscription.platform || '',
      app_version: subscription.app_version || '',
      service_worker_version: subscription.service_worker_version || '',
      user_agent_saved: Boolean(subscription.user_agent),
    },
    verified: {
      device_id: row?.device_id || '',
      platform: row?.platform || '',
      app_version: row?.app_version || '',
      service_worker_version: row?.service_worker_version || row?.sw_version || '',
      user_agent_saved: Boolean(row?.user_agent),
    },
  };
  throw error;
}

export function validatePushSubscription(subscription = {}) {
  const endpoint = String(subscription.endpoint || '');
  const p256dh = String(subscription.p256dh || '');
  const auth = String(subscription.auth || '');

  if (!endpoint || !p256dh || !auth) {
    return 'Missing push subscription fields.';
  }

  let parsedEndpoint;
  try {
    parsedEndpoint = new URL(endpoint);
  } catch {
    return 'Push subscription endpoint is not a valid URL.';
  }

  if (parsedEndpoint.protocol !== 'https:') {
    return 'Push subscription endpoint must use HTTPS.';
  }

  if (endpoint.length < 20 || endpoint.length > 2048) {
    return 'Push subscription endpoint length is invalid.';
  }

  if (p256dh.length < 40 || p256dh.length > 512 || auth.length < 10 || auth.length > 256) {
    return 'Push subscription keys are invalid.';
  }

  return '';
}

export function validatePushSubscriptionMetadata(subscription = {}) {
  const deviceId = String(subscription.device_id || '');
  const platform = String(subscription.platform || '');
  const userAgent = String(subscription.user_agent || '');
  const appVersion = String(subscription.app_version || '');
  const serviceWorkerVersion = String(subscription.service_worker_version || subscription.sw_version || '');
  const timezone = String(subscription.timezone || '');
  const notificationPermission = String(subscription.notification_permission || '');

  if (deviceId.length > 200) {
    return 'Push subscription device_id is too long.';
  }

  if (platform && !PUSH_PLATFORM_VALUES.has(platform)) {
    return 'Push subscription platform is invalid.';
  }

  if (userAgent.length > 1000) {
    return 'Push subscription user_agent is too long.';
  }

  if (timezone.length > 100) {
    return 'Push subscription timezone is too long.';
  }

  if (notificationPermission.length > 40) {
    return 'Push subscription notification_permission is too long.';
  }

  if (appVersion.length > 200 || serviceWorkerVersion.length > 200) {
    return 'Push subscription app or service worker version is too long.';
  }

  return '';
}

export async function upsertPushSubscription(supabase, subscription, { selectResult = true } = {}) {
  const now = new Date().toISOString();
  const row = {
    endpoint: subscription.endpoint,
    p256dh: subscription.p256dh,
    auth: subscription.auth,
    device_id: subscription.device_id,
    platform: subscription.platform,
    user_agent: subscription.user_agent,
    device_label: subscription.device_label || null,
    app_version: subscription.app_version,
    service_worker_version: subscription.service_worker_version,
    sw_version: subscription.sw_version || subscription.service_worker_version,
    timezone: subscription.timezone || null,
    notification_permission: subscription.notification_permission || null,
    is_active: true,
    last_seen_at: now,
    updated_at: now,
  };
  const loggedRecord = {
    ...row,
    p256dh: row.p256dh ? '[present]' : '[missing]',
    auth: row.auth ? '[present]' : '[missing]',
  };

  logPushServer('push subscription upsert start', {
    endpoint: subscription.endpoint,
    deviceId: subscription.device_id,
    platform: subscription.platform,
    hasUserAgent: Boolean(subscription.user_agent),
    appVersion: subscription.app_version,
    serviceWorkerVersion: subscription.service_worker_version,
  });
  logPushServer('Supabase upsert payload', loggedRecord);

  const rpcResult = await supabase
    .rpc('upsert_push_subscription', { subscription_payload: row })
    .single();

  if (!rpcResult.error) {
    logPushServer('push subscription rpc upsert success', {
      endpoint: rpcResult.data?.endpoint || subscription.endpoint,
      deviceId: rpcResult.data?.device_id || '',
      platform: rpcResult.data?.platform || '',
      hasUserAgent: Boolean(rpcResult.data?.user_agent),
      appVersion: rpcResult.data?.app_version || '',
      serviceWorkerVersion: rpcResult.data?.service_worker_version || rpcResult.data?.sw_version || '',
      updatedAt: rpcResult.data?.updated_at || now,
      metadata: getPushSubscriptionMetadataStatus(rpcResult.data),
    });
    return rpcResult.data;
  }

  if (!isMissingRpcError(rpcResult.error)) {
    console.error('[PushNotifications] push subscription rpc upsert failure:', {
      endpoint: subscription.endpoint,
      deviceId: subscription.device_id,
      platform: subscription.platform,
      errorCode: rpcResult.error.code,
      errorMessage: rpcResult.error.message,
    });

    if (MISSING_COLUMN_CODES.has(rpcResult.error.code)) {
      const schemaError = new Error('push_subscriptions table is missing metadata columns. Apply supabase-schema.sql, then resubscribe this device.');
      schemaError.code = rpcResult.error.code;
      schemaError.cause = rpcResult.error;
      throw schemaError;
    }

    throw rpcResult.error;
  }

  logPushServer('push subscription rpc unavailable; falling back to direct table upsert', {
    errorCode: rpcResult.error.code,
    errorMessage: rpcResult.error.message,
  });

  const upsertResult = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' })
    .select()
    .single();

  if (upsertResult.error) {
    console.error('[PushNotifications] push subscription upsert failure:', {
      endpoint: subscription.endpoint,
      deviceId: subscription.device_id,
      platform: subscription.platform,
      errorCode: upsertResult.error.code,
      errorMessage: upsertResult.error.message,
    });

    if (MISSING_COLUMN_CODES.has(upsertResult.error.code)) {
      const schemaError = new Error('push_subscriptions table is missing metadata columns. Apply supabase-schema.sql, then resubscribe this device.');
      schemaError.code = upsertResult.error.code;
      schemaError.cause = upsertResult.error;
      throw schemaError;
    }

    throw upsertResult.error;
  }

  logPushServer('push subscription upsert success', {
    endpoint: upsertResult.data?.endpoint || subscription.endpoint,
    deviceId: upsertResult.data?.device_id || '',
    platform: upsertResult.data?.platform || '',
    hasUserAgent: Boolean(upsertResult.data?.user_agent),
    appVersion: upsertResult.data?.app_version || '',
    serviceWorkerVersion: upsertResult.data?.service_worker_version || '',
    updatedAt: upsertResult.data?.updated_at || now,
    metadata: getPushSubscriptionMetadataStatus(upsertResult.data),
  });

  if (!selectResult) {
    return {
      endpoint: subscription.endpoint,
      device_id: subscription.device_id,
      platform: subscription.platform,
      user_agent: subscription.user_agent,
      app_version: subscription.app_version,
      service_worker_version: subscription.service_worker_version,
      sw_version: subscription.sw_version || subscription.service_worker_version,
      timezone: subscription.timezone || null,
      notification_permission: subscription.notification_permission || null,
      is_active: true,
      last_seen_at: now,
      updated_at: now,
    };
  }

  const { endpoint, ...updateRecord } = row;
  const updateResult = await supabase
    .from('push_subscriptions')
    .update(updateRecord)
    .eq('endpoint', endpoint)
    .select('endpoint,device_id,platform,user_agent,app_version,service_worker_version,sw_version,timezone,notification_permission,is_active,last_seen_at,updated_at')
    .single();

  if (updateResult.error) {
    console.error('[PushNotifications] push subscription metadata update failure:', {
      endpoint: subscription.endpoint,
      deviceId: subscription.device_id,
      platform: subscription.platform,
      errorCode: updateResult.error.code,
      errorMessage: updateResult.error.message,
    });

    if (MISSING_COLUMN_CODES.has(updateResult.error.code)) {
      const schemaError = new Error('push_subscriptions table is missing metadata columns. Apply supabase-schema.sql, then resubscribe this device.');
      schemaError.code = updateResult.error.code;
      schemaError.cause = updateResult.error;
      throw schemaError;
    }

    throw updateResult.error;
  }

  logPushServer('push subscription metadata update success', {
    endpoint: updateResult.data?.endpoint || subscription.endpoint,
    deviceId: updateResult.data?.device_id || '',
    platform: updateResult.data?.platform || '',
    hasUserAgent: Boolean(updateResult.data?.user_agent),
    appVersion: updateResult.data?.app_version || '',
      serviceWorkerVersion: updateResult.data?.service_worker_version || updateResult.data?.sw_version || '',
    updatedAt: updateResult.data?.updated_at || now,
    metadata: getPushSubscriptionMetadataStatus(updateResult.data),
  });

  return updateResult.data;
}

export async function verifyPushSubscriptionSaved(supabase, endpoint) {
  logPushServer('push subscription verification start', { endpoint });

  const rpcResult = await supabase
    .rpc('get_push_subscription_by_endpoint', { subscription_endpoint: endpoint })
    .maybeSingle();

  if (!rpcResult.error) {
    logPushServer('push subscription rpc verification success', {
      endpoint,
      saved: Boolean(rpcResult.data?.endpoint),
      deviceId: rpcResult.data?.device_id || '',
      platform: rpcResult.data?.platform || '',
      hasUserAgent: Boolean(rpcResult.data?.user_agent),
      appVersion: rpcResult.data?.app_version || '',
      serviceWorkerVersion: rpcResult.data?.service_worker_version || rpcResult.data?.sw_version || '',
      updatedAt: rpcResult.data?.updated_at || null,
      metadata: getPushSubscriptionMetadataStatus(rpcResult.data),
    });
    return rpcResult.data;
  }

  if (!isMissingRpcError(rpcResult.error)) {
    console.error('[PushNotifications] push subscription rpc verification failure:', {
      endpoint,
      errorCode: rpcResult.error.code,
      errorMessage: rpcResult.error.message,
    });
    throw rpcResult.error;
  }

  logPushServer('push subscription rpc verification unavailable; falling back to direct table select', {
    errorCode: rpcResult.error.code,
    errorMessage: rpcResult.error.message,
  });

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint,is_active,last_seen_at,updated_at,device_id,platform,user_agent,app_version,service_worker_version,sw_version,timezone,notification_permission')
    .eq('endpoint', endpoint)
    .maybeSingle();

  if (error) {
    console.error('[PushNotifications] push subscription verification failure:', {
      endpoint,
      errorCode: error.code,
      errorMessage: error.message,
    });
    throw error;
  }

  logPushServer('push subscription verification success', {
    endpoint,
    saved: Boolean(data?.endpoint),
    deviceId: data?.device_id || '',
    platform: data?.platform || '',
    hasUserAgent: Boolean(data?.user_agent),
    appVersion: data?.app_version || '',
    serviceWorkerVersion: data?.service_worker_version || data?.sw_version || '',
    updatedAt: data?.updated_at || null,
    metadata: getPushSubscriptionMetadataStatus(data),
  });

  return data;
}

export async function deletePushSubscription(supabase, endpoint) {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) throw error;
}

export async function deactivatePushSubscription(supabase, endpoint) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('push_subscriptions')
    .update({
      is_active: false,
      updated_at: now,
      last_seen_at: now,
    })
    .eq('endpoint', endpoint);

  if (error) throw error;
}

export async function markExpiredSubscriptions(supabase, endpoints) {
  if (!endpoints.length) return;

  const now = new Date().toISOString();
  const updateResult = await supabase
    .from('push_subscriptions')
    .update({
      is_active: false,
      updated_at: now,
      last_seen_at: now,
    })
    .in('endpoint', endpoints);

  if (!updateResult.error) {
    debugPushServer('expired subscriptions marked inactive', { count: endpoints.length });
    return;
  }

  if (!MISSING_COLUMN_CODES.has(updateResult.error.code)) {
    console.error('[PushNotifications] failed to mark expired push subscriptions inactive:', updateResult.error);
    return;
  }

  const deleteResult = await supabase
    .from('push_subscriptions')
    .delete()
    .in('endpoint', endpoints);

  if (deleteResult.error) {
    console.error('[PushNotifications] failed to remove expired push subscriptions:', deleteResult.error);
  }
}

export async function loadPushSubscriptions(supabase, { excludeEndpoint = '', targetEndpoint = '' } = {}) {
  let query = supabase
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth,is_active,device_id,platform');

  if (targetEndpoint) {
    query = query.eq('endpoint', targetEndpoint);
  } else {
    query = query.eq('is_active', true);
  }

  let { data, error } = await query;

  if (error && MISSING_COLUMN_CODES.has(error.code)) {
    let fallbackQuery = supabase
      .from('push_subscriptions')
      .select('endpoint,p256dh,auth');

    if (targetEndpoint) {
      fallbackQuery = fallbackQuery.eq('endpoint', targetEndpoint);
    }

    const fallback = await fallbackQuery;
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;

  return (data || [])
    .filter((subscription) => subscription.endpoint && subscription.p256dh && subscription.auth)
    .filter((subscription) => subscription.is_active !== false)
    .filter((subscription) => subscription.endpoint !== excludeEndpoint);
}

export function formatLineupBody(lineup = {}) {
  const schedule = [lineup.date, lineup.service_time].filter(Boolean).join(' · ');
  const title = lineup.title || lineup.name || lineup.lineup_title || '';
  const leader = lineup.worship_leader ? `Worship Leader: ${lineup.worship_leader}` : '';
  return [title, schedule, leader].filter(Boolean).join(' · ') || 'Tap to open the latest lineup.';
}

export function createPushPayload({
  type,
  notificationType,
  title,
  body,
  url,
  tag,
  lineupId,
  songId,
  timestamp,
  notificationId,
  createdAt,
  renotify = true,
}) {
  const createdTimestamp = createdAt || timestamp || new Date().toISOString();
  const resolvedType = type || (lineupId ? 'lineup' : songId ? 'song' : 'test');
  const resolvedNotificationId = notificationId || randomUUID();

  return JSON.stringify({
    type: resolvedType,
    notificationType: notificationType || null,
    notificationId: resolvedNotificationId,
    id: resolvedNotificationId,
    title: title || 'Line Up Manager',
    body: body || 'New notification',
    url: url || (lineupId ? `/lineups/${lineupId}` : songId ? `/songs/${songId}` : '/'),
    tag: tag || (lineupId ? `lineup-${lineupId}` : songId ? `song-${songId}` : 'lineup-manager'),
    renotify,
    lineupId: lineupId || null,
    songId: songId || null,
    createdAt: createdTimestamp,
    timestamp: createdTimestamp,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  });
}

function parsePushPayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'object') return payload;

  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

function normalizeLineupNotificationId(lineupId) {
  if (!lineupId) return null;
  const id = String(lineupId);
  return UUID_PATTERN.test(id) ? id : null;
}

export async function createLineupNotificationRecords(supabase, payload, subscriptions, results) {
  const notification = parsePushPayload(payload);
  if (!notification.lineupId) return 0;
  const lineupId = normalizeLineupNotificationId(notification.lineupId);
  if (!lineupId) return 0;

  const deliveredCount = subscriptions
    .map((subscription, index) => ({ subscription, result: results[index] }))
    .filter(({ result }) => result?.status === 'fulfilled')
    .length;

  if (subscriptions.length && !deliveredCount) return 0;

  const recordType = notification.notificationType || (notification.type === 'lineup' ? 'lineup_created' : notification.type) || 'lineup_created';

  const existing = await supabase
    .from('lineup_notifications')
    .select('id')
    .eq('type', recordType)
    .eq('lineup_id', lineupId)
    .maybeSingle();

  if (!existing.error && existing.data?.id) return 0;

  if (existing.error && !MISSING_COLUMN_CODES.has(existing.error.code)) {
    console.error('[PushNotifications] failed to check existing lineup notification record:', existing.error);
    return 0;
  }

  const record = {
    type: recordType,
    lineup_id: lineupId,
    title: notification.title || 'New lineup added',
    body: notification.body || 'A new worship lineup has been posted.',
    url: notification.url || `/lineups/${lineupId}`,
    is_read: false,
  };

  const { error } = await supabase
    .from('lineup_notifications')
    .insert(record);

  if (error) {
    if (error.code === DUPLICATE_KEY_CODE) return 0;

    if (MISSING_COLUMN_CODES.has(error.code)) {
      console.error('[PushNotifications] lineup_notifications table is not ready. Apply supabase-schema.sql to enable server notification history.', error);
      return 0;
    }

    console.error('[PushNotifications] failed to create lineup notification records:', error);
    return 0;
  }

  return 1;
}

function getPushResultStatus(result) {
  if (result.status === 'fulfilled') return 'sent';
  const statusCode = result.reason?.statusCode;
  if (statusCode === 404 || statusCode === 410) return 'expired';
  return 'failed';
}

function getPushResultHttpStatus(result) {
  if (result.status === 'fulfilled') {
    return Number(result.value?.statusCode) || 201;
  }

  return Number(result.reason?.statusCode) || null;
}

function getPushResultErrorMessage(result) {
  if (result.status === 'fulfilled') return null;
  return result.reason?.body
    || result.reason?.message
    || result.reason?.toString?.()
    || 'Push delivery failed.';
}

export async function createPushDeliveryLogRecords(supabase, payload, subscriptions, results) {
  if (!supabase || !subscriptions.length) return 0;

  const notification = parsePushPayload(payload);
  const records = subscriptions.map((subscription, index) => {
    const result = results[index] || { status: 'rejected', reason: new Error('Missing push delivery result.') };
    return {
      notification_id: UUID_PATTERN.test(String(notification.notificationId || notification.id || ''))
        ? String(notification.notificationId || notification.id)
        : null,
      lineup_id: notification.lineupId || notification.lineup_id || null,
      subscription_endpoint: subscription.endpoint || null,
      device_id: subscription.device_id || null,
      platform: subscription.platform || null,
      status: getPushResultStatus(result),
      http_status: getPushResultHttpStatus(result),
      error_message: getPushResultErrorMessage(result),
    };
  });

  const { error } = await supabase
    .from('push_delivery_logs')
    .insert(records);

  if (error) {
    if (MISSING_COLUMN_CODES.has(error.code)) {
      console.error('[PushNotifications] push_delivery_logs table is not ready. Apply supabase-schema.sql to enable delivery diagnostics.', error);
      return 0;
    }

    console.error('[PushNotifications] failed to create push delivery logs:', error);
    return 0;
  }

  return records.length;
}

export async function loadLineup(supabase, lineupId) {
  const { data, error } = await supabase
    .from('lineups')
    .select('*')
    .eq('id', lineupId)
    .single();

  if (error || !data) {
    const notFoundError = new Error('Lineup not found.');
    notFoundError.cause = error;
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  return data;
}

export async function sendPushPayloadToSubscriptions(supabase, payload, subscriptions) {
  const vapid = getVapidConfig();
  if (!vapid) {
    const error = new Error('Web Push is not configured.');
    error.statusCode = 500;
    throw error;
  }

  webPush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const expiredEndpoints = [];
  const results = await Promise.allSettled(
    subscriptions.map((subscription) => webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      payload,
      {
        TTL: 24 * 60 * 60,
        urgency: 'high',
      }
    ))
  );

  results.forEach((result, index) => {
    if (result.status !== 'rejected') return;

    const statusCode = result.reason?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      expiredEndpoints.push(subscriptions[index].endpoint);
      return;
    }

    console.error('[PushNotifications] push send failed:', result.reason);
  });

  if (supabase) {
    await markExpiredSubscriptions(supabase, expiredEndpoints);
  }

  const deliveryLogs = supabase
    ? await createPushDeliveryLogRecords(supabase, payload, subscriptions, results)
    : 0;

  const notificationRecords = supabase
    ? await createLineupNotificationRecords(supabase, payload, subscriptions, results)
    : 0;

  const totalSubscriptions = subscriptions.length;
  const successCount = results.filter((result) => result.status === 'fulfilled').length;
  const failureCount = results.filter((result) => result.status === 'rejected').length;
  const expiredRemovedCount = expiredEndpoints.length;

  const summary = {
    ok: true,
    totalSubscriptions,
    successCount,
    failureCount,
    expiredRemovedCount,
    attempted: totalSubscriptions,
    inactiveMarked: expiredRemovedCount,
    total: totalSubscriptions,
    sent: successCount,
    failed: failureCount,
    expired: expiredRemovedCount,
    notificationRecords,
    deliveryLogs,
  };

  debugPushServer('backend push send result', summary);
  return summary;
}

export async function sendPushPayload(supabase, payload, { excludeEndpoint = '', targetEndpoint = '' } = {}) {
  const subscriptions = await loadPushSubscriptions(supabase, { excludeEndpoint, targetEndpoint });
  return sendPushPayloadToSubscriptions(supabase, payload, subscriptions);
}
