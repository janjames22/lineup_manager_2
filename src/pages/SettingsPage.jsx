import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, Check, Copy, Loader2, Users } from 'lucide-react';
import { supabase } from '../utils/supabase';

export default function SettingsPage({ session, churchId, onAccountDeleted }) {
  const [church, setChurch] = useState(null);
  const [members, setMembers] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (!supabase || !churchId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const [churchResult, membersResult] = await Promise.all([
          supabase
            .from('churches')
            .select('id, name, invite_code')
            .eq('id', churchId)
            .maybeSingle(),
          supabase
            .from('church_members')
            .select('id, user_id, display_name, role, joined_at')
            .eq('church_id', churchId)
            .order('joined_at', { ascending: true }),
        ]);

        if (churchResult.error) throw churchResult.error;
        if (membersResult.error) throw membersResult.error;

        setChurch(churchResult.data);
        const memberList = membersResult.data ?? [];
        setMembers(memberList);
        const me = memberList.find((m) => m.user_id === session.user.id);
        setMyRole(me?.role ?? 'member');
      } catch (err) {
        setError(err.message || 'Failed to load settings.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [churchId, session.user.id]);

  async function handleDeleteAccount() {
    if (!supabase) return;
    setDeleteLoading(true);
    setDeleteError('');

    try {
      // supabase.functions.invoke automatically attaches the current session JWT
      // as the Authorization header — no manual token extraction needed.
      // Works in both the browser and the Capacitor Android webview.
      const { error } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
      });

      if (error) {
        // FunctionsHttpError carries a Response in error.context; extract the
        // JSON body to surface the server's human-readable message.
        let message = 'Failed to delete account. Please try again.';
        try {
          const body = await error.context?.json?.();
          message = body?.message || body?.error || message;
        } catch {
          // context.json() unavailable (network/relay error) — use fallback message
        }
        setDeleteError(message);
        setDeleteLoading(false);
        return;
      }

      // Mark the session as deleted so AuthPage can show the confirmation banner.
      sessionStorage.setItem('account-deleted', '1');
      onAccountDeleted?.();
    } catch {
      setDeleteError('Network error. Please check your connection and try again.');
      setDeleteLoading(false);
    }
  }

  async function copyInviteCode() {
    if (!church?.invite_code) return;
    try {
      await navigator.clipboard.writeText(church.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable (e.g. non-HTTPS context)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Church settings and member management</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800/50 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-800/60 bg-slate-800/30 p-5">
        <div className="flex items-center gap-3">
          <Building2 size={20} className="shrink-0 text-slate-400" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Church</p>
            <p className="text-lg font-extrabold text-white">{church?.name ?? '—'}</p>
          </div>
        </div>

        {myRole === 'admin' && church?.invite_code && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Invite Code</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2.5 font-mono text-lg font-bold tracking-widest text-amber-400">
                {church.invite_code}
              </code>
              <button
                type="button"
                onClick={copyInviteCode}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-300 transition-all hover:border-slate-600 hover:text-white active:scale-95"
                aria-label="Copy invite code"
              >
                {copied
                  ? <Check size={16} className="text-green-400" aria-hidden="true" />
                  : <Copy size={16} aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Share this code with people you want to add to your church.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-slate-400" aria-hidden="true" />
          <h2 className="text-base font-extrabold text-white">Members</h2>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-400">
            {members.length}
          </span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-800/30 divide-y divide-slate-800/60">
          {members.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-500">No members yet.</p>
          ) : (
            members.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <p className="min-w-0 truncate font-bold text-white">
                  {member.display_name || <span className="italic text-slate-500">Unnamed</span>}
                  {member.user_id === session.user.id && (
                    <span className="ml-1.5 text-xs font-bold text-slate-500">(you)</span>
                  )}
                </p>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider ${
                  member.role === 'admin'
                    ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30'
                    : 'bg-slate-700/50 text-slate-400'
                }`}>
                  {member.role}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-500" aria-hidden="true" />
          <h2 className="text-base font-extrabold text-red-400">Danger Zone</h2>
        </div>
        <div className="rounded-2xl border border-red-900/50 bg-red-950/10 p-5 space-y-3">
          <p className="text-sm text-slate-400">
            Permanently delete your account and all associated personal data.
            This cannot be undone.
          </p>
          <button
            type="button"
            className="btn-danger w-full sm:w-auto"
            onClick={() => { setShowDeleteDialog(true); setDeleteError(''); }}
          >
            Delete My Account
          </button>
        </div>
      </section>

      <p className="text-center text-xs text-slate-500 pb-2">
        <Link to="/privacy" className="hover:text-slate-400 underline underline-offset-2">
          Privacy Policy
        </Link>
      </p>

      {showDeleteDialog && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !deleteLoading) setShowDeleteDialog(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-red-900/60 bg-slate-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="shrink-0 text-red-400 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="text-lg font-extrabold text-white">Delete Account</h3>
                <p className="text-sm text-slate-400 mt-1">This action is permanent and cannot be undone.</p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-4 py-3 text-sm text-slate-300 space-y-1">
              <p className="font-bold text-slate-200 mb-2">The following will be deleted:</p>
              <ul className="space-y-1 list-disc list-inside text-slate-400">
                <li>Your account (email &amp; password)</li>
                <li>Your display name</li>
                <li>Your church membership and role</li>
                <li>Your schedule and lineup data</li>
                <li>Your push notification tokens</li>
              </ul>
            </div>

            {deleteError && (
              <p className="rounded-xl bg-red-950/40 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                {deleteError}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger flex-1"
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
              >
                {deleteLoading
                  ? <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={16} /> Deleting…</span>
                  : 'Delete my account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
