import {
  allowMethods,
  getRequestBody,
  getPushSubscriptionMetadataStatus,
  getSupabaseAdmin,
  getSupabaseConfigStatus,
  logPushServer,
  MISSING_COLUMN_CODES,
  verifyPushSubscriptionSaved,
} from '../_push.js';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const config = getSupabaseConfigStatus();
    response.status(200).json({
      ok: true,
      saved: null,
      active: null,
      checkUnavailable: true,
      error: config.ok
        ? 'Subscription verification requires SUPABASE_SERVICE_ROLE_KEY on the server.'
        : config.reason,
    });
    return;
  }

  const { endpoint } = getRequestBody(request);
  if (!endpoint) {
    response.status(400).json({ error: 'Missing push subscription endpoint.' });
    return;
  }

  logPushServer('subscription exact endpoint check received', { endpoint });

  let data = null;

  try {
    data = await verifyPushSubscriptionSaved(supabase, endpoint);
  } catch (error) {
    console.error('[PushNotifications] push subscription verification failure:', {
      endpoint,
      errorCode: error.code,
      errorMessage: error.message,
    });
    if (MISSING_COLUMN_CODES.has(error.code)) {
      response.status(500).json({ error: 'push_subscriptions table missing or outdated. Apply supabase-schema.sql in Supabase.' });
      return;
    }

    response.status(500).json({ error: error.message || 'Unable to check push subscription.' });
    return;
  }

  logPushServer('push subscription verification success', {
    endpoint,
    saved: Boolean(data?.endpoint),
    deviceId: data?.device_id || '',
    platform: data?.platform || '',
    hasUserAgent: Boolean(data?.user_agent),
    appVersion: data?.app_version || '',
    serviceWorkerVersion: data?.service_worker_version || '',
    updatedAt: data?.updated_at || null,
    metadata: getPushSubscriptionMetadataStatus(data),
  });

  const metadata = getPushSubscriptionMetadataStatus(data);

  response.status(200).json({
    ok: true,
    saved: Boolean(data?.endpoint),
    metadataSaved: metadata.saved,
    metadata_saved: metadata.saved,
    metadataMissing: metadata.missing,
    metadata_missing: metadata.missing,
    active: Boolean(data?.endpoint) && data?.is_active !== false,
    endpoint: data?.endpoint || endpoint,
    deviceId: data?.device_id || '',
    platform: data?.platform || '',
    appVersion: data?.app_version || '',
    app_version: data?.app_version || '',
    serviceWorkerVersion: data?.service_worker_version || '',
    service_worker_version: data?.service_worker_version || '',
    sw_version: data?.sw_version || data?.service_worker_version || '',
    timezone: data?.timezone || null,
    notification_permission: data?.notification_permission || null,
    userAgentSaved: Boolean(data?.user_agent),
    lastSeenAt: data?.last_seen_at || null,
    updatedAt: data?.updated_at || null,
  });
}
