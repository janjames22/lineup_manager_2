// Supabase Edge Function: delete-account
// Deno runtime — SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// are auto-injected by Supabase when deployed; no manual secrets needed.
//
// Security model:
//   - Identity is derived exclusively from the verified JWT in the
//     Authorization header. The user_id is NEVER read from the request body.
//   - A service-role client performs all writes; the service-role key
//     never leaves this function and is never shipped in the client bundle.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Tables with user-linked data found in this repo's schema/migrations:
//
//   lineup_notifications  user_id UUID  (nullable, NO FK cascade — must delete manually)
//   native_push_tokens    user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE
//   church_members        user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE
//   churches              created_by   REFERENCES auth.users ON DELETE SET NULL (auto)
//   songs / lineups       church_id only — not user-scoped, intentionally NOT deleted
//   push_subscriptions    no user_id column — device-scoped, not deleted

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Not authenticated' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Verify the caller using their JWT. The anon client forwards the
  // Authorization header so getUser() validates the token server-side.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return json({ error: 'Invalid or expired token' }, 401)
  }

  const userId = user.id

  // Service-role client for privileged deletes — bypasses RLS safely.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ── Admin guard ──────────────────────────────────────────────────────────
  // Block deletion if the user is the SOLE admin of a church that still has
  // other members. Silently removing the last admin would lock out the entire
  // church. We block (not reassign) because auto-reassigning to an arbitrary
  // member is unsafe and confusing.
  const { data: adminChurches, error: adminCheckErr } = await admin
    .from('church_members')
    .select('church_id')
    .eq('user_id', userId)
    .eq('role', 'admin')

  if (adminCheckErr) {
    console.error('admin check failed:', adminCheckErr.message)
    return json({ error: 'Failed to verify account status' }, 500)
  }

  for (const { church_id } of (adminChurches ?? [])) {
    const { data: others, error: othersErr } = await admin
      .from('church_members')
      .select('id, role')
      .eq('church_id', church_id)
      .neq('user_id', userId)

    if (othersErr) {
      return json({ error: 'Failed to verify church membership' }, 500)
    }

    if (others && others.length > 0) {
      const hasOtherAdmin = others.some((m: { role: string }) => m.role === 'admin')
      if (!hasOtherAdmin) {
        return json({
          error: 'sole_admin',
          message:
            'You are the only admin of a church that has other members. ' +
            'Assign another admin before deleting your account.',
        }, 409)
      }
    }
  }

  // ── Delete user data in FK-safe order ────────────────────────────────────

  // 1. lineup_notifications — no FK cascade, must delete explicitly
  const { error: notifErr } = await admin
    .from('lineup_notifications')
    .delete()
    .eq('user_id', userId)

  if (notifErr) {
    console.error('lineup_notifications delete failed:', notifErr.message)
    return json({ error: 'Failed to delete notification records' }, 500)
  }

  // 2. native_push_tokens — has ON DELETE CASCADE but explicit for safety
  const { error: tokenErr } = await admin
    .from('native_push_tokens')
    .delete()
    .eq('user_id', userId)

  if (tokenErr) {
    console.error('native_push_tokens delete failed:', tokenErr.message)
    return json({ error: 'Failed to delete push token records' }, 500)
  }

  // 3. church_members — has ON DELETE CASCADE but explicit gives us error handling
  const { error: memberErr } = await admin
    .from('church_members')
    .delete()
    .eq('user_id', userId)

  if (memberErr) {
    console.error('church_members delete failed:', memberErr.message)
    return json({ error: 'Failed to delete church membership' }, 500)
  }

  // 4. Delete the auth account last. This cascades churches.created_by → SET NULL
  //    and any remaining auth.users FK refs.
  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId)

  if (deleteErr) {
    console.error('auth.admin.deleteUser failed:', deleteErr.message)
    return json({ error: 'Failed to delete account. Please try again or contact support.' }, 500)
  }

  return json({ success: true })
})
