import { Bell, CalendarDays, CheckCheck, Music, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function timeAgo(dateString) {
  if (!dateString) return '';
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell({
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkNotificationRead,
  onClearNotification,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const mobilePanelRef = useRef(null);
  const navigate = useNavigate();

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [notifications]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (e) => {
      if (containerRef.current?.contains(e.target) || mobilePanelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    if (!window.matchMedia?.('(max-width: 1023px)').matches) return undefined;

    const prev = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';
    return () => {
      document.body.style.overflow = prev;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, [open]);

  const handleNotificationClick = (notification) => {
    const target = notification.url
      || (notification.lineupId ? `/lineups/${notification.lineupId}` : null)
      || (notification.songId ? `/songs/${notification.songId}` : null);
    if (!target) return;
    onMarkNotificationRead?.(notification.id);
    setOpen(false);
    navigate(target);
  };

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-black text-white">Notifications</p>
        {unreadCount > 0 && (
          <p className="text-xs font-semibold text-slate-500">{unreadCount} unread</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {unreadCount > 0 && (
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-black uppercase tracking-wider text-blue-300 transition-colors hover:bg-slate-800 hover:text-blue-200"
            onClick={onMarkAllRead}
            aria-label="Mark all notifications read"
          >
            <CheckCheck size={15} aria-hidden="true" />
            Mark all read
          </button>
        )}
        <button
          type="button"
          className="grid size-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          onClick={() => setOpen(false)}
          aria-label="Close notifications"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  const list = (
    <div>
      {sortedNotifications.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <Bell size={24} className="mx-auto mb-2 text-slate-700" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-500">No notifications yet.</p>
        </div>
      ) : sortedNotifications.map((n) => (
        <div
          key={n.id}
          className={`border-b last:border-b-0 ${n.read ? 'border-slate-800/70' : 'border-blue-500/20 bg-blue-500/[0.07]'}`}
        >
          <div className="flex items-start gap-2 p-2">
            <button
              type="button"
              className={`grid flex-1 grid-cols-[32px_minmax(0,1fr)] items-start gap-2 rounded-xl p-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/70 ${n.read ? 'hover:bg-slate-800/80' : 'hover:bg-blue-500/10'}`}
              onClick={() => handleNotificationClick(n)}
              aria-label={`Open: ${n.title || 'notification'}`}
            >
              <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${n.read ? 'bg-slate-800 text-slate-500' : 'bg-blue-500/15 text-blue-400'}`}>
                {String(n.type || '').startsWith('song_')
                  ? <Music size={16} aria-hidden="true" />
                  : <CalendarDays size={16} aria-hidden="true" />}
              </span>
              <div className="min-w-0">
                <p className={`break-words text-sm font-bold leading-tight ${n.read ? 'text-slate-300' : 'text-white'}`}>
                  {n.title || 'New lineup added'}
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  {timeAgo(n.createdAt)}
                </p>
              </div>
            </button>
            <button
              type="button"
              className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-slate-800 hover:text-slate-300"
              onClick={(e) => { e.stopPropagation(); onClearNotification(n.id); }}
              aria-label="Dismiss notification"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const mobilePanel = open && typeof document !== 'undefined'
    ? createPortal(
      <div
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm lg:hidden"
        onClick={() => setOpen(false)}
        role="presentation"
      >
        <div
          ref={mobilePanelRef}
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] top-[calc(env(safe-area-inset-top)+0.75rem)] flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl ring-1 ring-white/10"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Notifications"
        >
          <div className="shrink-0 border-b border-slate-800 bg-slate-950 p-4">
            {header}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            {list}
          </div>
          <div className="shrink-0 border-t border-slate-800 bg-slate-950 p-3">
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-black text-white transition-colors hover:bg-slate-700"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="relative inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm font-bold text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-800 hover:text-white"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell size={16} aria-hidden="true" />
        <span className="hidden sm:inline">Notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 grid min-w-5 place-items-center rounded-full bg-blue-500 px-1.5 text-[10px] font-black leading-5 text-white shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {mobilePanel}

      {open && (
        <div className="absolute right-0 top-full z-[1000] mt-2 hidden max-h-[calc(100dvh-120px)] w-[min(400px,calc(100vw-24px))] min-w-[320px] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl ring-1 ring-white/10 lg:flex lg:flex-col">
          <div className="shrink-0 border-b border-slate-800 bg-slate-900/95 p-4 backdrop-blur">
            {header}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {list}
          </div>
        </div>
      )}
    </div>
  );
}
