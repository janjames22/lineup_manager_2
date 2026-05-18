import {
  allowMethods,
  createPushPayload,
  formatLineupBody,
  getRequestBody,
  getSupabaseAdmin,
  loadLineup,
  requireAdminToken,
  sendPushPayload,
} from '../_push.js';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;
  if (requireAdminToken(request, response)) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    response.status(500).json({ error: 'Push subscription storage is not configured.' });
    return;
  }

  const {
    lineupId,
    url,
    excludeEndpoint,
    eventType = 'UPDATE',
    notificationType,
    notificationId,
    updatedAt,
  } = getRequestBody(request);
  if (!lineupId) {
    response.status(400).json({ error: 'Missing lineupId.' });
    return;
  }

  try {
    const lineup = await loadLineup(supabase, lineupId);
    const normalizedEventType = String(notificationType || eventType || 'UPDATE').toUpperCase();
    const isInsert = normalizedEventType === 'INSERT' || normalizedEventType === 'CREATE' || normalizedEventType === 'CREATED';
    const createdAt = lineup.updated_at || updatedAt || lineup.created_at || new Date().toISOString();
    const payloadType = isInsert ? 'lineup_created' : 'lineup_updated';
    const actionSlug = isInsert ? 'created' : 'updated';
    const safeTimestamp = String(createdAt).replace(/[^a-z0-9]/gi, '');
    const payload = createPushPayload({
      type: 'lineup',
      notificationType: payloadType,
      title: isInsert ? 'New lineup added' : 'Lineup updated',
      body: formatLineupBody(lineup),
      url: url || `/lineups/${lineup.id}`,
      lineupId: lineup.id,
      tag: `lineup-${lineup.id}`,
      notificationId: notificationId || `lineup-${actionSlug}-${lineup.id}-${safeTimestamp}`,
      timestamp: createdAt,
      createdAt,
    });
    const result = await sendPushPayload(supabase, payload, { excludeEndpoint });
    response.status(200).json({
      ...result,
      lineupId: lineup.id,
      eventType: normalizedEventType,
      notificationType: payloadType,
    });
  } catch (error) {
    console.error('[PushNotifications] failed to send lineup push:', error.cause || error);
    response.status(error.statusCode || 500).json({ error: error.message || 'Unable to send lineup push notification.' });
  }
}
