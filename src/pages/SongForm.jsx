import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { KEYS, SECTION_TYPES } from '../utils/constants';
import { getSongById, saveSong } from '../utils/storage';
import { useOffline } from '../hooks/useOffline';
import { useToast } from '../hooks/useToast';

const blankSong = {
  title: '',
  artist: '',
  originalKey: 'C',
  selectedKey: 'C',
  tempo: '',
  category: 'Worship',
  language: 'Filipino',
  youtubeLink: '',
  chordChart: '',
  lyricsMonitor: [],
  notes: '',
};

export default function SongForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState(blankSong);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isOffline = useOffline();
  const { showToast } = useToast();

  useEffect(() => {
    async function loadSong() {
      try {
        if (id) {
          const existing = await getSongById(id);
          setSong(existing || blankSong);
        }
      } catch (error) {
        console.error("Failed to load songs:", error);
        setError('Unable to load this song. Please try again.');
        setSong(blankSong);
      } finally {
        setLoading(false);
      }
    }
    loadSong();
  }, [id]);

  const update = (field, value) => setSong((current) => ({ ...current, [field]: value }));
  const updateSection = (index, field, value) => {
    update('lyricsMonitor', song.lyricsMonitor.map((section, itemIndex) => (itemIndex === index ? { ...section, [field]: value } : section)));
  };

  const addSection = () => {
    update('lyricsMonitor', [...song.lyricsMonitor, { section: 'Verse 1', text: '', vocalNotes: '', repeatCount: '' }]);
  };

  const removeSection = (index) => {
    update('lyricsMonitor', song.lyricsMonitor.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const saved = await saveSong(song);
      if (!saved?.id) throw new Error('Song was not saved.');
      showToast(`Song "${song.title}" saved successfully!`, 'success');
      navigate('/songs');
    } catch (error) {
      console.error("Failed to save song:", error);
      const msg = error.message || 'Unable to save this song. Please try again.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="page-shell">
        <p className="text-slate-600">Loading...</p>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <PageHeader eyebrow={id ? 'Edit Song' : 'Add Song'} title={id ? `Update ${song.title}` : 'Add New Song'} />

      <form className="grid gap-6 lg:grid-cols-[1fr_0.75fr]" onSubmit={handleSubmit}>
        <section className="panel space-y-5">
          {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">Song Title *</span>
              <input className="input" required value={song.title} onChange={(event) => update('title', event.target.value)} />
            </label>
            <label>
              <span className="label">Artist / Composer</span>
              <input className="input" value={song.artist} onChange={(event) => update('artist', event.target.value)} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <label>
              <span className="label">Original Key</span>
              <select className="input" value={song.originalKey} onChange={(event) => update('originalKey', event.target.value)}>
                {KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Selected Key</span>
              <select className="input" value={song.selectedKey} onChange={(event) => update('selectedKey', event.target.value)}>
                {KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
              </select>
            </label>
            <label>
              <span className="label">BPM</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min="1"
                value={song.tempo}
                onChange={(event) => update('tempo', event.target.value)}
                placeholder="72"
              />
            </label>
            <label>
              <span className="label">Language</span>
              <input className="input" value={song.language} onChange={(event) => update('language', event.target.value)} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">Category</span>
              <input className="input" value={song.category} onChange={(event) => update('category', event.target.value)} />
            </label>

            <label>
              <span className="label">YouTube Reference Link</span>
              <input className="input" type="url" placeholder="https://youtube.com/watch?v=..." value={song.youtubeLink} onChange={(event) => update('youtubeLink', event.target.value)} />
            </label>
          </div>

          <label>
            <span className="label">Chord Chart</span>
            <textarea className="textarea min-h-72 font-mono" value={song.chordChart} onChange={(event) => update('chordChart', event.target.value)} placeholder={'Intro:\nC  G  Am  F\n\nVerse 1:\n[Team-approved chord chart here]'} />
          </label>

          <label>
            <span className="label">Arrangement Notes</span>
            <textarea className="textarea" value={song.notes} onChange={(event) => update('notes', event.target.value)} />
          </label>
        </section>

        <aside className="panel h-fit space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">Lyrics Monitor</h2>
              <p className="text-sm text-slate-600">Use team-approved lyrics, cue text, or placeholders.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={addSection}>
              <Plus size={16} aria-hidden="true" /> Section
            </button>
          </div>

          <div className="space-y-4">
            {song.lyricsMonitor.map((section, index) => (
              <div key={index} className="rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-inner">
                <div className="mb-3 flex items-center gap-2">
                  <select className="input" value={section.section} onChange={(event) => updateSection(index, 'section', event.target.value)}>
                    {SECTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <button className="icon-button" type="button" onClick={() => removeSection(index)} title="Remove section">
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
                <textarea className="textarea" value={section.text} onChange={(event) => updateSection(index, 'text', event.target.value)} placeholder="Cue text or permitted lyrics" />
                <input className="input mt-3" value={section.vocalNotes || ''} onChange={(event) => updateSection(index, 'vocalNotes', event.target.value)} placeholder="Vocal notes" />
                <input className="input mt-3" value={section.repeatCount || ''} onChange={(event) => updateSection(index, 'repeatCount', event.target.value)} placeholder="Repeat count" />
              </div>
            ))}
          </div>

          <button className="btn-primary w-full justify-center" type="submit" disabled={saving || isOffline}>
            {isOffline ? 'Editing requires internet connection' : saving ? 'Saving...' : id ? 'Update Song' : 'Save Song'}
          </button>
        </aside>
      </form>
    </main>
  );
}
