import { ArrowLeft, Monitor, Pencil, Printer, Trash2, Youtube, BookOpen, ChevronUp, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import TeamAssignments from '../components/TeamAssignments';
import ChordChartViewer from '../components/ChordChartViewer';
import OfflineItemButton from '../components/OfflineItemButton';
import { createOfflineLineupPayload, deleteLineup, getLineupById, getSongs, saveLineup } from '../utils/storage';
import { useToast } from '../hooks/useToast';
import { useOfflineItems } from '../hooks/useOfflineItems';
import { getSemitoneDelta, transposeChords, getTransposedKey } from '../utils/transposeChords';

export default function LineupView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lineup, setLineup] = useState(null);
  const [songsMap, setSongsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openSongs, setOpenSongs] = useState(() => new Set([0]));

  const toggleSong = (index) => setOpenSongs((prev) => {
    const next = new Set(prev);
    next.has(index) ? next.delete(index) : next.add(index);
    return next;
  });
  const { showToast } = useToast();
  const offlineLineups = useOfflineItems('lineup');

  useEffect(() => {
    async function loadData() {
      try {
        const [lineupData, allSongs] = await Promise.all([
          getLineupById(id),
          getSongs()
        ]);
        if (!lineupData) throw new Error('Lineup not found.');
        setLineup(lineupData);
        
        const map = {};
        (Array.isArray(allSongs) ? allSongs : []).forEach(s => map[s.id] = s);
        setSongsMap(map);
      } catch (error) {
        console.error('Failed to load lineup:', error);
        setError('Unable to load this lineup. Please try again.');
        setLineup(null);
        setSongsMap({});
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <main className="page-shell">
        <p className="text-slate-300">Loading lineup...</p>
      </main>
    );
  }

  if (!lineup) {
    return (
      <main className="page-shell">
        {/* BUG-017: loading is always false here because of the early return above — render the not-found message directly. */}
        <p className="text-slate-300">Lineup not found.</p>
        {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
        <Link className="btn-primary mt-4" to="/lineups"><ArrowLeft size={18} aria-hidden="true" /> Back to Lineups</Link>
      </main>
    );
  }

  const remove = async () => {
    if (window.confirm(`Are you sure you want to delete the lineup for ${lineup.date}?`)) {
      try {
        await deleteLineup(lineup.id);
        showToast(`Lineup for ${lineup.date} deleted`, 'info');
        navigate('/lineups');
      } catch {
        showToast('Failed to delete lineup', 'error');
      }
    }
  };

  const updateSongKey = async (index, delta) => {
    const currentLineupSong = lineup.songs[index];
    const newKey = getTransposedKey(currentLineupSong.selectedKey, delta);
    if (newKey === currentLineupSong.selectedKey) return;
    
    const newSongs = [...lineup.songs];
    newSongs[index] = { ...currentLineupSong, selectedKey: newKey };
    
    const updatedLineup = { ...lineup, songs: newSongs };
    setLineup(updatedLineup);
    
    try {
      await saveLineup(updatedLineup, { notify: false });
      showToast(`${currentLineupSong.title} transposed to ${newKey}`, 'success', 2000);
    } catch {
      showToast('Failed to save key change', 'error');
      setLineup(lineup);
    }
  };

  return (
    <main className="page-shell lineup-page">
      <PageHeader
        eyebrow="Sunday Lineup"
        title={`${lineup.date} • ${lineup.serviceTime}`}
        description={lineup.worshipLeader ? `Worship Leader: ${lineup.worshipLeader}` : 'Worship Leader TBD'}
        actions={
          <>
            <Link className="btn-secondary" to="/lineups"><ArrowLeft size={18} aria-hidden="true" /> Lineups</Link>
            <Link className="btn-secondary" to={`/lineups/${lineup.id}/monitor`}><Monitor size={18} aria-hidden="true" /> Monitor</Link>
            <Link className="btn-secondary" to={`/lineups/${lineup.id}/print`}><Printer size={18} aria-hidden="true" /> Print</Link>
            <Link className="btn-secondary" to={`/lineups/${lineup.id}/edit`}><Pencil size={18} aria-hidden="true" /> Edit</Link>
            <button className="btn-danger" type="button" onClick={remove}><Trash2 size={18} aria-hidden="true" /> Delete</button>
            <OfflineItemButton
              item={lineup}
              offline={offlineLineups}
              type="lineup"
              getSavePayload={createOfflineLineupPayload}
            />
          </>
        }
      />

      <section className="grid w-full min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
        <div className="min-w-0 space-y-4">
          {lineup.songs.map((lineupSong, index) => {
            const embeddedSong = lineupSong.song || (lineupSong.chordChart ? lineupSong : null);
            const song = songsMap[lineupSong.id || lineupSong.songId] || embeddedSong;
            const delta = song ? getSemitoneDelta(song.originalKey, lineupSong.selectedKey) : 0;
            return (
              <article key={`${lineupSong.id || lineupSong.songId}-${index}`} className="panel flex w-full min-w-0 flex-col gap-0">
                <button
                  type="button"
                  className="flex w-full min-w-0 items-center gap-3 text-left"
                  onClick={() => toggleSong(index)}
                  aria-expanded={openSongs.has(index)}
                >
                  <span className="lineup-song-number">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-wrap-anywhere min-w-0 text-base font-black leading-tight text-white sm:text-xl">{lineupSong.title}</h2>
                    {song?.artist && <p className="break-words text-xs font-bold text-slate-500">{song.artist}</p>}
                  </div>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-slate-500 transition-transform duration-200 ${openSongs.has(index) ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                {openSongs.has(index) && (
                  <div className="mt-4 animate-fade-in">
                    {lineupSong.notes && (
                      <p className="mb-4 break-words border-y border-r border-slate-800/50 border-l-4 border-l-slate-600/50 bg-slate-950/50 p-3 text-sm font-medium text-slate-300 sm:ml-11">
                        {lineupSong.notes}
                      </p>
                    )}
                    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3 sm:ml-11">
                      <div className="flex max-w-full min-w-0 items-center gap-1 rounded-xl border border-slate-800/50 bg-slate-950/50 p-1.5 shadow-inner">
                        <button className="grid size-10 place-items-center rounded-lg text-slate-500 transition-all hover:bg-slate-800 hover:text-white active:scale-90" onClick={() => updateSongKey(index, -1)} title="Transpose Down">
                          <ChevronDown size={20} />
                        </button>
                        <div className="flex min-w-14 flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 shadow-lg">
                          <span className="mb-1 text-[10px] font-black uppercase leading-none tracking-widest text-slate-500">Key</span>
                          <span className="text-base font-black leading-none text-blue-400">{lineupSong.selectedKey}</span>
                        </div>
                        <button className="grid size-10 place-items-center rounded-lg text-slate-500 transition-all hover:bg-slate-800 hover:text-white active:scale-90" onClick={() => updateSongKey(index, 1)} title="Transpose Up">
                          <ChevronUp size={20} />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {song && (
                          <Link to={`/songs/${song.id}?from=lineup&lineupId=${lineup.id}`} className="btn-secondary !py-2 !px-3.5 text-xs font-black uppercase tracking-wider" title="Song Details">
                            <BookOpen size={14} /> Details
                          </Link>
                        )}
                        {song?.youtubeLink && (
                          <a href={song.youtubeLink} target="_blank" rel="noopener noreferrer" className="btn-secondary !py-2 !px-3.5 text-xs font-black uppercase tracking-wider !text-red-500 hover:!bg-red-950/50 hover:!border-red-900/50" title="Open YouTube">
                            <Youtube size={14} /> Listen
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 w-full min-w-0 max-w-full overflow-hidden sm:ml-11">
                      <ChordChartViewer
                        preClassName="!p-3 !bg-slate-950/80 !border-slate-800/50 sm:!p-5"
                        chordChart={song ? transposeChords(song.chordChart, delta) : ''}
                        emptyText={song ? 'No chord chart added.' : 'Song not found in library.'}
                        showControls={index === 0}
                      />
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <aside className="space-y-6">
          <section className="panel">
            <h2 className="section-title">Team Assignments</h2>
            <div className="mt-6">
              <TeamAssignments musicians={lineup.musicians} readOnly />
            </div>
          </section>
          {lineup.generalNotes && (
            <section className="panel">
              <h2 className="section-title">General Reminders</h2>
              <p className="mt-4 whitespace-pre-wrap text-slate-300 font-medium leading-relaxed">{lineup.generalNotes}</p>
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}
