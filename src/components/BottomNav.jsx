import { BookOpen, CalendarDays, Home, Plus } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navLinkClass = ({ isActive }) =>
  `flex min-w-0 max-w-full flex-col items-center gap-1 py-1 transition-all duration-200 ${
    isActive ? 'text-blue-500 scale-110' : 'text-slate-500 hover:text-slate-300'
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
    <nav className="bottom-nav fixed inset-x-0 bottom-0 z-50 grid w-full max-w-full grid-cols-5 items-end gap-1 overflow-hidden border-t border-slate-800/50 bg-slate-900/95 px-2 pt-3 backdrop-blur-md print:hidden lg:hidden">
      <NavLink to="/" className={navLinkClass}>
        <span className="relative grid size-6 place-items-center">
          <Home size={22} />
          <UnreadBadge count={unreadNotificationCount} />
        </span>
        <span className="max-w-full truncate text-[9px] font-black uppercase tracking-wider min-[380px]:text-[10px] min-[380px]:tracking-widest">Home</span>
      </NavLink>
      <NavLink to="/songs" className={navLinkClass}>
        <BookOpen size={22} />
        <span className="max-w-full truncate text-[9px] font-black uppercase tracking-wider min-[380px]:text-[10px] min-[380px]:tracking-widest">Songs</span>
      </NavLink>
      <div className="relative -top-5 flex min-w-0 justify-center">
        <NavLink 
          to="/songs/new" 
          className="flex size-12 min-[380px]:size-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.4)] ring-4 ring-slate-950 active:scale-90 transition-transform"
        >
          <Plus size={28} strokeWidth={3} />
        </NavLink>
      </div>
      <NavLink to="/lineups" className={navLinkClass}>
        <CalendarDays size={22} />
        <span className="max-w-full truncate text-[9px] font-black uppercase tracking-wider min-[380px]:text-[10px] min-[380px]:tracking-widest">Plans</span>
      </NavLink>
      <NavLink to="/lineups/new" className={navLinkClass}>
        <Plus size={22} />
        <span className="max-w-full truncate text-[9px] font-black uppercase tracking-wider min-[380px]:text-[10px] min-[380px]:tracking-widest">New</span>
      </NavLink>
    </nav>
  );
}
