import { CloudDownload, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useOffline } from '../hooks/useOffline';
import { useToast } from '../hooks/useToast';

export default function DownloadOfflineButton({ onDownload, label = 'Download Offline' }) {
  const isOffline = useOffline();
  const { showToast } = useToast();
  const [status, setStatus] = useState('idle'); // idle, downloading, success, error

  const handleDownload = async () => {
    if (isOffline) return;
    setStatus('downloading');
    try {
      await onDownload();
      setStatus('success');
      showToast('Successfully synced for offline use!', 'success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error('Download failed:', err);
      setStatus('error');
      showToast('Failed to sync. Please check your connection.', 'error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  if (isOffline) return null;

  return (
    <button
      onClick={handleDownload}
      disabled={status === 'downloading'}
      title="Downloaded songs and lineups can be opened even without internet."
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-all duration-300 active:scale-95 ${
        status === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]' :
        status === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
        'bg-slate-800/50 text-slate-300 border border-slate-700 hover:bg-slate-800 hover:text-white hover:border-slate-500'
      }`}
    >
      {status === 'success' ? (
        <Check size={18} strokeWidth={3} className="animate-in zoom-in duration-300" />
      ) : status === 'downloading' ? (
        <Loader2 size={18} strokeWidth={3} className="animate-spin" />
      ) : status === 'error' ? (
        <AlertTriangle size={18} strokeWidth={3} />
      ) : (
        <CloudDownload size={18} strokeWidth={2.5} />
      )}
      <span>
        {status === 'downloading' ? 'Syncing...' : status === 'success' ? 'Ready Offline' : status === 'error' ? 'Retry Sync' : label}
      </span>
    </button>
  );
}
