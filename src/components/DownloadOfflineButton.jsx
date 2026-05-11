import { AlertTriangle, Check, CloudDownload, Loader2, Wifi } from 'lucide-react';
import { useOffline } from '../hooks/useOffline';
import { requestSync, useSyncStatus } from '../hooks/useSyncStatus';
import { useToast } from '../hooks/useToast';

export default function DownloadOfflineButton({ onDownload, label = 'Download Offline', syncKey }) {
  const isOffline = useOffline();
  const syncStatus = useSyncStatus();
  const { showToast } = useToast();
  const isActiveSync = syncStatus.syncKey === syncKey;

  const handleDownload = async () => {
    if (isOffline) return;
    requestSync(syncKey, async () => {
      try {
        await onDownload();
        showToast('Successfully synced for offline use!', 'success');
      } catch (err) {
        console.error('Download failed:', err);
        showToast(
          typeof navigator !== 'undefined' && !navigator.onLine
            ? 'Offline mode. Sync will resume when internet returns.'
            : 'Failed to sync. Please check your connection.',
          'error'
        );
        throw err;
      }
    });
  };

  if (isOffline) return null;

  const buttonStatus = isActiveSync ? syncStatus.status : 'idle';
  const buttonClasses = {
    synced: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]',
    syncing: 'bg-blue-500/20 text-blue-300 border border-blue-500/50',
    back_online: 'bg-sky-500/20 text-sky-300 border border-sky-500/50',
    sync_error: 'bg-red-500/20 text-red-400 border border-red-500/50',
    idle: 'bg-slate-800/50 text-slate-300 border border-slate-700 hover:bg-slate-800 hover:text-white hover:border-slate-500',
  };

  const buttonCopy = {
    syncing: 'Syncing...',
    synced: 'Synced',
    back_online: 'Back online',
    sync_error: 'Retry Sync',
    idle: label,
  };

  const icon = {
    synced: <Check size={18} strokeWidth={3} className="animate-in zoom-in duration-300" />,
    syncing: <Loader2 size={18} strokeWidth={3} className="animate-spin" />,
    back_online: <Wifi size={18} strokeWidth={3} />,
    sync_error: <AlertTriangle size={18} strokeWidth={3} />,
    idle: <CloudDownload size={18} strokeWidth={2.5} />,
  };

  return (
    <button
      onClick={handleDownload}
      disabled={buttonStatus === 'syncing'}
      title="Downloaded songs and lineups can be opened even without internet."
      className={`inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-center text-sm font-black transition-all duration-300 active:scale-95 ${buttonClasses[buttonStatus] || buttonClasses.idle}`}
    >
      {icon[buttonStatus] || icon.idle}
      <span>{buttonCopy[buttonStatus] || label}</span>
    </button>
  );
}
