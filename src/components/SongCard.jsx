import { Eye, Monitor, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatBpm } from '../utils/constants';
import OfflineItemButton from './OfflineItemButton';

export default function SongCard({ offline, song }) {
  return (
    <article className="panel flex h-full w-full min-w-0 flex-col justify-between p-3 sm:p-6">
      <div>
        <div className="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h2 className="text-wrap-anywhere text-lg font-black leading-tight text-white sm:text-xl">{song.title}</h2>
            <p className="text-wrap-anywhere mt-0.5 text-xs font-bold text-slate-400 sm:text-sm">{song.artist || 'Unknown artist'}</p>
          </div>
          <span className="shrink-0 rounded-lg border border-blue-900/50 bg-blue-950/40 px-2.5 py-1 text-xs font-black text-blue-400 shadow-sm sm:px-3 sm:py-1.5 sm:text-sm">{song.selectedKey || song.originalKey}</span>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm min-[380px]:grid-cols-2 sm:mt-5 sm:gap-3">
          <div className="rounded-xl bg-slate-950/50 p-2.5 border border-slate-800/50">
            <dt className="text-[10px] font-black uppercase tracking-widest text-slate-500">Category</dt>
            <dd className="text-wrap-anywhere mt-0.5 font-bold text-slate-200">{song.category || '-'}</dd>
          </div>
          <div className="rounded-xl bg-slate-950/50 p-2.5 border border-slate-800/50">
            <dt className="text-[10px] font-black uppercase tracking-widest text-slate-500">BPM</dt>
            <dd className="mt-0.5 font-bold text-slate-200">{formatBpm(song.tempo)}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-5 grid w-full min-w-0 grid-cols-3 gap-2 sm:mt-6 sm:flex sm:flex-wrap">
        <Link to={`/songs/${song.id}`} className="btn-secondary w-full !px-2 !py-2 text-xs sm:w-auto sm:!px-5 sm:!py-3 sm:text-[15px]">
          <Eye size={16} aria-hidden="true" /> View
        </Link>
        <Link to={`/lyrics-monitor/${song.id}`} className="btn-secondary w-full !px-2 !py-2 text-xs sm:w-auto sm:!px-5 sm:!py-3 sm:text-[15px]">
          <Monitor size={16} aria-hidden="true" /> Monitor
        </Link>
        <Link to={`/songs/${song.id}/edit`} className="btn-secondary w-full !px-2 !py-2 text-xs sm:w-auto sm:!px-5 sm:!py-3 sm:text-[15px]">
          <Pencil size={16} aria-hidden="true" /> Edit
        </Link>
        {offline && <OfflineItemButton className="col-span-3 w-full pt-1" item={song} offline={offline} type="song" />}
      </div>
    </article>
  );
}
