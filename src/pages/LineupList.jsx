import { Calendar, CalendarPlus, Eye, Pencil, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import LoadingScreen from '../components/LoadingScreen';
import DataRefreshStatus from '../components/DataRefreshStatus';
import OfflineItemButton from '../components/OfflineItemButton';
import { useLineups } from '../hooks/useLineups';
import { useOfflineItems } from '../hooks/useOfflineItems';
import { createOfflineLineupPayload } from '../utils/storage';

export default function LineupList() {
  const { error, lastUpdatedAt, lineups, loading, realtimeStatus, refreshing } = useLineups();
  const offlineLineups = useOfflineItems('lineup');
  
  if (loading) return <LoadingScreen />;

  return (
    <main className="page-shell lineup-page">
      <PageHeader
        eyebrow="Sunday Lineups"
        title="Service Plans"
        description="Create, review, monitor, and print weekly worship lineups."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <DataRefreshStatus lastUpdatedAt={lastUpdatedAt} refreshing={refreshing} status={realtimeStatus} />
            <Link className="btn-primary" to="/lineups/new"><CalendarPlus size={18} aria-hidden="true" /> Create Lineup</Link>
          </div>
        }
      />

      {error && <p className="mb-4 text-sm font-semibold text-red-300">{error}</p>}

      {lineups.length ? (
        <div className="grid w-full min-w-0 gap-3 sm:gap-4">
          {lineups.map((lineup) => (
            <article key={lineup.id} className="panel w-full">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase leading-snug tracking-widest text-blue-400 sm:text-xs">
                    <Calendar size={11} aria-hidden="true" className="shrink-0" />
                    {lineup.date} • {lineup.serviceTime}
                  </p>
                  <h2 className="text-wrap-anywhere mt-1 text-lg font-black leading-tight text-white sm:text-xl">{lineup.worshipLeader || 'Worship Leader TBD'}</h2>
                  <p className="mt-1 text-xs font-bold text-slate-500 sm:text-sm">{lineup.songs.length} song{lineup.songs.length !== 1 ? 's' : ''}</p>
                  {lineup.songs.length > 0 && (
                    <ol className="mt-3 space-y-1">
                      {lineup.songs.slice(0, 3).map((song, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="lineup-song-number !size-5 !text-[10px]">{idx + 1}</span>
                          <span className="min-w-0 truncate font-semibold">{song.title}</span>
                          {song.selectedKey && (
                            <span className="ml-auto shrink-0 rounded-full border border-amber-900/40 bg-amber-950/50 px-2 py-0.5 text-[10px] font-black text-amber-400">{song.selectedKey}</span>
                          )}
                        </li>
                      ))}
                      {lineup.songs.length > 3 && (
                        <li className="pl-7 text-[10px] font-bold text-slate-600">+{lineup.songs.length - 3} more</li>
                      )}
                    </ol>
                  )}
                </div>
                <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:w-auto lg:flex-wrap lg:justify-end">
                  <Link className="btn-secondary w-full !px-2 !py-2 text-xs lg:w-auto lg:!px-5 lg:!py-3 lg:text-[15px]" to={`/lineups/${lineup.id}`}><Eye size={16} aria-hidden="true" /> View</Link>
                  <Link className="btn-secondary w-full !px-2 !py-2 text-xs lg:w-auto lg:!px-5 lg:!py-3 lg:text-[15px]" to={`/lineups/${lineup.id}/edit`}><Pencil size={16} aria-hidden="true" /> Edit</Link>
                  <Link className="btn-secondary w-full !px-2 !py-2 text-xs lg:w-auto lg:!px-5 lg:!py-3 lg:text-[15px]" to={`/lineups/${lineup.id}/print`}><Printer size={16} aria-hidden="true" /> Print</Link>
                  <OfflineItemButton
                    className="col-span-3 w-full lg:w-auto"
                    item={lineup}
                    offline={offlineLineups}
                    type="lineup"
                    getSavePayload={createOfflineLineupPayload}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={Calendar} title="No lineups yet" message="Create the first Sunday lineup and assign your team." action={<Link className="btn-primary" to="/lineups/new">Create Lineup</Link>} />
      )}
    </main>
  );
}
