import { BellRing, X } from 'lucide-react';

export default function LineupNotificationBanner({ notification, onOpen, onDismiss }) {
  if (!notification) return null;

  return (
    <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-[70] mx-auto max-w-md print:hidden">
      <div className="rounded-xl border border-blue-400/30 bg-slate-950/95 p-3 shadow-2xl shadow-blue-950/30 backdrop-blur">
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-3 text-left"
            onClick={onOpen}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-500/15 text-blue-200">
              <BellRing size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black text-white">{notification.title || 'Line Up Updated'}</span>
              <span className="mt-0.5 block break-words text-xs font-semibold leading-relaxed text-slate-300">
                {notification.message || 'Tap to open lineup'}
              </span>
            </span>
          </button>
          <button
            type="button"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            onClick={onDismiss}
            aria-label="Dismiss notification"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
