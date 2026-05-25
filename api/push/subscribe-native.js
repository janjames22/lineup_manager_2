import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bearerToken = req.headers.authorization?.replace('Bearer ', '') || null;
  if (!bearerToken) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(bearerToken);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const { token, platform } = req.body;
  if (process.env.NODE_ENV !== 'production') {
    console.log('[subscribe-native] user:', user.id, 'token:', token ? `${token.slice(0, 8)}…` : token);
  }

  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  try {
    const { error } = await supabase
      .from('native_push_tokens')
      .upsert(
        {
          user_id: user.id,
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
