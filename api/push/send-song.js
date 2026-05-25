import {
  allowMethods,
  createPushPayload,
  getRequestBody,
  getSupabaseAdmin,
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

  const { songId, songTitle, eventType = 'CREATE', url, excludeEndpoint, churchId = null } = getRequestBody(request);
  if (!songTitle) {
    response.status(400).json({ error: 'Missing songTitle.' });
    return;
  }

  const normalizedEventType = String(eventType).toUpperCase();
  const isCreate = normalizedEventType === 'CREATE' || normalizedEventType === 'INSERT';
  const isDelete = normalizedEventType === 'DELETE';

  let notificationType;
  let title;
  if (isCreate) {
    notificationType = 'song_created';
    title = `New song added: ${songTitle}`;
  } else if (isDelete) {
    notificationType = 'song_deleted';
    title = `Song removed: ${songTitle}`;
  } else {
    notificationType = 'song_updated';
    title = `Song updated: ${songTitle}`;
  }

  const songUrl = url || (songId ? `/songs/${songId}` : '/songs');
  const now = new Date().toISOString();
  const safeTimestamp = now.replace(/[^a-z0-9]/gi, '');
  const notificationId = `${notificationType}-${songId || 'unknown'}-${safeTimestamp}`;

  try {
    // Write server-side record (lineup_id is intentionally null for song events)
    await supabase.from('lineup_notifications').insert({
      type: notificationType,
      lineup_id: null,
      title,
      body: songTitle,
      url: songUrl,
      is_read: false,
    });

    // 1. Native FCM push — primary delivery for Android app users
    let nativeResult = { successCount: 0, failureCount: 0 };
    try {
      const fcmTokens = await loadNativePushTokens(supabase, churchId);
      if (fcmTokens.length) {
        nativeResult = await sendNativePush(fcmTokens, {
          title,
          body: songTitle,
          data: {
            url: songUrl,
            type: 'song',
            notificationType,
            notificationId,
            songId: songId ? String(songId) : '',
          },
        });
        if (nativeResult.invalidTokens?.length) {
          await deactivateInvalidNativeTokens(supabase, nativeResult.invalidTokens);
        }
      }
    } catch (nativeErr) {
      console.error('[NativePush] song native push failed:', nativeErr.message || nativeErr);
    }

    // 2. Web push — fallback for browser users
    const payload = createPushPayload({
      type: 'song',
      notificationType,
      title,
      body: songTitle,
      url: songUrl,
      tag: songId ? `song-${songId}` : 'song-update',
      songId: songId || null,
      notificationId,
      timestamp: now,
      createdAt: now,
    });
    const webResult = await sendPushPayload(supabase, payload, { excludeEndpoint: excludeEndpoint || '', churchId });

    response.status(200).json({
      ...webResult,
      nativeSuccessCount: nativeResult.successCount,
      nativeFailureCount: nativeResult.failureCount,
      notificationType,
      title,
    });
  } catch (error) {
    console.error('[PushNotifications] failed to send song push:', error.cause || error);
    response.status(error.statusCode || 500).json({ error: error.message || 'Unable to send song push notification.' });
  }
}
