import { BookOpen, CalendarDays, Home, LogOut, Plus, QrCode, Settings } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import OfflineStatusBadge from './OfflineStatusBadge';
import NotificationBell from './NotificationBell';

const navLink = ({ isActive }) =>
  `relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition-all duration-200 ${
    isActive
      ? 'text-blue-400 font-extrabold after:absolute after:bottom-0 after:inset-x-1 after:h-0.5 after:rounded-full after:bg-blue-400'
      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
  }`;

export default function Navbar({
  onShareApp,
  onSignOut,
  notifications = [],
  unreadNotificationCount = 0,
  onMarkNotificationsRead,
  onMarkNotificationRead,
  onClearNotification,
  notificationSoundEnabled,
  onNotificationSoundEnabledChange,
}) {
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  return (
    <header className="border-b border-slate-800/80 bg-slate-900/95 backdrop-blur-md sticky top-0 z-40 print:hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-3 px-3 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link to="/" className="group flex min-w-0 items-center gap-3">
          <div className="relative size-11 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-1 ring-1 ring-white/10 group-hover:ring-white/20 transition-all shadow-lg">
            <img src="/logo.png" alt="Line Up Manager Logo" className="h-full w-full object-contain" />
            {unreadNotificationCount > 0 && (
              <span
                className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-blue-500 px-1 text-[10px] font-black leading-5 text-white shadow-lg ring-2 ring-slate-900"
                aria-label={`${unreadNotificationCount} unread notification${unreadNotificationCount === 1 ? '' : 's'}`}
              >
                {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
              </span>
            )}
          </div>
          <span className="min-w-0">
            <span className="block truncate text-base font-extrabold text-white tracking-tight group-hover:text-blue-400 transition-colors">Line Up Manager</span>
            <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">Official App</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-2 lg:flex">
          <OfflineStatusBadge />
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadNotificationCount}
            onMarkAllRead={onMarkNotificationsRead}
            onMarkNotificationRead={onMarkNotificationRead}
            onClearNotification={onClearNotification}
            soundEnabled={notificationSoundEnabled}
            onSoundEnabledChange={onNotificationSoundEnabledChange}
          />
          <NavLink to="/" className={navLink}>
            <Home size={16} aria-hidden="true" /> Dashboard
          </NavLink>
          <NavLink to="/songs" className={navLink}>
            <BookOpen size={16} aria-hidden="true" /> Songs
          </NavLink>
          <NavLink to="/lineups" className={navLink}>
            <CalendarDays size={16} aria-hidden="true" /> Lineups
          </NavLink>
          <NavLink to="/settings" className={navLink}>
            <Settings size={16} aria-hidden="true" /> Settings
          </NavLink>
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm font-bold text-slate-300 transition-all duration-200 hover:border-slate-600 hover:bg-slate-800 hover:text-white" type="button" onClick={onShareApp}>
            <QrCode size={16} aria-hidden="true" /> Share App QR
          </button>
          <Link to="/songs/new" className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400">
            <Plus size={16} aria-hidden="true" /> Add Song
          </Link>
          <span className="mx-1 h-5 w-px bg-slate-700/80" aria-hidden="true" />
          {confirmingSignOut ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-800/50 bg-red-950/20 px-3 py-2 text-sm font-bold">
              <span className="text-slate-400">Sign out?</span>
              <button type="button" onClick={onSignOut} className="text-red-400 transition-colors hover:text-red-300">Yes</button>
              <span className="text-slate-700" aria-hidden="true">/</span>
              <button type="button" onClick={() => setConfirmingSignOut(false)} className="text-slate-400 transition-colors hover:text-white">No</button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingSignOut(true)}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-slate-500 transition-all duration-200 hover:bg-red-950/20 hover:text-red-400"
            >
              <LogOut size={16} aria-hidden="true" /> Sign Out
            </button>
          )}
        </nav>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:hidden">
          <OfflineStatusBadge />
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadNotificationCount}
            onMarkAllRead={onMarkNotificationsRead}
            onMarkNotificationRead={onMarkNotificationRead}
            onClearNotification={onClearNotification}
            soundEnabled={notificationSoundEnabled}
            onSoundEnabledChange={onNotificationSoundEnabledChange}
          />
          <button className="ml-auto inline-flex shrink-0 min-h-10 max-w-full min-w-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm font-bold text-slate-200" type="button" onClick={onShareApp}>
            <QrCode size={16} aria-hidden="true" /> Install QR
          </button>
          {confirmingSignOut ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-800/50 bg-red-950/20 px-3 py-2 text-sm font-bold">
              <button type="button" onClick={onSignOut} className="text-red-400 hover:text-red-300">Yes</button>
              <span className="text-slate-700" aria-hidden="true">/</span>
              <button type="button" onClick={() => setConfirmingSignOut(false)} className="text-slate-400 hover:text-white">No</button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingSignOut(true)}
              className="icon-button shrink-0 hover:border-red-800/60 hover:bg-red-950/20 hover:text-red-400"
              aria-label="Sign out"
            >
              <LogOut size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
