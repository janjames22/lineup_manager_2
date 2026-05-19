import { useState } from 'react';

export default function JoinChurchPage({ session, onJoined }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [churchName, setChurchName] = useState('');
  const [error, setError] = useState('');

  async function readApiResponse(res) {
    const text = await res.text();
    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      return { error: text };
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/church/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ invite_code: code, display_name: name }),
      });
      const data = await readApiResponse(res);
      if (!res.ok) { setError(data.error || 'Unable to join church.'); return; }
      onJoined(data.church_id);
    } catch (requestError) {
      setError(requestError.message || 'Unable to join church.');
    }
  }

  async function handleCreateChurch(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/church/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ church_name: churchName, display_name: name }),
      });
      const data = await readApiResponse(res);
      if (!res.ok) { setError(data.error || 'Unable to create church.'); return; }
      onJoined(data.church_id);
    } catch (requestError) {
      setError(requestError.message || 'Unable to create church.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-6 space-y-6">
        <h2 className="text-white text-lg font-bold">Join or create a church</h2>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <form onSubmit={handleJoin} className="space-y-3">
          <input
            className="w-full rounded-lg bg-slate-700 text-white p-2"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg bg-slate-700 text-white p-2"
            placeholder="Invite code (ask your admin)"
            value={code}
            onChange={e => setCode(e.target.value)}
          />
          <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg">
            Join with invite code
          </button>
        </form>
        <div className="text-center text-slate-400 text-sm">— or —</div>
        <form onSubmit={handleCreateChurch} className="space-y-3">
          <input
            className="w-full rounded-lg bg-slate-700 text-white p-2"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg bg-slate-700 text-white p-2"
            placeholder="Church name"
            value={churchName}
            onChange={e => setChurchName(e.target.value)}
            required
          />
          <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-lg">
            Create new church (I'm an admin)
          </button>
        </form>
      </div>
    </div>
  );
}
