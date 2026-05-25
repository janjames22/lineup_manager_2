import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function sendNativePush(tokens, payload) {
  if (!tokens || tokens.length === 0) return { successCount: 0, failureCount: 0 };

  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'lineup_updates_v2',
        sound: 'default',
        defaultSound: true,
        vibrateTimingsMillis: [0, 250, 250, 250],
        defaultVibrateTimings: false,
      },
    },
    data: payload.data || {},
    tokens,
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  const invalidTokens = [];
  response.responses.forEach((resp, idx) => {
    if (!resp.success) {
      const code = resp.error?.code;
      if (
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered'
      ) {
        invalidTokens.push(tokens[idx]);
      }
    }
  });

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokens,
  };
}

export async function loadNativePushTokens(supabase, churchId = null) {
  let query = supabase
    .from('native_push_tokens')
    .select('*')
    .eq('is_active', true);
  if (churchId) query = query.eq('church_id', churchId);
  const { data, error } = await query;
  if (error) {
    console.error('[NativePush] failed to load tokens:', error.message);
    return [];
  }
  return (data || []).map((r) => r.fcm_token).filter(Boolean);
}

export async function deactivateInvalidNativeTokens(supabase, tokens) {
  if (!tokens?.length) return;
  await supabase
    .from('native_push_tokens')
    .update({ is_active: false })
    .in('fcm_token', tokens);
}
