/* global process */
import { createClient } from '@supabase/supabase-js';
import webPush from 'web-push';

const MISSING_COLUMN_CODES = new Set(['42P01', '42703', 'PGRST204', 'PGRST205']);
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
  const source = body.subscription || body;
  const keys = source.keys || body.keys || {};
  const endpoint = source.endpoint || body.endpoint || '';
  const p256dh = source.p256dh || body.p256dh || keys.p256dh || '';
  const auth = source.auth || body.auth || keys.auth || '';

  return {
    endpoint,
    p256dh,
    auth,
    user_agent: body.user_agent || body.userAgent || getHeader(request, 'user-agent') || '',
    device_label: body.device_label || body.deviceLabel || '',
  };
}

export async function upsertPushSubscription(supabase, subscription) {
  const now = new Date().toISOString();
  const record = {
    endpoint: subscription.endpoint,
    p256dh: subscription.p256dh,
    auth: subscription.auth,
    user_agent: subscription.user_agent || '',
    device_label: subscription.device_label || '',
    updated_at: now,
    last_seen_at: now,
    is_active: true,
  };

  const result = await supabase
    .from('push_subscriptions')
    .upsert(record, { onConflict: 'endpoint' })
    .select('endpoint')
    .single();

  if (!result.error) return result.data;

  if (!MISSING_COLUMN_CODES.has(result.error.code)) {
    throw result.error;
  }

  const fallbackRecord = {
    endpoint: record.endpoint,
    p256dh: record.p256dh,
    auth: record.auth,
    user_agent: record.user_agent,
    updated_at: record.updated_at,
  };

  const fallbackResult = await supabase
    .from('push_subscriptions')
    .upsert(fallbackRecord, { onConflict: 'endpoint' })
    .select('endpoint')
    .single();

  if (fallbackResult.error) throw fallbackResult.error;
  return fallbackResult.data;
}

export async function deletePushSubscription(supabase, endpoint) {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
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
    .select('endpoint,p256dh,auth,is_active');

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

export async function sendPushPayload(supabase, payload, { excludeEndpoint = '', targetEndpoint = '' } = {}) {
  const vapid = getVapidConfig();
  if (!vapid) {
    const error = new Error('Web Push is not configured.');
    error.statusCode = 500;
    throw error;
  }

  const subscriptions = await loadPushSubscriptions(supabase, { excludeEndpoint, targetEndpoint });

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

  await markExpiredSubscriptions(supabase, expiredEndpoints);
  const notificationRecords = await createLineupNotificationRecords(supabase, payload, subscriptions, results);

  const summary = {
    ok: true,
    total: subscriptions.length,
    sent: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length,
    expired: expiredEndpoints.length,
    notificationRecords,
  };

  debugPushServer('backend push send result', summary);
  return summary;
}
