import { CalendarPlus, Library, Music2, Monitor, QrCode } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import SongCard from '../components/SongCard';
import LoadingScreen from '../components/LoadingScreen';
import { useLineups } from '../hooks/useLineups';
import { useOfflineItems } from '../hooks/useOfflineItems';
import { useSongs } from '../hooks/useSongs';

export default function Dashboard({ onShareApp }) {
  const { songs, loading: songsLoading } = useSongs();
  const { lineups, loading: lineupsLoading } = useLineups();
  const offlineSongs = useOfflineItems('song');
  const loading = songsLoading || lineupsLoading;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(() => (
    lineups
      .filter((lineup) => lineup.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] || null
  ), [lineups, today]);

  if (loading) return <LoadingScreen />;

  const recentSongs = songs.slice(0, 3);

  return (
    <main className="page-shell dashboard-page">
      <PageHeader
        eyebrow="Dashboard"
        title="Prepare Sunday with one clear workspace"
        description="Manage worship songs, keys, arrangements, vocalist cues, and team assignments from a local-first app."
        actions={
          <>
            <Link className="btn-primary" to="/songs/new">
              <Music2 size={18} aria-hidden="true" /> Add Song
            </Link>
            <Link className="btn-secondary" to="/lineups/new">
              <CalendarPlus size={18} aria-hidden="true" /> Create Lineup
            </Link>
          </>
        }
      />

      <section className="grid w-full min-w-0 gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="panel w-full">
          <div className="mb-6 flex min-w-0 flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">Upcoming Sunday Lineup</h2>
            <Link to="/lineups" className="shrink-0 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors">View all</Link>
          </div>
          {upcoming ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-950/60 to-indigo-950/20 p-4 shadow-inner ring-1 ring-blue-400/10 sm:p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">{upcoming.date} • {upcoming.serviceTime}</p>
                <h3 className="mt-1 break-words text-xl font-black text-white sm:text-2xl">{upcoming.worshipLeader || 'Worship Leader TBD'}</h3>
              </div>
              <ol className="space-y-3">
                {upcoming.songs.map((song, index) => (
                  <li key={`${song.id || song.songId}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 transition hover:border-slate-700 hover:bg-slate-800/60 sm:p-4">
                    <span className="min-w-0 break-words font-bold text-slate-200">
                      <span className="mr-1 font-black text-slate-600 tabular-nums">{index + 1}.</span>
                      {song.title}
                    </span>
                    <span className="shrink-0 rounded-full bg-amber-950/50 px-3 py-1 text-xs font-black text-amber-300 shadow-sm border border-amber-800/40">{song.selectedKey}</span>
                  </li>
                ))}
              </ol>
              <div className="grid w-full min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:flex sm:flex-wrap sm:gap-3">
                <Link className="btn-primary w-full sm:w-auto" to={`/lineups/${upcoming.id}`}>Open Lineup</Link>
                <Link className="btn-secondary w-full sm:w-auto" to={`/lineups/${upcoming.id}/monitor`}>
                  <Monitor size={18} aria-hidden="true" /> Monitor
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/20 p-6 text-center transition hover:border-slate-700 hover:bg-slate-950/30 sm:p-10">
              <p className="text-slate-500 font-bold">No upcoming lineup yet.</p>
              <Link className="btn-primary mt-6 mx-auto sm:px-8" to="/lineups/new">Create Sunday Lineup</Link>
            </div>
          )}
        </div>

        <div className="panel h-fit w-full">
          <div className="mb-5 flex items-center gap-3">
            <h2 className="section-title">Quick Actions</h2>
            <span className="h-px flex-1 bg-slate-800/80" aria-hidden="true" />
          </div>
          <div className="grid gap-3">
            <Link className="quick-action" to="/songs">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-950/50 text-blue-400 shadow-sm ring-1 ring-white/10"><Library size={20} aria-hidden="true" /></span>
              <span className="flex min-w-0 flex-col">
                <span className="break-words font-black text-white tracking-tight">View Song Library</span>
                <span className="break-words text-xs font-medium normal-case text-slate-400">Browse and search chords</span>
              </span>
            </Link>
            <Link className="quick-action" to="/songs/new">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-950/50 text-amber-500 shadow-sm ring-1 ring-white/10"><Music2 size={20} aria-hidden="true" /></span>
              <span className="flex min-w-0 flex-col">
                <span className="break-words font-black text-white tracking-tight">Add Chord Chart</span>
                <span className="break-words text-xs font-medium normal-case text-slate-400">Add a new song to your library</span>
              </span>
            </Link>
            <Link className="quick-action" to="/lineups/new">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-950/50 text-emerald-500 shadow-sm ring-1 ring-white/10"><CalendarPlus size={20} aria-hidden="true" /></span>
              <span className="flex min-w-0 flex-col">
                <span className="break-words font-black text-white tracking-tight">Build Sunday Lineup</span>
                <span className="break-words text-xs font-medium normal-case text-slate-400">Plan a new service</span>
              </span>
            </Link>
            <button className="quick-action text-left" type="button" onClick={onShareApp}>
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-950/50 text-blue-300 shadow-sm ring-1 ring-white/10"><QrCode size={20} aria-hidden="true" /></span>
              <span className="flex min-w-0 flex-col">
                <span className="break-words font-black text-white tracking-tight">Share App QR</span>
                <span className="break-words text-xs font-medium normal-case text-slate-400">Open or install on another phone</span>
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-5 flex min-w-0 flex-wrap items-center gap-3">
          <h2 className="section-title">Recently Added Songs</h2>
          <span className="h-px flex-1 bg-slate-800/80" aria-hidden="true" />
          <Link to="/songs" className="shrink-0 text-sm font-black text-blue-400 hover:text-blue-300">Open library</Link>
        </div>
        <div className="grid w-full min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recentSongs.map((song) => <SongCard key={song.id} song={song} offline={offlineSongs} />)}
        </div>
      </section>
    </main>
  );
}
