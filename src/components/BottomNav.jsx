import { BookOpen, CalendarDays, Home, Plus } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navLinkClass = ({ isActive }) =>
  `flex flex-col items-center gap-1 py-1 transition-all duration-200 ${
    isActive ? 'text-blue-500 scale-110' : 'text-slate-500 hover:text-slate-300'
  }`;

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-slate-800/50 bg-slate-900/95 px-4 pb-[env(safe-area-inset-bottom,12px)] pt-3 backdrop-blur-md lg:hidden">
      <NavLink to="/" className={navLinkClass}>
        <Home size={22} />
        <span className="text-[10px] font-black uppercase tracking-widest">Home</span>
      </NavLink>
      <NavLink to="/songs" className={navLinkClass}>
        <BookOpen size={22} />
        <span className="text-[10px] font-black uppercase tracking-widest">Songs</span>
      </NavLink>
      <div className="relative -top-6">
        <NavLink 
          to="/songs/new" 
          className="flex size-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.4)] ring-4 ring-slate-950 active:scale-90 transition-transform"
        >
          <Plus size={28} strokeWidth={3} />
        </NavLink>
      </div>
      <NavLink to="/lineups" className={navLinkClass}>
        <CalendarDays size={22} />
        <span className="text-[10px] font-black uppercase tracking-widest">Plans</span>
      </NavLink>
      <NavLink to="/lineups/new" className={navLinkClass}>
        <Plus size={22} />
        <span className="text-[10px] font-black uppercase tracking-widest">New</span>
      </NavLink>
    </nav>
  );
}
