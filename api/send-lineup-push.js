/* global process */
import { createClient } from '@supabase/supabase-js';
import webPush from 'web-push';

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

function formatLineupBody(lineup = {}) {
  const schedule = [lineup.date, lineup.service_time].filter(Boolean).join(' · ');
  return schedule || 'New lineup added';
}

function createPayload({ title, body, url, tag, lineupId }) {
  return JSON.stringify({
    title: title || 'Line Up Manager',
    body: body || 'New notification',
    url: url || '/lineups',
    tag: tag || (lineupId ? `lineup-${lineupId}` : 'lineup-manager'),
    lineupId: lineupId || null,
  });
}

function getVapidConfig() {
  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

async function removeExpiredSubscriptions(supabase, endpoints) {
  if (!endpoints.length) return;

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .in('endpoint', endpoints);

  if (error) {
    console.error('[LineupNotifications] failed to remove expired push subscriptions:', error);
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const supabase = getSupabaseAdmin();
  const vapid = getVapidConfig();

  if (!supabase || !vapid) {
    response.status(500).json({ error: 'Web Push is not configured.' });
    return;
  }

  const { lineupId, url, excludeEndpoint, test, title, body, tag } = request.body || {};
  if (!lineupId && !test) {
    response.status(400).json({ error: 'Missing lineupId.' });
    return;
  }

  let payload;
  if (test) {
    payload = createPayload({
      title: title || 'Line Up Manager',
      body: body || 'Test phone notification',
      url: url || '/lineups',
      tag: tag || 'lineup-manager-test',
    });
  } else {
    const { data: lineup, error: lineupError } = await supabase
      .from('lineups')
      .select('*')
      .eq('id', lineupId)
      .single();

    if (lineupError || !lineup) {
      console.error('[LineupNotifications] failed to load lineup for push:', lineupError);
      response.status(404).json({ error: 'Lineup not found.' });
      return;
    }

    payload = createPayload({
      title: 'New lineup added',
      body: formatLineupBody(lineup),
      url: url || `/lineups/${lineup.id}`,
      lineupId: lineup.id,
    });
  }

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth');

  if (subscriptionError) {
    console.error('[LineupNotifications] failed to load push subscriptions:', subscriptionError);
    response.status(500).json({ error: 'Unable to load push subscriptions.' });
    return;
  }

  webPush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const expiredEndpoints = [];
  const targets = (subscriptions || []).filter((subscription) => subscription.endpoint !== excludeEndpoint);

  const results = await Promise.allSettled(
    targets.map((subscription) => webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      payload
    ))
  );

  results.forEach((result, index) => {
    if (result.status !== 'rejected') return;

    const statusCode = result.reason?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      expiredEndpoints.push(targets[index].endpoint);
      return;
    }

    console.error('[LineupNotifications] push send failed:', result.reason);
  });

  await removeExpiredSubscriptions(supabase, expiredEndpoints);

  response.status(200).json({
    ok: true,
    sent: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length,
    expired: expiredEndpoints.length,
  });
}
