import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, token, platform } = req.body;

  if (!userId || !token) {
    return res.status(400).json({ error: 'Missing userId or token' });
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
