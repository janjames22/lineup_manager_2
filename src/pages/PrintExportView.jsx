import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ChordChartViewer from '../components/ChordChartViewer';
import TeamAssignments from '../components/TeamAssignments';
import { getLineupById, getSongs } from '../utils/storage';
import { getSemitoneDelta, transposeChords } from '../utils/transposeChords';

export default function PrintExportView() {
  const { id } = useParams();
  const [lineup, setLineup] = useState(null);
  const [songsMap, setSongsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const lineupData = await getLineupById(id);
        if (!lineupData) throw new Error('Lineup not found.');
        setLineup(lineupData);
        
        if (lineupData?.songs?.length) {
          const allSongs = await getSongs();
          const map = {};
          (Array.isArray(allSongs) ? allSongs : []).forEach(s => map[s.id] = s);
          setSongsMap(map);
        }
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
      <main className="page-shell print-sheet">
        <p className="text-slate-600">Loading...</p>
      </main>
    );
  }

  if (!lineup) {
    return (
      <main className="page-shell print-sheet">
        <p className="text-slate-600">Lineup not found.</p>
        {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
        <Link className="btn-primary mt-4" to="/lineups">Back to Lineups</Link>
      </main>
    );
  }

  return (
    <main className="print-sheet mx-auto w-full max-w-5xl bg-white px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap gap-2 print:hidden">
        <Link className="btn-secondary" to={`/lineups/${lineup.id}`}><ArrowLeft size={18} aria-hidden="true" /> Back</Link>
        <button className="btn-primary" type="button" onClick={() => window.print()}><Printer size={18} aria-hidden="true" /> Print / Export</button>
      </div>

      <header className="print-block print-divider border-b border-slate-300 pb-5">
        <p className="print-accent text-sm font-semibold text-blue-700">Sunday Lineup</p>
        <h1 className="text-3xl font-bold text-slate-950">{lineup.date} • {lineup.serviceTime}</h1>
        <p className="print-muted mt-2 text-slate-700">Worship Leader: {lineup.worshipLeader || 'TBD'}</p>
      </header>

      <section className="mt-6">
        <h2 className="print-accent text-2xl font-bold tracking-tight text-slate-950">Song Lineup</h2>
        <div className="mt-4 space-y-6">
          {lineup.songs.map((lineupSong, index) => {
            const song = songsMap[lineupSong.id || lineupSong.songId];
            const delta = song ? getSemitoneDelta(song.originalKey, lineupSong.selectedKey) : 0;
            return (
              <article key={`${lineupSong.id || lineupSong.songId}-${index}`} className="print-item print-divider break-inside-avoid border-b border-slate-200 pb-6">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <h3 className="break-words text-xl font-bold text-slate-950">{index + 1}. {lineupSong.title}</h3>
                    {lineupSong.notes && <p className="print-muted mt-1 text-sm text-slate-700">{lineupSong.notes}</p>}
                  </div>
                  <span className="print-accent shrink-0 font-bold text-blue-700">Key: {lineupSong.selectedKey}</span>
                </div>
                <ChordChartViewer
                  className="mt-3"
                  preClassName="print-chord-chart !min-h-0 !rounded !border-slate-200 !bg-slate-50 !p-4 !text-slate-900"
                  chordChart={song ? transposeChords(song.chordChart, delta) : ''}
                  emptyText={song ? 'No chord chart added.' : 'Song not found in library.'}
                  showControls={index === 0}
                />
                {song?.lyricsMonitor?.length > 0 && (
                  <div className="print-card mt-3 rounded border border-slate-200 p-3">
                    <p className="print-accent mb-2 text-sm font-semibold text-slate-700">Lyrics Monitor Cues</p>
                    {song.lyricsMonitor.map((cue, cueIndex) => (
                      <p key={`${cue.section}-${cueIndex}`} className="print-muted text-sm text-slate-700">
                        <strong>{cue.section}:</strong> {cue.text || 'No cue text.'}
                      </p>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-8 break-inside-avoid">
        <h2 className="print-accent text-2xl font-bold tracking-tight text-slate-950">Team Assignments</h2>
        <div className="mt-4">
          <TeamAssignments musicians={lineup.musicians} readOnly />
        </div>
      </section>

      {lineup.generalNotes && (
        <section className="mt-8 break-inside-avoid">
          <h2 className="print-accent text-2xl font-bold tracking-tight text-slate-950">General Reminders</h2>
          <p className="print-muted mt-2 whitespace-pre-wrap text-slate-700">{lineup.generalNotes}</p>
        </section>
      )}
    </main>
  );
}
