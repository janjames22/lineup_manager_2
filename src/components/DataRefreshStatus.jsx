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
    <div className={`inline-flex min-h-9 max-w-full min-w-0 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs font-bold text-slate-300 ${className}`}>
      <Icon size={14} className={iconClass} aria-hidden="true" />
      <span className="min-w-0 break-words">{copy}</span>
    </div>
  );
}
