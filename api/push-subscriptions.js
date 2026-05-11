/* global process */
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    response.status(500).json({ error: 'Push subscription storage is not configured.' });
    return;
  }

  const { endpoint, p256dh, auth, userAgent, user_agent: userAgentSnake } = request.body || {};
  if (!endpoint || !p256dh || !auth) {
    response.status(400).json({ error: 'Missing push subscription fields.' });
    return;
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        endpoint,
        p256dh,
        auth,
        user_agent: userAgentSnake || userAgent || request.headers['user-agent'] || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

  if (error) {
    console.error('[LineupNotifications] failed to save push subscription:', error);
    response.status(500).json({ error: 'Unable to save push subscription.' });
    return;
  }

  response.status(200).json({ ok: true });
}
