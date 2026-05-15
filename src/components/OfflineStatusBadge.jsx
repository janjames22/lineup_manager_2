import { AlertTriangle, CheckCircle2, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useSyncStatus } from '../hooks/useSyncStatus';

export default function OfflineStatusBadge() {
  const { status } = useSyncStatus();

  if (status === 'online') return null;

  const config = {
    offline: {
      icon: WifiOff,
      label: 'Offline mode',
      classes: 'bg-amber-100 text-amber-800',
    },
    back_online: {
      icon: Wifi,
      label: 'Back online',
      classes: 'bg-sky-100 text-sky-800',
    },
    syncing: {
      icon: Loader2,
      label: 'Syncing...',
      classes: 'bg-blue-100 text-blue-800',
      iconClasses: 'animate-spin',
    },
    synced: {
      icon: CheckCircle2,
      label: 'Synced',
      classes: 'bg-emerald-100 text-emerald-800',
    },
    sync_error: {
      icon: AlertTriangle,
      label: 'Sync error',
      classes: 'bg-red-100 text-red-800',
    },
  }[status];

  if (!config) return null;
  const Icon = config.icon;

  return (
    <div className={`flex max-w-full min-w-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm print:hidden ${config.classes}`} title="Downloaded songs and lineups can be opened even without internet.">
      <Icon size={14} className={`${config.iconClasses || ''} shrink-0`} />
      <span className="text-wrap-anywhere min-w-0">{config.label}</span>
    </div>
  );
}
