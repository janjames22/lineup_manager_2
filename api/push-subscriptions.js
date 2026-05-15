import {
  allowMethods,
  assertPushSubscriptionMetadataSaved,
  getRequestBody,
  getSupabaseAdmin,
  getSupabaseConfigStatus,
  logPushServer,
  MISSING_COLUMN_CODES,
  normalizeSubscription,
  upsertPushSubscription,
  validatePushSubscription,
  validatePushSubscriptionMetadata,
  verifyPushSubscriptionSaved,
} from './_push.js';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const config = getSupabaseConfigStatus();
    response.status(500).json({ error: config.reason || 'Push subscription storage is not configured.' });
    return;
  }

  const subscription = normalizeSubscription(getRequestBody(request), request);
  logPushServer('legacy subscription save request received', {
    endpointReceived: subscription.endpoint,
    deviceIdReceived: subscription.device_id,
    platformReceived: subscription.platform,
    hasUserAgent: Boolean(subscription.user_agent),
    appVersionReceived: subscription.app_version,
    serviceWorkerVersionReceived: subscription.service_worker_version,
    metadataSource: subscription.metadata_source,
  });

  const validationError = validatePushSubscription(subscription);
  if (validationError) {
    response.status(400).json({ error: validationError });
    return;
  }

  const metadataValidationError = validatePushSubscriptionMetadata(subscription);
  if (metadataValidationError) {
    response.status(400).json({ error: metadataValidationError });
    return;
  }

  try {
    const saved = await upsertPushSubscription(supabase, subscription);
    const verified = await verifyPushSubscriptionSaved(supabase, subscription.endpoint);

    if (!verified?.endpoint) {
      throw new Error('Push subscription upsert completed, but exact endpoint verification failed.');
    }
    assertPushSubscriptionMetadataSaved(verified, subscription);

    response.status(200).json({
      ok: true,
      endpoint: saved.endpoint,
      deviceId: subscription.device_id,
      device_id: subscription.device_id,
      platform: subscription.platform,
      appVersion: subscription.app_version,
      app_version: subscription.app_version,
      serviceWorkerVersion: subscription.service_worker_version,
      service_worker_version: subscription.service_worker_version,
      sw_version: subscription.sw_version || subscription.service_worker_version,
      timezone: subscription.timezone || null,
      notification_permission: subscription.notification_permission || null,
      userAgentSaved: Boolean(subscription.user_agent),
      user_agent_saved: Boolean(subscription.user_agent),
      verified: true,
      lastSeenAt: verified.last_seen_at || null,
      updatedAt: verified.updated_at || null,
      received: {
        endpoint: subscription.endpoint,
        device_id: subscription.device_id,
        platform: subscription.platform,
        app_version: subscription.app_version,
        service_worker_version: subscription.service_worker_version,
        sw_version: subscription.sw_version || subscription.service_worker_version,
        timezone: subscription.timezone || null,
        notification_permission: subscription.notification_permission || null,
        user_agent_saved: Boolean(subscription.user_agent),
        metadata_source: subscription.metadata_source,
      },
      upserted: {
        endpoint: saved.endpoint,
        device_id: saved.device_id || '',
        platform: saved.platform || '',
        app_version: saved.app_version || '',
        service_worker_version: saved.service_worker_version || '',
        sw_version: saved.sw_version || saved.service_worker_version || '',
        timezone: saved.timezone || null,
        notification_permission: saved.notification_permission || null,
        user_agent_saved: Boolean(saved.user_agent),
        is_active: saved.is_active !== false,
        last_seen_at: saved.last_seen_at || null,
        updated_at: saved.updated_at || null,
      },
      verification: {
        saved: Boolean(verified.endpoint),
        metadata_saved: Boolean(verified.device_id && verified.platform && verified.user_agent && verified.app_version && verified.service_worker_version),
        metadataSaved: Boolean(verified.device_id && verified.platform && verified.user_agent && verified.app_version && verified.service_worker_version),
        endpoint: verified.endpoint || '',
        device_id: verified.device_id || '',
        platform: verified.platform || '',
        app_version: verified.app_version || '',
        service_worker_version: verified.service_worker_version || '',
        sw_version: verified.sw_version || verified.service_worker_version || '',
        timezone: verified.timezone || null,
        notification_permission: verified.notification_permission || null,
        user_agent_saved: Boolean(verified.user_agent),
        is_active: verified.is_active !== false,
        last_seen_at: verified.last_seen_at || null,
        updated_at: verified.updated_at || null,
      },
    });
  } catch (error) {
    console.error('[PushNotifications] failed to save push subscription:', error);
    if (error.code === 'PUSH_METADATA_NOT_SAVED') {
      response.status(500).json({
        error: error.message,
        missing: error.details?.missing || [],
        verification: error.details?.verified || null,
        expected: error.details?.expected || null,
      });
      return;
    }

    if (MISSING_COLUMN_CODES.has(error.code)) {
      response.status(500).json({ error: 'push_subscriptions table missing or outdated. Apply supabase-schema.sql in Supabase.' });
      return;
    }

    response.status(500).json({ error: `Subscription save failed: ${error.message || 'Unable to save push subscription.'}` });
  }
}
