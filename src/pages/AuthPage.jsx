import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) setError(error.message);
        else setMessage('Check your email for a confirmation link.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-6 space-y-5">
        <div className="text-center">
          <h1 className="text-white text-xl font-black tracking-tight">Line Up Manager</h1>
          <p className="text-slate-400 text-sm mt-1">
            {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
          </p>
        </div>

        {error && (
          <p className="rounded-xl bg-red-950/40 border border-red-500/30 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-xl bg-blue-950/40 border border-blue-500/30 px-4 py-3 text-sm text-blue-300">
            {message}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Email
            </label>
            <input
              type="email"
              className="input w-full"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Password
            </label>
            <input
              type="password"
              className="input w-full"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
            />
          </div>
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading}
          >
            {loading
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={16} /> Please wait...</span>
              : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="text-blue-400 font-bold hover:text-blue-300"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>

        <p className="text-center text-xs text-slate-500">
          <Link to="/privacy" className="hover:text-slate-400 underline underline-offset-2">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
