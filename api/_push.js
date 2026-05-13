/* global process */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import webPush from 'web-push';

export const MISSING_COLUMN_CODES = new Set(['42P01', '42703', 'PGRST204', 'PGRST205']);
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

export function debugPushServer(message, details) {
  if (IS_PRODUCTION) return;
  if (typeof details === 'undefined') {
    console.log(`[PushNotifications] ${message}`);
    return;
  }
  console.log(`[PushNotifications] ${message}`, details);
}

export function logPushServer(message, details) {
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
      return {};
    }
  }
  return typeof request.body === 'object' ? request.body : {};
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
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function normalizeSubscription(body = {}, request) {
  const source = body.subscription || {};
  const keys = body.keys || source.keys || {};
  const endpoint = body.endpoint || source.endpoint || '';
  const p256dh = body.p256dh || keys.p256dh || source.p256dh || '';
  const auth = body.auth || keys.auth || source.auth || '';
  const userAgent = body.user_agent || body.userAgent || source.user_agent || source.userAgent || getHeader(request, 'user-agent') || null;
  const requestedDeviceId = body.device_id || body.deviceId || source.device_id || source.deviceId || null;
  const requestedPlatform = body.platform || source.platform || null;
  const deviceId = requestedDeviceId || (endpoint ? createFallbackDeviceId(endpoint, userAgent || '') : null);
  const platform = detectPlatformFromUserAgent(userAgent || '', requestedPlatform || '');

  return {
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent,
    device_label: body.device_label || body.deviceLabel || source.device_label || source.deviceLabel || null,
    device_id: deviceId,
    platform,
    metadata_source: {
      device_id: requestedDeviceId ? 'client' : 'server-fallback',
      platform: requestedPlatform ? 'client' : 'server-fallback',
    },
  };
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

  if (!deviceId) {
    return 'Missing push subscription device_id.';
  }

  if (deviceId.length > 200) {
    return 'Push subscription device_id is too long.';
  }

  if (!platform) {
    return 'Missing push subscription platform.';
  }

  if (!PUSH_PLATFORM_VALUES.has(platform)) {
    return 'Push subscription platform is invalid.';
  }

  if (!userAgent) {
    return 'Missing push subscription user_agent.';
  }

  return '';
}

export async function upsertPushSubscription(supabase, subscription, { selectResult = true } = {}) {
  const now = new Date().toISOString();
  const record = {
    endpoint: subscription.endpoint,
    p256dh: subscription.p256dh,
    auth: subscription.auth,
    user_agent: subscription.user_agent || null,
    device_label: subscription.device_label || null,
    device_id: subscription.device_id || null,
    platform: subscription.platform || null,
    updated_at: now,
    last_seen_at: now,
    is_active: true,
  };
  const loggedRecord = {
    ...record,
    p256dh: record.p256dh ? '[present]' : '[missing]',
    auth: record.auth ? '[present]' : '[missing]',
  };

  logPushServer('push subscription upsert start', {
    endpoint: subscription.endpoint,
    deviceId: subscription.device_id,
    platform: subscription.platform,
    hasUserAgent: Boolean(subscription.user_agent),
  });
  logPushServer('Supabase upsert payload', loggedRecord);

  const upsertResult = await supabase
    .from('push_subscriptions')
    .upsert(record, { onConflict: 'endpoint', ignoreDuplicates: false });

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
    endpoint: subscription.endpoint,
    deviceId: subscription.device_id,
    platform: subscription.platform,
    hasUserAgent: Boolean(subscription.user_agent),
    updatedAt: now,
  });

  if (!selectResult) {
    return {
      endpoint: subscription.endpoint,
      device_id: subscription.device_id,
      platform: subscription.platform,
      user_agent: subscription.user_agent,
      is_active: true,
      last_seen_at: now,
      updated_at: now,
    };
  }

  const { endpoint, ...updateRecord } = record;
  const updateResult = await supabase
    .from('push_subscriptions')
    .update(updateRecord)
    .eq('endpoint', endpoint)
    .select('endpoint,device_id,platform,user_agent,is_active,last_seen_at,updated_at')
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
    updatedAt: updateResult.data?.updated_at || now,
  });

  return updateResult.data;
}

export async function verifyPushSubscriptionSaved(supabase, endpoint) {
  logPushServer('push subscription verification start', { endpoint });

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint,is_active,last_seen_at,updated_at,device_id,platform,user_agent')
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
    updatedAt: data?.updated_at || null,
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
  return schedule || 'New lineup added';
}

export function createPushPayload({ title, body, url, tag, lineupId, timestamp }) {
  return JSON.stringify({
    type: lineupId ? 'lineup_created' : 'test',
    title: title || 'Line Up Manager',
    body: body || 'New notification',
    url: url || (lineupId ? `/lineups/${lineupId}` : '/lineups'),
    tag: tag || (lineupId ? `lineup-${lineupId}` : 'lineup-manager'),
    lineupId: lineupId || null,
    timestamp: timestamp || new Date().toISOString(),
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

  const existing = await supabase
    .from('lineup_notifications')
    .select('id')
    .eq('type', 'lineup_created')
    .eq('lineup_id', lineupId)
    .maybeSingle();

  if (!existing.error && existing.data?.id) return 0;

  if (existing.error && !MISSING_COLUMN_CODES.has(existing.error.code)) {
    console.error('[PushNotifications] failed to check existing lineup notification record:', existing.error);
    return 0;
  }

  const record = {
    type: notification.type || 'lineup_created',
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
