import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, token, platform } = req.body;
  console.log('[subscribe-native] req.body:', JSON.stringify({ userId, token: token ? `${token.slice(0, 8)}…` : token, platform }));

  if (!userId || !token) {
    return res.status(400).json({ error: 'Missing userId or token' });
  }

  if (!UUID_RE.test(userId)) {
    console.error('[subscribe-native] Invalid userId (not a UUID):', userId);
    return res.status(400).json({ error: `userId must be a valid UUID, received: ${userId}` });
  }

  try {
    const { error } = await supabase
      .from('native_push_tokens')
      .upsert(
        {
          user_id: userId,
          fcm_token: token,
          platform: platform || 'android',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'fcm_token' }
      );

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[subscribe-native] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
