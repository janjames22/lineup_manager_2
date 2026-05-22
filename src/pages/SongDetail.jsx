import { ArrowLeft, Monitor, Pencil, Trash2, Youtube } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import LoadingScreen from '../components/LoadingScreen';
import ChordChartViewer from '../components/ChordChartViewer';
import OfflineItemButton from '../components/OfflineItemButton';
import { formatBpm } from '../utils/constants';
import { deleteSong, getSongById } from '../utils/storage';
import { sendSongPushNotification } from '../utils/pushNotifications';
import { useToast } from '../hooks/useToast';
import { useDispatchLocalNotification } from '../contexts/NotificationsContext';
import { useOfflineItems } from '../hooks/useOfflineItems';
import { getTransposedKey, transposeChords } from '../utils/transposeChords';

export default function SongDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromSource = searchParams.get('from');
  const lineupId = searchParams.get('lineupId');
  const [song, setSong] = useState(null);
  const [transposeAmount, setTransposeAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const dispatchLocalNotification = useDispatchLocalNotification();
  const offlineSongs = useOfflineItems('song');

  useEffect(() => {
    async function loadSong() {
      try {
        const data = await getSongById(id);
        setSong(data);
      } catch (error) {
        console.error("Failed to load songs:", error);
        setSong(null);
      } finally {
        setLoading(false);
      }
    }
    loadSong();
  }, [id]);

  if (loading) return <LoadingScreen />;

  if (!song) {
    return (
      <main className="page-shell">
        <p className="text-slate-600">Song not found.</p>
        <Link className="btn-primary mt-4" to="/songs"><ArrowLeft size={18} aria-hidden="true" /> Back to Songs</Link>
      </main>
    );
  }

  const currentKey = getTransposedKey(song.originalKey, transposeAmount);
  const transposedChart = transposeChords(song.chordChart, transposeAmount);

  const remove = async () => {
    if (window.confirm(`Are you sure you want to delete "${song.title}"?`)) {
      try {
        sendSongPushNotification(song, { eventType: 'DELETE' }).catch(console.error);
        await deleteSong(song.id);
        dispatchLocalNotification?.({
          type: 'song_deleted',
          title: `Song removed: ${song.title}`,
          songId: song.id,
          url: '/songs',
          id: `local-song-deleted-${song.id}-${Date.now()}`,
        });
        showToast(`Song "${song.title}" deleted`, 'info');
        navigate('/songs');
      } catch {
        showToast('Failed to delete song', 'error');
      }
    }
  };

  return (
    <main className="page-shell song-detail-page">
      <PageHeader
        eyebrow="Song Detail"
        title={song.title}
        description={song.artist || 'No artist listed'}
        actions={
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
            {fromSource === 'lineup' && lineupId && (
              <Link className="btn-secondary col-span-2" to={`/lineups/${lineupId}`}>
                <ArrowLeft size={18} aria-hidden="true" /> Return to Lineup
              </Link>
            )}
            <Link className="btn-secondary" to="/songs"><ArrowLeft size={18} aria-hidden="true" /> Songs</Link>
            {song.youtubeLink && (
              <a className="btn-secondary text-red-400 hover:border-red-900/50 hover:bg-red-950/30" href={song.youtubeLink} target="_blank" rel="noopener noreferrer">
                <Youtube size={18} aria-hidden="true" /> YouTube
              </a>
            )}
            <Link className="btn-secondary" to={`/lyrics-monitor/${song.id}`}><Monitor size={18} aria-hidden="true" /> Monitor</Link>
            <Link className="btn-secondary" to={`/songs/${song.id}/edit`}><Pencil size={18} aria-hidden="true" /> Edit</Link>
            <button className="btn-danger" type="button" onClick={remove}><Trash2 size={18} aria-hidden="true" /> Delete</button>
            <OfflineItemButton item={song} offline={offlineSongs} type="song" />
          </div>
        }
      />

      <section className="panel mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Info label="Original Key" value={song.originalKey} />
          <Info label="Current Key" value={currentKey} highlight />
          <Info label="BPM" value={formatBpm(song.tempo)} />
          <Info label="Category" value={song.category || '-'} />
          <Info label="Language" value={song.language || '-'} />
        </div>
        <div className="control-row mt-6 border-t border-slate-800/50 pt-6">
          <button className="btn-secondary min-w-10 flex-1 !text-xl min-[380px]:flex-none" type="button" onClick={() => setTransposeAmount((value) => Math.max(-12, value - 1))}>-</button>
          <div className="flex min-w-24 flex-1 flex-col items-center justify-center rounded-xl bg-slate-950 p-3 ring-1 ring-blue-500/20 shadow-inner min-[380px]:flex-none sm:min-w-32">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Transpose</span>
            <span className="text-xl font-black text-white">{transposeAmount > 0 ? `+${transposeAmount}` : transposeAmount}</span>
          </div>
          <button className="btn-secondary min-w-10 flex-1 !text-xl min-[380px]:flex-none" type="button" onClick={() => setTransposeAmount((value) => Math.min(12, value + 1))}>+</button>
          <button className="btn-secondary flex-1 basis-full font-black uppercase tracking-wider text-xs min-[380px]:basis-auto" type="button" onClick={() => setTransposeAmount(0)}>Reset</button>
        </div>
      </section>

      <section className="grid w-full min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)]">
        <div className="panel w-full">
          <h2 className="section-title">Chord Chart</h2>
          <ChordChartViewer
            className="mt-5"
            preClassName="!bg-slate-950/80"
            chordChart={transposedChart}
            emptyText="No chord chart added yet."
          />
        </div>
        <aside className="space-y-6">
          <div className="panel">
            <h2 className="section-title">Lyrics Monitor Cues</h2>
            <div className="mt-5 space-y-4">
              {song.lyricsMonitor.length ? song.lyricsMonitor.map((section, index) => (
                <div key={`${section.section}-${index}`} className="rounded-2xl bg-slate-950/40 p-5 border border-t-2 border-slate-800/50 border-t-blue-500/25">
                  <p className="text-xs font-black uppercase tracking-widest text-blue-400">{section.section}</p>
                  <p className="mt-2.5 whitespace-pre-wrap break-words text-base font-medium text-slate-200">{section.text || 'No cue text.'}</p>
                  {section.vocalNotes && <p className="mt-3 text-sm font-bold text-blue-300 flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-blue-500"></span>
                    {section.vocalNotes}
                  </p>}
                </div>
              )) : <p className="text-sm font-bold text-slate-500">No lyrics monitor sections added.</p>}
            </div>
          </div>
          {song.notes && (
            <div className="panel">
              <h2 className="section-title">Arrangement Notes</h2>
              <p className="mt-4 whitespace-pre-wrap text-slate-300 font-medium leading-relaxed">{song.notes}</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function Info({ label, value, highlight = false }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight
      ? 'border-blue-500/30 bg-blue-950/20 shadow-[inset_0_1px_0_rgba(96,165,250,0.08)]'
      : 'border-slate-800/50 bg-slate-950/30'
    }`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-black ${highlight ? 'text-blue-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}
