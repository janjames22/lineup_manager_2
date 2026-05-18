import {
  allowMethods,
  getRequestBody,
  getSupabaseAdmin,
} from '../_push.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    response.status(500).json({ error: 'Notification storage is not configured.' });
    return;
  }

  const {
    notificationId,
    lineupId,
    subscriptionEndpoint,
    deviceId,
  } = getRequestBody(request);

  if (!notificationId && !(lineupId && (subscriptionEndpoint || deviceId))) {
    response.status(400).json({ error: 'Provide notificationId, or lineupId with subscriptionEndpoint/deviceId.' });
    return;
  }

  // BUG-013: when a notificationId is given, require subscriptionEndpoint or
  // deviceId so only the owning device can mark a notification read.
  if (notificationId && !subscriptionEndpoint && !deviceId) {
    response.status(400).json({ error: 'Provide subscriptionEndpoint or deviceId to verify ownership.' });
    return;
  }

  if (notificationId && !UUID_PATTERN.test(String(notificationId))) {
    response.status(400).json({ error: 'Invalid notificationId.' });
    return;
  }

  if (lineupId && !UUID_PATTERN.test(String(lineupId))) {
    response.status(400).json({ error: 'Invalid lineupId.' });
    return;
  }

  const now = new Date().toISOString();
  let query = supabase
    .from('lineup_notifications')
    .update({
      is_read: true,
      read_at: now,
      updated_at: now,
    });

  if (notificationId) {
    query = query.eq('id', notificationId);
    // BUG-013: scope the update to the owning device to prevent cross-user manipulation.
    if (subscriptionEndpoint) query = query.eq('subscription_endpoint', subscriptionEndpoint);
    else if (deviceId) query = query.eq('device_id', deviceId);
  } else {
    if (lineupId) query = query.eq('lineup_id', lineupId);
    if (subscriptionEndpoint) query = query.eq('subscription_endpoint', subscriptionEndpoint);
    if (deviceId) query = query.eq('device_id', deviceId);
  }

  const { data, error } = await query.select('id');

  if (error) {
    console.error('[LineupNotifications] failed to mark notification read:', error);
    response.status(500).json({ error: error.message || 'Unable to mark notification read.' });
    return;
  }

  response.status(200).json({
    ok: true,
    updated: data?.length || 0,
  });
}
