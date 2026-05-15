import { Check, Download, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useToast } from '../hooks/useToast';

const COPY = {
  song: {
    saved: 'Song saved for offline use.',
    removed: 'Offline copy removed.',
    saveError: 'Unable to save this song offline.',
    removeError: 'Unable to remove this offline copy.',
    saveLabel: 'Save Offline',
  },
  lineup: {
    saved: 'Lineup saved for offline use.',
    removed: 'Offline copy removed.',
    saveError: 'Unable to save this lineup offline.',
    removeError: 'Unable to remove this offline copy.',
    saveLabel: 'Save Offline',
  },
};

export default function OfflineItemButton({
  className = '',
  getSavePayload,
  item,
  offline,
  type,
}) {
  const { showToast } = useToast();
  const copy = COPY[type] || COPY.song;
  const saved = offline.isSaved(item.id);
  const busy = offline.isBusy(item.id);
  const outdated = saved && offline.isOutdated(item);

  const saveOffline = async () => {
    try {
      const payload = getSavePayload ? await getSavePayload(item) : item;
      await offline.save(payload);
      showToast(copy.saved, 'success');
    } catch (error) {
      console.error(`[OfflineStorage] Failed to save ${type} offline:`, error);
      showToast(copy.saveError, 'error');
    }
  };

  const removeOffline = async () => {
    try {
      await offline.remove(item.id);
      showToast(copy.removed, 'info');
    } catch (error) {
      console.error(`[OfflineStorage] Failed to remove ${type} offline:`, error);
      showToast(copy.removeError, 'error');
    }
  };

  return (
    <div className={`flex min-w-0 max-w-full flex-wrap items-center gap-2 ${className}`}>
      {saved && (
        <span className="inline-flex min-h-9 max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-black text-emerald-300">
          <Check size={14} aria-hidden="true" /> Saved offline
        </span>
      )}
      {outdated && (
        <span className="inline-flex min-h-9 max-w-full min-w-0 items-center break-words rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-black text-amber-200">
          Offline copy may be outdated
        </span>
      )}
      {outdated && (
        <button
          className="btn-secondary flex-1 !min-h-9 !px-3 !py-1.5 !text-xs sm:flex-none"
          type="button"
          disabled={busy}
          onClick={saveOffline}
        >
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
          Update Download
        </button>
      )}
      <button
        className={`${saved ? 'btn-secondary' : 'btn-primary'} flex-1 !min-h-9 !px-3 !py-1.5 !text-xs sm:flex-none`}
        type="button"
        disabled={busy}
        onClick={saved ? removeOffline : saveOffline}
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : saved ? (
          <Trash2 size={14} aria-hidden="true" />
        ) : (
          <Download size={14} aria-hidden="true" />
        )}
        {busy ? 'Working...' : saved ? 'Remove Offline' : copy.saveLabel}
      </button>
    </div>
  );
}
