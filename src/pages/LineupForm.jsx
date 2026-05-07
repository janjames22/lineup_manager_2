import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
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
    console.log("Selected lineup songs:", selectedSongs);
    update('songs', selectedSongs);
    setSelectedSongId('');
  };

  const removeSong = (index) => {
    const selectedSongs = lineup.songs
      .filter((_, itemIndex) => itemIndex !== index)
      .map((song, itemIndex) => ({ ...song, order: itemIndex + 1, orderIndex: itemIndex }));
    console.log("Selected lineup songs:", selectedSongs);
    update('songs', selectedSongs);
  };

  const moveSong = (index, delta) => {
    const nextSongs = [...lineup.songs];
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= nextSongs.length) return;
    [nextSongs[index], nextSongs[nextIndex]] = [nextSongs[nextIndex], nextSongs[index]];
    const selectedSongs = nextSongs.map((song, itemIndex) => ({ ...song, order: itemIndex + 1, orderIndex: itemIndex }));
    console.log("Selected lineup songs:", selectedSongs);
    update('songs', selectedSongs);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const selectedSongs = lineup.songs;
      console.log("Selected lineup songs:", selectedSongs);
      const saved = await saveLineup(lineup);
      if (!saved?.id) throw new Error('Lineup was not saved.');
      showToast(`Lineup for ${lineup.date} saved!`, 'success');
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

  const availableSongs = songs.filter((song) => !lineup.songs.some((item) => (item.id || item.songId) === song.id));

  if (loading) {
    return (
      <main className="page-shell">
        <p className="text-slate-600">Loading...</p>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <PageHeader eyebrow={id ? 'Edit Lineup' : 'Create Lineup'} title={id ? 'Update Sunday Lineup' : 'Create Sunday Lineup'} />
      <form className="space-y-6" onSubmit={save}>
        {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
        <section className="panel">
          <h2 className="section-title">Service Details</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label><span className="label">Date *</span><input className="input" type="date" required value={lineup.date} onChange={(event) => update('date', event.target.value)} /></label>
            <label><span className="label">Service Time</span><input className="input" value={lineup.serviceTime} onChange={(event) => update('serviceTime', event.target.value)} /></label>
            <label><span className="label">Worship Leader</span><input className="input" value={lineup.worshipLeader} onChange={(event) => update('worshipLeader', event.target.value)} /></label>
          </div>
        </section>

        <section className="panel">
          <h2 className="section-title">Song Order</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <select className="input" value={selectedSongId} onChange={(event) => setSelectedSongId(event.target.value)}>
              <option value="">Select a song</option>
              {availableSongs.map((song) => <option key={song.id} value={song.id}>{song.title} - {song.originalKey}</option>)}
            </select>
            <button className="btn-secondary" type="button" onClick={addSong}><Plus size={18} aria-hidden="true" /> Add</button>
          </div>

          <div className="mt-5 space-y-3">
            {lineup.songs.map((song, index) => (
              <div key={`${song.id || song.songId}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-inner">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <h3 className="font-bold text-white">{index + 1}. {song.title}</h3>
                  <div className="flex flex-wrap gap-2">
                    <button className="icon-button" type="button" onClick={() => moveSong(index, -1)} title="Move up"><ArrowUp size={18} aria-hidden="true" /></button>
                    <button className="icon-button" type="button" onClick={() => moveSong(index, 1)} title="Move down"><ArrowDown size={18} aria-hidden="true" /></button>
                    <button className="icon-button danger" type="button" onClick={() => removeSong(index)} title="Remove song"><Trash2 size={18} aria-hidden="true" /></button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[0.4fr_1fr]">
                  <select className="input" value={song.selectedKey} onChange={(event) => updateLineupSong(index, 'selectedKey', event.target.value)}>
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

        <button className="btn-primary" type="submit" disabled={saving || isOffline}>
          {isOffline ? 'Editing requires internet connection' : saving ? 'Saving...' : id ? 'Update Lineup' : 'Save Lineup'}
        </button>
      </form>
    </main>
  );
}
