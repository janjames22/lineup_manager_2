import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import SearchableSongPicker from '../components/SearchableSongPicker';
import TeamAssignments from '../components/TeamAssignments';
import { KEYS, emptyMusicians } from '../utils/constants';
import { getLineupById, getSongs, saveLineup } from '../utils/storage';
import { useOffline } from '../hooks/useOffline';
import { useToast } from '../hooks/useToast';

function nextSunday() {
  const date = new Date();
  const days = (7 - date.getDay()) || 7;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const blankLineup = {
  date: nextSunday(),
  serviceTime: '9:00 AM',
  worshipLeader: '',
  songs: [],
  musicians: emptyMusicians(),
  generalNotes: '',
};

export default function LineupForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [songs, setSongs] = useState([]);
  const [lineup, setLineup] = useState(blankLineup);
  const [selectedSongId, setSelectedSongId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isOffline = useOffline();
  const { showToast } = useToast();

  useEffect(() => {
    async function loadData() {
      try {
        setError('');
        const [songsData, lineupData] = await Promise.all([
          getSongs(),
          id ? getLineupById(id) : null
        ]);
        setSongs(Array.isArray(songsData) ? songsData : []);
        if (id && !lineupData) {
          throw new Error('Lineup not found.');
        }
        setLineup(lineupData || blankLineup);
      } catch (error) {
        console.error('Failed to load lineup:', error);
        setError('Unable to load this lineup. Please try again.');
        setSongs([]);
        setLineup(blankLineup);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const update = (field, value) => setLineup((current) => ({ ...current, [field]: value }));
  const updateLineupSong = (index, field, value) => update('songs', lineup.songs.map((song, itemIndex) => (itemIndex === index ? { ...song, [field]: value } : song)));

  const addSong = () => {
    const song = songs.find((item) => item.id === selectedSongId);
    if (!song || lineup.songs.some((item) => (item.id || item.songId) === song.id)) return;

    const selectedSongs = [
      ...lineup.songs,
      {
        id: song.id,
        songId: song.id,
        title: song.title,
        artist: song.artist || '',
        originalKey: song.originalKey || 'C',
        selectedKey: song.selectedKey || song.originalKey,
        order: lineup.songs.length + 1,
        orderIndex: lineup.songs.length,
        notes: '',
      },
    ];
    update('songs', selectedSongs);
    setSelectedSongId('');
  };

  const removeSong = (index) => {
    const selectedSongs = lineup.songs
      .filter((_, itemIndex) => itemIndex !== index)
      .map((song, itemIndex) => ({ ...song, order: itemIndex + 1, orderIndex: itemIndex }));
    update('songs', selectedSongs);
  };

  const moveSong = (index, delta) => {
    const nextSongs = [...lineup.songs];
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= nextSongs.length) return;
    [nextSongs[index], nextSongs[nextIndex]] = [nextSongs[nextIndex], nextSongs[index]];
    const selectedSongs = nextSongs.map((song, itemIndex) => ({ ...song, order: itemIndex + 1, orderIndex: itemIndex }));
    update('songs', selectedSongs);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const saved = await saveLineup(lineup);
      if (!saved?.id) throw new Error('Lineup was not saved.');
      const pushSent = saved.pushResult?.successCount ?? saved.pushResult?.sent ?? null;
      if (typeof pushSent === 'number') {
        showToast(`Lineup saved. Notification sent to ${pushSent} device${pushSent === 1 ? '' : 's'}.`, 'success');
      } else if (saved.pushError) {
        showToast('Lineup saved, but push notification failed.', 'error');
      } else {
        showToast(`Lineup for ${lineup.date} saved!`, 'success');
      }
      navigate(`/lineups/${saved.id}`);
    } catch (error) {
      console.error("Save lineup error:", error);
      const msg = error.message || 'Unable to save this lineup. Please try again.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedSongIds = useMemo(
    () => new Set(lineup.songs.map((song) => song.id || song.songId).filter(Boolean)),
    [lineup.songs]
  );
  const availableSongs = useMemo(
    () => songs.filter((song) => !selectedSongIds.has(song.id)),
    [selectedSongIds, songs]
  );

  if (loading) {
    return (
      <main className="page-shell">
        <p className="text-slate-600">Loading...</p>
      </main>
    );
  }

  return (
    <main className="page-shell lineup-page">
      <div className="mx-auto w-full max-w-6xl min-w-0">
        <PageHeader eyebrow={id ? 'Edit Lineup' : 'Create Lineup'} title={id ? 'Update Sunday Lineup' : 'Create Sunday Lineup'} />
        <form className="w-full min-w-0 space-y-5 sm:space-y-6" onSubmit={save}>
          {error && <p className="text-sm font-semibold text-red-400">{error}</p>}
          <section className="panel">
            <h2 className="section-title">Service Details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <label><span className="label">Date *</span><input className="input" type="date" required value={lineup.date} onChange={(event) => update('date', event.target.value)} /></label>
              <label><span className="label">Service Time</span><input className="input" value={lineup.serviceTime} onChange={(event) => update('serviceTime', event.target.value)} /></label>
              <label><span className="label">Worship Leader</span><input className="input" value={lineup.worshipLeader} onChange={(event) => update('worshipLeader', event.target.value)} /></label>
            </div>
          </section>

          <section className="panel">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="section-title">Song Order</h2>
                <p className="mt-1 text-sm font-medium text-slate-400">Search by title, choose a key, then add it to the plan.</p>
              </div>
              <span className="inline-flex w-fit shrink-0 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-blue-200">{lineup.songs.length} selected</span>
            </div>
            <div className="mt-4 grid w-full min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(7rem,auto)] sm:items-stretch">
              <SearchableSongPicker
                emptyMessage={songs.length ? 'All songs are already in this lineup.' : 'No songs available yet.'}
                noResultsMessage="No songs match that title."
                onChange={setSelectedSongId}
                songs={availableSongs}
                value={selectedSongId}
              />
              <button className="btn-primary h-full w-full sm:w-auto sm:min-w-28" disabled={!selectedSongId} type="button" onClick={addSong}>
                <Plus size={18} aria-hidden="true" /> Add
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {lineup.songs.map((song, index) => (
                <div key={`${song.id || song.songId}-${index}`} className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/80 p-3 shadow-inner sm:p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="lineup-song-number shrink-0">{index + 1}</span>
                      <h3 className="text-wrap-anywhere min-w-0 font-bold text-white">{song.title}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="icon-button" type="button" onClick={() => moveSong(index, -1)} aria-label="Move song up"><ArrowUp size={18} aria-hidden="true" /></button>
                      <button className="icon-button" type="button" onClick={() => moveSong(index, 1)} aria-label="Move song down"><ArrowDown size={18} aria-hidden="true" /></button>
                      <button className="icon-button danger" type="button" onClick={() => removeSong(index)} aria-label="Remove song"><Trash2 size={18} aria-hidden="true" /></button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-[0.4fr_1fr]">
                    <select className="input border-amber-800/30 bg-amber-950/10 text-amber-300 focus:border-amber-500/40" value={song.selectedKey} onChange={(event) => updateLineupSong(index, 'selectedKey', event.target.value)}>
                      {KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
                    </select>
                    <input className="input" value={song.notes} onChange={(event) => updateLineupSong(index, 'notes', event.target.value)} placeholder="Song notes" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2 className="section-title">Team Assignments</h2>
            <div className="mt-4">
              <TeamAssignments musicians={lineup.musicians} onChange={(key, value) => update('musicians', { ...lineup.musicians, [key]: value })} />
            </div>
          </section>

          <section className="panel">
            <label><span className="label">General Reminders</span><textarea className="textarea" value={lineup.generalNotes} onChange={(event) => update('generalNotes', event.target.value)} /></label>
          </section>

          <button className="btn-primary w-full sm:w-auto" type="submit" disabled={saving || isOffline}>
            {isOffline ? 'Editing requires internet connection' : saving ? 'Saving...' : id ? 'Update Lineup' : 'Save Lineup'}
          </button>
        </form>
      </div>
    </main>
  );
}
