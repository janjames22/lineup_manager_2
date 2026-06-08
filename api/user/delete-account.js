/* global process */
import { getSupabaseAdmin } from '../_push.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Identity comes exclusively from the verified JWT — never from the request body.
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Server configuration error' });

  // Verify the token server-side so only the authenticated user can delete their own account.
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  const userId = user.id;

  // Admin guard: find any churches where this user is an admin.
  const { data: adminRows, error: adminCheckError } = await supabase
    .from('church_members')
    .select('church_id')
    .eq('user_id', userId)
    .eq('role', 'admin');

  if (adminCheckError) {
    console.error('[delete-account] admin check failed:', adminCheckError.message);
    return res.status(500).json({ error: 'Failed to verify account status' });
  }

  // For each church this user admins, check whether they are the SOLE admin
  // and the church still has other members. If so, block — silently removing
  // the last admin orphans the church and locks out all its members.
  for (const { church_id } of (adminRows || [])) {
    const { data: otherMembers, error: membersError } = await supabase
      .from('church_members')
      .select('id, role')
      .eq('church_id', church_id)
      .neq('user_id', userId);

    if (membersError) {
      return res.status(500).json({ error: 'Failed to verify church membership' });
    }

    if (otherMembers && otherMembers.length > 0) {
      const otherAdmins = otherMembers.filter((m) => m.role === 'admin');
      if (otherAdmins.length === 0) {
        return res.status(409).json({
          error: 'sole_admin',
          message:
            'You are the only admin of a church that has other members. ' +
            'Assign another member as admin before deleting your account.',
        });
      }
    }
  }

  // Delete user rows in FK-safe order before removing the auth record.
  // Songs and lineups are church-scoped and are intentionally NOT deleted —
  // they belong to the church, not the individual user.

  const { error: notifError } = await supabase
    .from('lineup_notifications')
    .delete()
    .eq('user_id', userId);

  if (notifError) {
    console.error('[delete-account] lineup_notifications delete failed:', notifError.message);
    return res.status(500).json({ error: 'Failed to delete notification records' });
  }

  const { error: tokenError } = await supabase
    .from('native_push_tokens')
    .delete()
    .eq('user_id', userId);

  if (tokenError) {
    console.error('[delete-account] native_push_tokens delete failed:', tokenError.message);
    return res.status(500).json({ error: 'Failed to delete push token records' });
  }

  const { error: memberError } = await supabase
    .from('church_members')
    .delete()
    .eq('user_id', userId);

  if (memberError) {
    console.error('[delete-account] church_members delete failed:', memberError.message);
    return res.status(500).json({ error: 'Failed to delete church membership' });
  }

  // Remove the auth account last. FK cascades (ON DELETE CASCADE) clean up
  // any remaining references in auth-referencing tables.
  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.error('[delete-account] deleteUser failed:', deleteError.message);
    return res.status(500).json({ error: 'Failed to delete account. Please try again or contact support.' });
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[delete-account] account deleted:', userId);
  }

  return res.status(200).json({ success: true });
}
