import { ArrowLeft, Monitor, Pencil, Printer, Trash2, Youtube, BookOpen, ChevronUp, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import TeamAssignments from '../components/TeamAssignments';
import LoadingScreen from '../components/LoadingScreen';
import ChordChartViewer from '../components/ChordChartViewer';
import { deleteLineup, getLineupById, getSongs, saveLineup } from '../utils/storage';
import { useToast } from '../hooks/useToast';
import { getSemitoneDelta, transposeChords, getTransposedKey } from '../utils/transposeChords';

export default function LineupView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lineup, setLineup] = useState(null);
  const [songsMap, setSongsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { showToast } = useToast();

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

  if (loading) return <LoadingScreen />;

  if (!lineup) {
    return (
      <main className="page-shell">
        <p className="text-slate-600">Lineup not found.</p>
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
      await saveLineup(updatedLineup);
      showToast(`${currentLineupSong.title} transposed to ${newKey}`, 'success', 2000);
    } catch {
      showToast('Failed to save key change', 'error');
      setLineup(lineup);
    }
  };

  return (
    <main className="page-shell">
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
          </>
        }
      />

      <section className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
        <div className="space-y-4">
          {lineup.songs.map((lineupSong, index) => {
            const song = songsMap[lineupSong.id || lineupSong.songId];
            const delta = song ? getSemitoneDelta(song.originalKey, lineupSong.selectedKey) : 0;
            return (
              <article key={`${lineupSong.id || lineupSong.songId}-${index}`} className="panel flex flex-col gap-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="flex size-7 items-center justify-center rounded-full bg-blue-950 text-sm font-black text-blue-400 ring-1 ring-blue-500/20 shadow-lg">{index + 1}</span>
                      <h2 className="text-2xl font-black text-white tracking-tight">{lineupSong.title}</h2>
                    </div>
                    {song?.artist && <p className="text-slate-400 font-bold ml-10">{song.artist}</p>}
                    {lineupSong.notes && <p className="mt-2 ml-10 text-sm font-medium text-slate-300 bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">{lineupSong.notes}</p>}
                  </div>
                  
                  <div className="flex flex-wrap items-center sm:flex-col sm:items-end gap-3 sm:ml-4 mt-2 sm:mt-0">
                    <div className="flex items-center gap-1 rounded-xl bg-slate-950/50 p-1.5 shadow-inner border border-slate-800/50">
                      <button className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white transition-all" onClick={() => updateSongKey(index, -1)} title="Transpose Down">
                        <ChevronDown size={20} />
                      </button>
                      <div className="flex flex-col items-center justify-center min-w-[3.5rem] px-2 py-1 bg-slate-900 rounded-lg shadow-lg border border-slate-700">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Key</span>
                        <span className="text-base font-black text-blue-400 leading-none">{lineupSong.selectedKey}</span>
                      </div>
                      <button className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white transition-all" onClick={() => updateSongKey(index, 1)} title="Transpose Up">
                        <ChevronUp size={20} />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {song && (
                        <Link to={`/songs/${song.id}`} className="btn-secondary !py-2 !px-3.5 text-xs font-black uppercase tracking-wider" title="Song Details">
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
                </div>
                
                <div className="mt-2 ml-10">
                  <ChordChartViewer
                    preClassName="!p-5 !bg-slate-950/80 !border-slate-800/50"
                    chordChart={song ? transposeChords(song.chordChart, delta) : ''}
                    emptyText={song ? 'No chord chart added.' : 'Song not found in library.'}
                    showControls={index === 0}
                  />
                </div>
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
