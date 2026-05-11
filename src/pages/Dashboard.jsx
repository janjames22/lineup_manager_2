import { CalendarPlus, Library, Music2, Monitor } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import SongCard from '../components/SongCard';
import LoadingScreen from '../components/LoadingScreen';
import { getSongs, getUpcomingLineup } from '../utils/storage';

export default function Dashboard() {
  const [songs, setSongs] = useState([]);
  const [upcoming, setUpcoming] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [songsData, upcomingData] = await Promise.all([
          getSongs(),
          getUpcomingLineup()
        ]);
        setSongs(Array.isArray(songsData) ? songsData : []);
        setUpcoming(upcomingData);
      } catch (error) {
        console.error("Failed to load songs:", error);
        setSongs([]);
        setUpcoming(null);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <LoadingScreen />;

  const recentSongs = songs.slice(0, 3);

  return (
    <main className="page-shell">
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

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel">
          <div className="mb-6 flex min-w-0 items-center justify-between gap-3">
            <h2 className="section-title">Upcoming Sunday Lineup</h2>
            <Link to="/lineups" className="shrink-0 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors">View all</Link>
          </div>
          {upcoming ? (
            <div className="space-y-5">
              <div className="rounded-2xl bg-gradient-to-br from-blue-900/30 to-indigo-900/10 p-6 border border-blue-500/20 shadow-inner">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">{upcoming.date} • {upcoming.serviceTime}</p>
                <h3 className="mt-1 text-2xl font-black text-white">{upcoming.worshipLeader || 'Worship Leader TBD'}</h3>
              </div>
              <ol className="space-y-3">
                {upcoming.songs.map((song, index) => (
                  <li key={`${song.id || song.songId}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:bg-slate-800/60 hover:border-slate-700">
                    <span className="min-w-0 break-words font-bold text-slate-200">{index + 1}. {song.title}</span>
                    <span className="shrink-0 rounded-lg bg-amber-950/40 px-3 py-1 text-xs font-black text-amber-400 shadow-sm border border-amber-900/50">{song.selectedKey}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-2 flex flex-wrap gap-3">
                <Link className="btn-primary flex-1 sm:flex-none" to={`/lineups/${upcoming.id}`}>Open Lineup</Link>
                <Link className="btn-secondary flex-1 sm:flex-none" to={`/lineups/${upcoming.id}/monitor`}>
                  <Monitor size={18} aria-hidden="true" /> Monitor
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-slate-800 bg-slate-950/20 p-6 text-center transition hover:border-slate-700 sm:p-10">
              <p className="text-slate-500 font-bold">No upcoming lineup yet.</p>
              <Link className="btn-primary mt-6 mx-auto sm:px-8" to="/lineups/new">Create Sunday Lineup</Link>
            </div>
          )}
        </div>

        <div className="panel h-fit">
          <h2 className="section-title mb-6">Quick Actions</h2>
          <div className="grid gap-3">
            <Link className="quick-action" to="/songs">
              <span className="grid size-10 place-items-center rounded-lg bg-blue-950/50 text-blue-400 shadow-sm ring-1 ring-white/10"><Library size={20} aria-hidden="true" /></span>
              <span className="flex min-w-0 flex-col">
                <span className="break-words font-black text-white tracking-tight">View Song Library</span>
                <span className="break-words text-[10px] font-bold uppercase tracking-widest text-slate-500">Browse and search chords</span>
              </span>
            </Link>
            <Link className="quick-action" to="/songs/new">
              <span className="grid size-10 place-items-center rounded-lg bg-amber-950/50 text-amber-500 shadow-sm ring-1 ring-white/10"><Music2 size={20} aria-hidden="true" /></span>
              <span className="flex min-w-0 flex-col">
                <span className="break-words font-black text-white tracking-tight">Add Chord Chart</span>
                <span className="break-words text-[10px] font-bold uppercase tracking-widest text-slate-500">Add a new song to your library</span>
              </span>
            </Link>
            <Link className="quick-action" to="/lineups/new">
              <span className="grid size-10 place-items-center rounded-lg bg-emerald-950/50 text-emerald-500 shadow-sm ring-1 ring-white/10"><CalendarPlus size={20} aria-hidden="true" /></span>
              <span className="flex min-w-0 flex-col">
                <span className="break-words font-black text-white tracking-tight">Build Sunday Lineup</span>
                <span className="break-words text-[10px] font-bold uppercase tracking-widest text-slate-500">Plan a new service</span>
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-6 flex min-w-0 items-center justify-between gap-3">
          <h2 className="section-title">Recently Added Songs</h2>
          <Link to="/songs" className="shrink-0 text-sm font-black text-blue-400 hover:text-blue-300">Open library</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recentSongs.map((song) => <SongCard key={song.id} song={song} />)}
        </div>
      </section>
    </main>
  );
}
