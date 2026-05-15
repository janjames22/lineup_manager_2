import { BookOpen, CalendarDays, Home, Plus } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navLinkClass = ({ isActive }) =>
  `flex min-w-0 max-w-full flex-col items-center justify-center gap-0.5 py-1 transition-colors duration-200 ${
    isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
  }`;

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
  return (
    <nav className="bottom-nav fixed inset-x-0 bottom-0 z-50 grid w-full max-w-full grid-cols-[repeat(5,minmax(0,1fr))] items-center gap-0 overflow-hidden border-t border-slate-800/50 bg-slate-900/95 px-1.5 pt-1 backdrop-blur-md print:hidden lg:hidden">
      <NavLink to="/" className={navLinkClass}>
        <span className="relative grid size-6 place-items-center">
          <Home size={22} />
          <UnreadBadge count={unreadNotificationCount} />
        </span>
        <span className="max-w-full truncate text-[9px] font-black uppercase tracking-normal min-[380px]:text-[10px]">Home</span>
      </NavLink>
      <NavLink to="/songs" className={navLinkClass}>
        <BookOpen size={22} />
        <span className="max-w-full truncate text-[9px] font-black uppercase tracking-normal min-[380px]:text-[10px]">Songs</span>
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
      <NavLink to="/lineups" className={navLinkClass}>
        <CalendarDays size={22} />
        <span className="max-w-full truncate text-[9px] font-black uppercase tracking-normal min-[380px]:text-[10px]">Plans</span>
      </NavLink>
      <NavLink to="/lineups/new" className={navLinkClass}>
        <Plus size={22} />
        <span className="max-w-full truncate text-[9px] font-black uppercase tracking-normal min-[380px]:text-[10px]">New</span>
      </NavLink>
    </nav>
  );
}
