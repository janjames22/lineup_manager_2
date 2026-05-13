import {
  allowMethods,
  debugPushServer,
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
} from '../_push.js';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const config = getSupabaseConfigStatus();
    response.status(500).json({ error: config.reason || 'Push subscription storage is not configured.' });
    return;
  }

  const subscription = normalizeSubscription(getRequestBody(request), request);
  logPushServer('subscription save request received', {
    endpointReceived: subscription.endpoint,
    deviceIdReceived: subscription.device_id,
    platformReceived: subscription.platform,
    hasUserAgent: Boolean(subscription.user_agent),
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

    debugPushServer('subscription saved to Supabase', {
      endpoint: saved.endpoint,
      deviceId: subscription.device_id,
      platform: subscription.platform,
      hasUserAgent: Boolean(subscription.user_agent),
    });
    response.status(200).json({
      ok: true,
      endpoint: saved.endpoint,
      deviceId: subscription.device_id,
      device_id: subscription.device_id,
      platform: subscription.platform,
      userAgentSaved: Boolean(subscription.user_agent),
      user_agent_saved: Boolean(subscription.user_agent),
      verified: true,
      lastSeenAt: verified.last_seen_at || null,
      updatedAt: verified.updated_at || null,
      received: {
        endpoint: subscription.endpoint,
        device_id: subscription.device_id,
        platform: subscription.platform,
        user_agent_saved: Boolean(subscription.user_agent),
      },
      upserted: {
        endpoint: saved.endpoint,
        device_id: saved.device_id || '',
        platform: saved.platform || '',
        user_agent_saved: Boolean(saved.user_agent),
        is_active: saved.is_active !== false,
        last_seen_at: saved.last_seen_at || null,
        updated_at: saved.updated_at || null,
      },
      verification: {
        saved: Boolean(verified.endpoint),
        endpoint: verified.endpoint || '',
        device_id: verified.device_id || '',
        platform: verified.platform || '',
        user_agent_saved: Boolean(verified.user_agent),
        is_active: verified.is_active !== false,
        last_seen_at: verified.last_seen_at || null,
        updated_at: verified.updated_at || null,
      },
    });
  } catch (error) {
    console.error('[PushNotifications] failed to save push subscription:', error);
    if (MISSING_COLUMN_CODES.has(error.code)) {
      response.status(500).json({ error: 'push_subscriptions table missing or outdated. Apply supabase-schema.sql in Supabase.' });
      return;
    }

    response.status(500).json({ error: `Subscription save failed: ${error.message || 'Unable to save push subscription.'}` });
  }
}
