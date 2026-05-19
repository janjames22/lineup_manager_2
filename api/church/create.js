import { getSupabaseAdmin } from '../_push.js';

function getBearerToken(req) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) return '';
  return authorization.slice('Bearer '.length).trim();
}

function createSlug(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { church_name, display_name } = req.body || {};
  const churchName = String(church_name || '').trim();
  const displayName = String(display_name || '').trim();
  if (!churchName) return res.status(400).json({ error: 'church_name required' });
  if (!displayName) return res.status(400).json({ error: 'display_name required' });

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Church creation is not configured.' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const slug = createSlug(churchName);
  if (!slug) return res.status(400).json({ error: 'Church name must include letters or numbers.' });

  const { data: church, error: churchErr } = await supabase
    .from('churches')
    .insert({ name: churchName, slug, created_by: user.id })
    .select()
    .single();
  if (churchErr) {
    const status = churchErr.code === '23505' ? 409 : 500;
    return res.status(status).json({ error: churchErr.message || 'Unable to create church.' });
  }

  const { error: memberErr } = await supabase
    .from('church_members')
    .insert({ church_id: church.id, user_id: user.id, role: 'admin', display_name: displayName });
  if (memberErr) {
    await supabase.from('churches').delete().eq('id', church.id);
    return res.status(500).json({ error: memberErr.message || 'Unable to add church admin.' });
  }

  res.status(200).json({ church_id: church.id });
}
