import { CheckCircle2, RefreshCw, WifiOff } from 'lucide-react';

function getCopy(status, lastUpdatedAt) {
  if (status === 'offline') return 'Offline mode';
  if (status === 'local') return 'Local storage mode';
  if (status === 'polling') return 'Live refresh fallback active';
  if (status === 'updated') return 'Updated just now';
  if (lastUpdatedAt) return 'Live updates on';
  return 'Connecting live updates';
}

export default function DataRefreshStatus({ className = '', lastUpdatedAt, refreshing, status }) {
  const copy = getCopy(status, lastUpdatedAt);
  const Icon = status === 'offline' ? WifiOff : status === 'updated' ? CheckCircle2 : RefreshCw;
  const iconClass = refreshing || status === 'connecting' || status === 'polling' ? 'animate-spin' : '';

  return (
    <div className={`inline-flex min-h-9 w-full max-w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs font-bold text-slate-300 sm:w-auto sm:justify-start ${className}`}>
      <Icon size={14} className={`${iconClass} shrink-0`} aria-hidden="true" />
      <span className="text-wrap-anywhere min-w-0">{copy}</span>
    </div>
  );
}
