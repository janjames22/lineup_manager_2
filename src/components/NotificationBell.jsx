import { Bell, CheckCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function NotificationBell({ notifications, unreadCount, onMarkAllRead, onClearNotification }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    console.log('NotificationBell mounted in Navbar/App layout.');
    return () => {
      console.log('NotificationBell unmounted from Navbar/App layout.');
    };
  }, []);

  useEffect(() => {
    console.log('NotificationBell render state:', {
      notificationCount: notifications.length,
      unreadCount,
      open,
    });
  }, [notifications, unreadCount, open]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        className="relative inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm font-bold text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-800 hover:text-white"
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open && unreadCount > 0) onMarkAllRead();
        }}
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

      {open && (
        <div className="fixed left-4 right-4 top-28 z-[90] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl ring-1 ring-white/10 lg:absolute lg:left-auto lg:right-0 lg:top-full lg:mt-2 lg:w-[min(calc(100vw-2rem),22rem)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 p-4">
            <div>
              <p className="text-sm font-black text-white">Notifications</p>
              <p className="text-xs font-semibold text-slate-500">{unreadCount ? `${unreadCount} unread` : 'All caught up'}</p>
            </div>
            <button className="text-xs font-black uppercase tracking-wider text-blue-300 hover:text-blue-200" type="button" onClick={onMarkAllRead}>
              <CheckCheck size={16} className="mr-1 inline" aria-hidden="true" />
              Read
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length ? notifications.map((notification) => (
              <div key={notification.id} className="flex min-w-0 gap-3 border-b border-slate-800/70 p-4 last:border-b-0">
                <span className={`mt-1 size-2 shrink-0 rounded-full ${notification.read ? 'bg-slate-700' : 'bg-blue-400'}`} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-black text-white">{notification.message}</p>
                  {(notification.date || notification.serviceTime) && (
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {[notification.date, notification.serviceTime].filter(Boolean).join(' • ')}
                    </p>
                  )}
                  <p className="mt-1 text-xs font-medium text-slate-600">{new Date(notification.createdAt).toLocaleString()}</p>
                </div>
                <button className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white" type="button" onClick={() => onClearNotification(notification.id)} aria-label="Remove notification">
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            )) : (
              <p className="p-5 text-sm font-semibold text-slate-500">No lineup notifications yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
