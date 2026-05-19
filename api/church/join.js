import { getSupabaseAdmin } from '../_push.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { invite_code, display_name } = req.body || {};
  if (!invite_code) return res.status(400).json({ error: 'invite_code required' });

  // Validate the caller is authenticated
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const supabase = getSupabaseAdmin();

  // Verify token and get user
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  // Find church by invite code
  const { data: church } = await supabase
    .from('churches')
    .select('id')
    .eq('invite_code', invite_code.trim().toLowerCase())
    .single();
  if (!church) return res.status(404).json({ error: 'Invalid invite code' });

  // Add member (ignore duplicate)
  await supabase.from('church_members').upsert(
    { church_id: church.id, user_id: user.id, role: 'member', display_name },
    { onConflict: 'church_id,user_id', ignoreDuplicates: true }
  );

  res.status(200).json({ church_id: church.id });
}
