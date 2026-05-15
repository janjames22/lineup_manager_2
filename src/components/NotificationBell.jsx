import { Bell, CheckCheck, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhoneNotificationsButton from './PhoneNotificationsButton';

const IS_DEV = import.meta.env.DEV;

function debugNotificationBell(message, details) {
  if (!IS_DEV) return;
  if (typeof details === 'undefined') {
    console.log(`[LineupNotifications] ${message}`);
    return;
  }
  console.log(`[LineupNotifications] ${message}`, details);
}

export default function NotificationBell({
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkNotificationRead,
  onClearNotification,
  soundEnabled = true,
  onSoundEnabledChange,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const mobilePanelRef = useRef(null);
  const navigate = useNavigate();
  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((first, second) => {
      if (first.read !== second.read) return first.read ? 1 : -1;
      return new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime();
    });
  }, [notifications]);

  useEffect(() => {
    debugNotificationBell('NotificationBell mounted in Navbar/App layout');
    return () => {
      debugNotificationBell('NotificationBell unmounted from Navbar/App layout');
    };
  }, []);

  useEffect(() => {
    debugNotificationBell('NotificationBell render state', {
      notificationCount: notifications.length,
      unreadCount,
      open,
      soundEnabled,
    });
  }, [notifications, unreadCount, open, soundEnabled]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      const target = event.target;
      if (
        containerRef.current?.contains(target)
        || mobilePanelRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const isMobileViewport = window.matchMedia?.('(max-width: 1023px)').matches;
    if (!isMobileViewport) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, [open]);

  const handleNotificationClick = (notification) => {
    debugNotificationBell('notification row clicked');
    debugNotificationBell('clicked notification', notification);

    if (!notification?.lineupId) {
      console.warn('[LineupNotifications] notification click skipped because lineupId is missing.', notification);
      return;
    }

    const targetUrl = `/lineups/${notification.lineupId}`;
    debugNotificationBell('lineupId', notification.lineupId);
    debugNotificationBell('navigating to', targetUrl);

    onMarkNotificationRead?.(notification.id);
    setOpen(false);
    navigate(targetUrl);
  };

  const panelHeader = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-black text-white">Notifications</p>
        <p className="text-xs font-semibold text-slate-500">{unreadCount ? `${unreadCount} unread` : 'All caught up'}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-black uppercase tracking-wider text-blue-300 transition-colors hover:bg-slate-800 hover:text-blue-200 disabled:cursor-not-allowed disabled:text-slate-600"
          type="button"
          onClick={onMarkAllRead}
          disabled={!unreadCount}
          aria-label="Mark all notifications read"
        >
          <CheckCheck size={16} aria-hidden="true" />
          Read
        </button>
        <button
          className="grid size-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close notifications"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  const soundControl = (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
      <span className="text-xs font-bold text-slate-400">Notification sound</span>
      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-300">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
          checked={soundEnabled}
          onChange={(event) => onSoundEnabledChange?.(event.target.checked)}
        />
        <span>{soundEnabled ? 'On' : 'Off'}</span>
      </label>
    </div>
  );

  const notificationList = (
    <div>
      {sortedNotifications.length ? sortedNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`w-full border-b p-2 last:border-b-0 ${
            notification.read
              ? 'border-slate-800/70 bg-slate-900'
              : 'border-blue-500/20 bg-blue-500/[0.07]'
          }`}
        >
          <div className="flex w-full items-start gap-2">
            <button
              type="button"
              className={`grid flex-1 grid-cols-[12px_minmax(0,1fr)] items-start gap-3 rounded-xl p-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/70 ${
                notification.read ? 'hover:bg-slate-800/80' : 'hover:bg-blue-500/10'
              }`}
              onClick={() => handleNotificationClick(notification)}
              aria-label={`Open lineup for ${notification.title || 'this notification'}`}
            >
              <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${notification.read ? 'bg-slate-700' : 'bg-blue-400 shadow-[0_0_0_4px_rgba(59,130,246,0.12)]'}`} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`whitespace-normal break-words text-sm font-black leading-tight ${notification.read ? 'text-slate-300' : 'text-white'}`}>
                    {notification.title || 'New lineup added'}
                  </span>
                  {!notification.read && (
                    <span className="shrink-0 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-blue-200">
                      New
                    </span>
                  )}
                </div>
                <span className={`mt-1 block whitespace-normal break-words text-xs font-semibold leading-relaxed ${notification.read ? 'text-slate-500' : 'text-slate-300'}`}>
                  {notification.message || notification.body || 'Tap to open lineup'}
                </span>
                <span className="mt-1 block whitespace-normal break-words text-xs font-medium text-slate-600">
                  {new Date(notification.createdAt).toLocaleString()}
                </span>
              </div>
            </button>
            <button
              className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onClearNotification(notification.id);
              }}
              aria-label="Remove notification"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )) : (
        <div className="p-5">
          <p className="text-sm font-black text-slate-300">No notifications yet.</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">New lineup notifications will appear here.</p>
        </div>
      )}
    </div>
  );

  const mobileNotificationPanel = open && typeof document !== 'undefined'
    ? createPortal(
      <div
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm lg:hidden"
        onClick={() => setOpen(false)}
        role="presentation"
      >
        <div
          ref={mobilePanelRef}
          className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] top-[calc(env(safe-area-inset-top)+0.75rem)] flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl ring-1 ring-white/10"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Notifications"
        >
          <div className="shrink-0 border-b border-slate-800 bg-slate-950 p-4">
            {panelHeader}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            {notificationList}
            <div className="border-t border-slate-800/80 bg-slate-900/30">
              {soundControl}
              <div className="px-4 py-4">
                <PhoneNotificationsButton />
              </div>
            </div>
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
      document.body
    )
    : null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        className="relative inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm font-bold text-slate-200 transition-all hover:border-slate-600 hover:bg-slate-800 hover:text-white"
        type="button"
        onClick={() => setOpen((value) => !value)}
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

      {mobileNotificationPanel}

      {open && (
        <div className="absolute right-0 top-full z-[1000] mt-2 hidden max-h-[calc(100vh-120px)] w-[min(440px,calc(100vw-24px))] min-w-[360px] max-w-[440px] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl ring-1 ring-white/10 lg:flex lg:flex-col">
          <div className="shrink-0 border-b border-slate-800 bg-slate-900/95 p-4 backdrop-blur">
            {panelHeader}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {notificationList}
            <div className="border-t border-slate-800/80 bg-slate-900/30">
              {soundControl}
              <div className="px-4 py-4">
                <PhoneNotificationsButton />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
