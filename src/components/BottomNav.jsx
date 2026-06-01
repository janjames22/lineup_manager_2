import { BookOpen, CalendarDays, Home, Plus, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useScrollDirection } from '../hooks/useScrollDirection';

function UnreadBadge({ count }) {
  if (!count) return null;

  return (
    <span
      className="absolute -right-2 -top-1 grid min-w-5 place-items-center rounded-full bg-blue-500 px-1 text-[10px] font-black leading-5 text-white shadow-lg ring-2 ring-slate-900"
      aria-label={`${count} unread notification${count === 1 ? '' : 's'}`}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

export default function BottomNav({ unreadNotificationCount = 0 }) {
  const { isVisible } = useScrollDirection();

  return (
    <nav
      className={`bottom-nav fixed inset-x-0 bottom-0 z-50 grid w-full max-w-full grid-cols-[repeat(5,minmax(0,1fr))] items-center gap-0 overflow-hidden border-t border-slate-800/80 bg-slate-900/95 px-1.5 pt-1 backdrop-blur-md transition-transform duration-300 ease-in-out print:hidden lg:hidden ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <NavLink to="/" end>
        {({ isActive }) => (
          <span className={`relative flex min-w-0 max-w-full flex-col items-center justify-center gap-0.5 py-1 transition-colors duration-200 ${isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <span className="relative grid size-6 place-items-center">
              <Home size={22} />
              <UnreadBadge count={unreadNotificationCount} />
            </span>
            {isActive && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" aria-hidden="true" />
            )}
            <span className={`max-w-full truncate text-[9px] uppercase tracking-normal min-[380px]:text-[10px] ${isActive ? 'font-black' : 'font-bold'}`}>Home</span>
          </span>
        )}
      </NavLink>
      <NavLink to="/songs">
        {({ isActive }) => (
          <span className={`relative flex min-w-0 max-w-full flex-col items-center justify-center gap-0.5 py-1 transition-colors duration-200 ${isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <BookOpen size={22} />
            {isActive && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" aria-hidden="true" />
            )}
            <span className={`max-w-full truncate text-[9px] uppercase tracking-normal min-[380px]:text-[10px] ${isActive ? 'font-black' : 'font-bold'}`}>Songs</span>
          </span>
        )}
      </NavLink>
      <div className="relative flex min-w-0 justify-center">
        <NavLink
          to="/songs/new"
          className="flex size-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.35)] ring-2 ring-slate-950 transition-transform active:scale-90 min-[380px]:size-12"
          aria-label="Add song"
        >
          <Plus size={24} strokeWidth={3} />
        </NavLink>
      </div>
      <NavLink to="/lineups">
        {({ isActive }) => (
          <span className={`relative flex min-w-0 max-w-full flex-col items-center justify-center gap-0.5 py-1 transition-colors duration-200 ${isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <CalendarDays size={22} />
            {isActive && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" aria-hidden="true" />
            )}
            <span className={`max-w-full truncate text-[9px] uppercase tracking-normal min-[380px]:text-[10px] ${isActive ? 'font-black' : 'font-bold'}`}>Plans</span>
          </span>
        )}
      </NavLink>
      <NavLink to="/settings">
        {({ isActive }) => (
          <span className={`relative flex min-w-0 max-w-full flex-col items-center justify-center gap-0.5 py-1 transition-colors duration-200 ${isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <Settings size={22} />
            {isActive && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" aria-hidden="true" />
            )}
            <span className={`max-w-full truncate text-[9px] uppercase tracking-normal min-[380px]:text-[10px] ${isActive ? 'font-black' : 'font-bold'}`}>Settings</span>
          </span>
        )}
      </NavLink>
    </nav>
  );
}
