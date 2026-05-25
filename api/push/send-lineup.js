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
import {
  sendNativePush,
  loadNativePushTokens,
  deactivateInvalidNativeTokens,
} from '../_nativePush.js';

export default async function handler(request, response) {
  if (!allowMethods(request, response, ['POST'])) return;
  if (await requireAdminToken(request, response)) return;

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
    const lineupTitle = isInsert ? 'New lineup added' : 'Lineup updated';
    const lineupBody = formatLineupBody(lineup);
    const lineupUrl = url || `/lineups/${lineup.id}`;
    const resolvedNotificationId = notificationId || `lineup-${actionSlug}-${lineup.id}-${safeTimestamp}`;

    // 1. Native FCM push — primary delivery for Android app users
    let nativeResult = { successCount: 0, failureCount: 0 };
    try {
      const fcmTokens = await loadNativePushTokens(supabase, lineup.church_id);
      if (fcmTokens.length) {
        nativeResult = await sendNativePush(fcmTokens, {
          title: lineupTitle,
          body: lineupBody,
          data: {
            url: lineupUrl,
            type: 'lineup',
            notificationType: payloadType,
            notificationId: resolvedNotificationId,
            lineupId: String(lineup.id),
          },
        });
        if (nativeResult.invalidTokens?.length) {
          await deactivateInvalidNativeTokens(supabase, nativeResult.invalidTokens);
        }
      }
    } catch (nativeErr) {
      console.error('[NativePush] lineup native push failed:', nativeErr.message || nativeErr);
    }

    // 2. Web push — fallback for browser users
    const payload = createPushPayload({
      type: 'lineup',
      notificationType: payloadType,
      title: lineupTitle,
      body: lineupBody,
      url: lineupUrl,
      lineupId: lineup.id,
      tag: `lineup-${lineup.id}`,
      notificationId: resolvedNotificationId,
      timestamp: createdAt,
      createdAt,
    });
    const webResult = await sendPushPayload(supabase, payload, { excludeEndpoint, churchId: lineup.church_id });

    response.status(200).json({
      ...webResult,
      nativeSuccessCount: nativeResult.successCount,
      nativeFailureCount: nativeResult.failureCount,
      lineupId: lineup.id,
      eventType: normalizedEventType,
      notificationType: payloadType,
    });
  } catch (error) {
    console.error('[PushNotifications] failed to send lineup push:', error.cause || error);
    response.status(error.statusCode || 500).json({ error: error.message || 'Unable to send lineup push notification.' });
  }
}
