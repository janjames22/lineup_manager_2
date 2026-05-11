import { Eye, Monitor, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatBpm } from '../utils/constants';

export default function SongCard({ song }) {
  return (
    <article className="panel flex flex-col justify-between p-5 sm:p-6 h-full">
      <div>
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-black text-white leading-tight">{song.title}</h2>
            <p className="mt-0.5 break-words text-sm font-bold text-slate-400">{song.artist || 'Unknown artist'}</p>
          </div>
          <span className="shrink-0 rounded-lg bg-blue-950/40 px-3 py-1.5 text-sm font-black text-blue-400 shadow-sm border border-blue-900/50">{song.selectedKey || song.originalKey}</span>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-950/50 p-2.5 border border-slate-800/50">
            <dt className="text-[10px] font-black uppercase tracking-widest text-slate-500">Category</dt>
            <dd className="mt-0.5 font-bold text-slate-200">{song.category || '-'}</dd>
          </div>
          <div className="rounded-xl bg-slate-950/50 p-2.5 border border-slate-800/50">
            <dt className="text-[10px] font-black uppercase tracking-widest text-slate-500">BPM</dt>
            <dd className="mt-0.5 font-bold text-slate-200">{formatBpm(song.tempo)}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link to={`/songs/${song.id}`} className="btn-secondary flex-1 sm:flex-none">
          <Eye size={16} aria-hidden="true" /> View
        </Link>
        <Link to={`/lyrics-monitor/${song.id}`} className="btn-secondary flex-1 sm:flex-none">
          <Monitor size={16} aria-hidden="true" /> Monitor
        </Link>
        <Link to={`/songs/${song.id}/edit`} className="btn-secondary flex-1 sm:flex-none">
          <Pencil size={16} aria-hidden="true" /> Edit
        </Link>
      </div>
    </article>
  );
}
