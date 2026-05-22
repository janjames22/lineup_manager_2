import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const isSupabaseConfigured = () => !!supabase;

// BUG-012: provide an explicit throwing helper so accidental direct use of the
// null export produces a clear error rather than an unhelpful "Cannot read
// properties of null" crash.
export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.'
    );
  }
  return supabase;
}

// Read Supabase's raw stored session from localStorage without a network call.
// Key format: sb-{projectRef}-auth-token (derived by supabase-js from the URL).
// Useful when getSession() returns null because the access token expired offline.
// The stored session still has valid user data (id, email) even when the token is stale.
export function getStoredSession() {
  try {
    const projectRef = supabaseUrl?.match(/https?:\/\/([^.]+)\./)?.[1];
    if (!projectRef) return null;
    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user?.id ? parsed : null;
  } catch {
    return null;
  }
}