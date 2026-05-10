import { Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useBeforeUnload, useBlocker, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { KEYS, SECTION_TYPES } from '../utils/constants';
import { getSongById, normalizeLyricsMonitor, saveSong } from '../utils/storage';
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

const createBlankLyricsSection = () => ({
  section: 'Verse 1',
  text: '',
  vocalNotes: '',
  repeatCount: '',
  theme: '',
});

const toSafeText = (value, fallback = '') => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const sanitizeSongForForm = (song = {}) => ({
  ...blankSong,
  ...song,
  title: toSafeText(song.title, ''),
  artist: toSafeText(song.artist, ''),
  originalKey: toSafeText(song.originalKey, blankSong.originalKey) || blankSong.originalKey,
  selectedKey: toSafeText(song.selectedKey, song.originalKey || blankSong.selectedKey) || toSafeText(song.originalKey, blankSong.selectedKey) || blankSong.selectedKey,
  tempo: toSafeText(song.tempo, ''),
  category: toSafeText(song.category, blankSong.category) || blankSong.category,
  language: toSafeText(song.language, blankSong.language) || blankSong.language,
  youtubeLink: toSafeText(song.youtubeLink, ''),
  chordChart: toSafeText(song.chordChart, ''),
  lyricsMonitor: normalizeLyricsMonitor(song.lyricsMonitor),
  notes: toSafeText(song.notes, ''),
});

const buildSongSnapshot = (song = {}) => JSON.stringify({
  title: typeof song.title === 'string' ? song.title : String(song.title ?? ''),
  artist: typeof song.artist === 'string' ? song.artist : String(song.artist ?? ''),
  originalKey: typeof song.originalKey === 'string' ? song.originalKey : 'C',
  selectedKey: typeof song.selectedKey === 'string' ? song.selectedKey : 'C',
  tempo: typeof song.tempo === 'string' ? song.tempo : String(song.tempo ?? ''),
  category: typeof song.category === 'string' ? song.category : '',
  language: typeof song.language === 'string' ? song.language : '',
  youtubeLink: typeof song.youtubeLink === 'string' ? song.youtubeLink : '',
  chordChart: typeof song.chordChart === 'string' ? song.chordChart : String(song.chordChart ?? ''),
  lyricsMonitor: normalizeLyricsMonitor(song.lyricsMonitor),
  notes: typeof song.notes === 'string' ? song.notes : String(song.notes ?? ''),
});

const normalizeSectionName = (name = '') =>
  String(name).toLowerCase().replace(/[^a-z0-9]+/g, '');

const getChordChartTextForSection = (chordChart = '', sectionName = '') => {
  const chart = String(chordChart ?? '').trim();
  if (!chart) return '';

  const requested = normalizeSectionName(sectionName);
  const blocks = [];
  let currentBlock = null;

  chart.split(/\r?\n/).forEach((line) => {
    const headerMatch = line.match(/^\s*(?:\[([^\]]+)\]|([A-Za-z][A-Za-z\s-]*(?:\s\d+)?))\s*[:：]\s*$/);

    if (headerMatch) {
      currentBlock = {
        section: (headerMatch[1] || headerMatch[2]).trim(),
        lines: [],
      };
      blocks.push(currentBlock);
      return;
    }

    if (currentBlock) currentBlock.lines.push(line);
  });

  const matchedBlock = blocks.find((block) => normalizeSectionName(block.section) === requested);
  const matchedText = matchedBlock?.lines.join('\n').trim();

  return matchedText || chart;
};

export default function SongForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState(blankSong);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [baselineSnapshot, setBaselineSnapshot] = useState(buildSongSnapshot(blankSong));
  const [saveStatus, setSaveStatus] = useState('idle');
  const isOffline = useOffline();
  const { showToast } = useToast();
  const hasUnsavedChanges = !loading && buildSongSnapshot(song) !== baselineSnapshot;
  const blocker = useBlocker(hasUnsavedChanges);
  const lyricsSections = normalizeLyricsMonitor(song.lyricsMonitor);

  useEffect(() => {
    async function loadSong() {
      try {
        if (id) {
          const existing = await getSongById(id);
          const nextSong = sanitizeSongForForm(existing || blankSong);
          setSong(nextSong);
          setBaselineSnapshot(buildSongSnapshot(nextSong));
        } else {
          const nextSong = sanitizeSongForForm(blankSong);
          setSong(nextSong);
          setBaselineSnapshot(buildSongSnapshot(nextSong));
        }
        setSaveStatus('idle');
      } catch (error) {
        console.error("Failed to load songs:", error);
        setError('Unable to load this song. Please try again.');
        setSong(blankSong);
        setBaselineSnapshot(buildSongSnapshot(blankSong));
        setSaveStatus('error');
      } finally {
        setLoading(false);
      }
    }
    loadSong();
  }, [id]);

  useBeforeUnload((event) => {
    if (!hasUnsavedChanges) return;
    event.preventDefault();
    event.returnValue = '';
  });

  useEffect(() => {
    if (blocker.state !== 'blocked') return;

    const shouldLeave = window.confirm('You have unsaved changes. Leave this page anyway?');
    if (shouldLeave) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  const markUnsaved = () => {
    setError('');
    setSaveStatus('unsaved');
  };

  const update = (field, value) => {
    setSong((current) => ({ ...current, [field]: value }));
    markUnsaved();
  };

  const updateSection = (index, field, value) => {
    setSong((current) => ({
      ...sanitizeSongForForm(current),
      lyricsMonitor: normalizeLyricsMonitor(current.lyricsMonitor).map((section, itemIndex) => (
        itemIndex === index ? { ...section, [field]: value } : section
      )),
    }));
    markUnsaved();
  };

  const addSection = () => {
    update('lyricsMonitor', [...lyricsSections, createBlankLyricsSection()]);
  };

  const addSectionBelow = (index) => {
    setSong((current) => {
      const nextLyricsMonitor = [...normalizeLyricsMonitor(current.lyricsMonitor)];
      nextLyricsMonitor.splice(index + 1, 0, createBlankLyricsSection());
      return sanitizeSongForForm({ ...current, lyricsMonitor: nextLyricsMonitor });
    });
    markUnsaved();
  };

  const handleSectionTypeChange = (index, value) => {
    const currentSectionName = lyricsSections[index]?.section || '';
    updateSection(index, 'section', value === 'Custom' && !SECTION_TYPES.includes(currentSectionName) ? currentSectionName : value);
  };

  const handleContentSourceChange = (index, value) => {
    if (!value) return;

    if (value === 'blank') {
      updateSection(index, 'text', '');
      return;
    }

    if (value === 'chordChart') {
      updateSection(index, 'text', getChordChartTextForSection(song.chordChart, lyricsSections[index]?.section));
      return;
    }

    if (value.startsWith('section:')) {
      const sourceIndex = Number(value.replace('section:', ''));
      updateSection(index, 'text', lyricsSections[sourceIndex]?.text || '');
    }
  };

  const duplicateSection = (index) => {
    setSong((current) => {
      const nextLyricsMonitor = [...normalizeLyricsMonitor(current.lyricsMonitor)];
      const sectionToDuplicate = nextLyricsMonitor[index] || createBlankLyricsSection();
      nextLyricsMonitor.splice(index + 1, 0, { ...sectionToDuplicate });
      return sanitizeSongForForm({ ...current, lyricsMonitor: nextLyricsMonitor });
    });
    markUnsaved();
  };

  const removeSection = (index) => {
    const sectionName = lyricsSections[index]?.section || 'this section';
    if (!window.confirm(`Delete "${sectionName}" from Lyrics Monitor?`)) return;

    update('lyricsMonitor', lyricsSections.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaveStatus('saving');

    try {
      const saved = await saveSong(song);
      if (!saved?.id) throw new Error('Song was not saved.');
      const normalizedSavedSong = sanitizeSongForForm(saved);
      setSong(normalizedSavedSong);
      setBaselineSnapshot(buildSongSnapshot(normalizedSavedSong));
      setSaveStatus('saved');
      showToast(`Song "${song.title}" saved successfully!`, 'success');
      if (!id && normalizedSavedSong.id) navigate(`/songs/${normalizedSavedSong.id}/edit`, { replace: true });
    } catch (error) {
      console.error("Failed to save song:", error);
      const msg = error.message || 'Unable to save this song. Please try again.';
      setError(msg);
      setSaveStatus('error');
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveStatusConfig = {
    unsaved: {
      label: 'Unsaved changes',
      classes: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    },
    saving: {
      label: 'Saving...',
      classes: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
    },
    saved: {
      label: 'Saved successfully',
      classes: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    },
    error: {
      label: 'Error saving',
      classes: 'border-red-500/30 bg-red-500/10 text-red-200',
    },
  }[saveStatus];

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
            <textarea className="textarea min-h-[18rem] font-mono sm:min-h-72" value={song.chordChart || ''} onChange={(event) => update('chordChart', event.target.value)} placeholder={'Intro:\nC  G  Am  F\n\nVerse 1:\n[Team-approved chord chart here]'} />
          </label>

          <label>
            <span className="label">Arrangement Notes</span>
            <textarea className="textarea min-h-36" value={song.notes} onChange={(event) => update('notes', event.target.value)} />
          </label>
        </section>

        <aside className="panel h-fit space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="section-title">Lyrics Monitor</h2>
              <p className="text-sm text-slate-600">Use team-approved lyrics, cue text, or placeholders.</p>
            </div>
            <button type="button" className="btn-secondary w-full sm:w-auto" onClick={addSection}>
              <Plus size={16} aria-hidden="true" /> Add Section
            </button>
          </div>

          <div className="space-y-4">
            {lyricsSections.map((section, index) => {
              const sectionName = typeof section?.section === 'string' ? section.section : '';
              const sectionTypeValue = SECTION_TYPES.includes(sectionName) ? sectionName : 'Custom';
              const existingSections = lyricsSections
                .map((item, itemIndex) => ({ ...item, itemIndex }))
                .filter((item) => item.itemIndex !== index);

              return (
                <div key={index} className="rounded-xl border border-slate-800 bg-slate-950 p-3 shadow-inner sm:p-4">
                  <div className="mb-3 grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label>
                        <span className="label">Section Type</span>
                        <select className="input" value={sectionTypeValue} onChange={(event) => handleSectionTypeChange(index, event.target.value)}>
                          {SECTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </label>
                      <label>
                        <span className="label">Content Source</span>
                        <select className="input" value="" onChange={(event) => handleContentSourceChange(index, event.target.value)}>
                          <option value="" disabled>Choose source</option>
                          <option value="blank">Blank section</option>
                          <option value="chordChart">Copy from Chord Chart</option>
                          {existingSections.length > 0 ? (
                            <optgroup label="Copy from existing Lyrics Monitor sections">
                              {existingSections.map((item) => (
                                <option key={item.itemIndex} value={`section:${item.itemIndex}`}>
                                  {item.section || `Section ${item.itemIndex + 1}`}
                                </option>
                              ))}
                            </optgroup>
                          ) : (
                            <option value="existing-empty" disabled>Copy from existing Lyrics Monitor sections</option>
                          )}
                        </select>
                      </label>
                    </div>

                    {sectionTypeValue === 'Custom' && (
                      <label>
                        <span className="label">Custom Section Name</span>
                        <input
                          className="input"
                          value={sectionName === 'Custom' ? '' : sectionName}
                          onChange={(event) => updateSection(index, 'section', event.target.value)}
                          placeholder="Enter section name"
                        />
                      </label>
                    )}

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <button className="btn-secondary w-full !px-3" type="button" onClick={() => duplicateSection(index)}>
                        <Copy size={16} aria-hidden="true" /> Duplicate
                      </button>
                      <button className="btn-danger w-full !px-3" type="button" onClick={() => removeSection(index)}>
                        <Trash2 size={16} aria-hidden="true" /> Delete
                      </button>
                      <button className="btn-primary w-full !px-3" type="button" onClick={() => addSectionBelow(index)}>
                        <Plus size={16} aria-hidden="true" /> Add Section Below
                      </button>
                    </div>
                  </div>
                  <textarea className="textarea min-h-40" value={section.text || ''} onChange={(event) => updateSection(index, 'text', event.target.value)} placeholder="Cue text or permitted lyrics" />
                  <input className="input mt-3" value={section.vocalNotes || ''} onChange={(event) => updateSection(index, 'vocalNotes', event.target.value)} placeholder="Vocal notes" />
                  <input className="input mt-3" value={section.repeatCount || ''} onChange={(event) => updateSection(index, 'repeatCount', event.target.value)} placeholder="Repeat count" />
                </div>
              );
            })}
          </div>

          {saveStatusConfig && (
            <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${saveStatusConfig.classes}`}>
              {saveStatusConfig.label}
            </div>
          )}

          <button className="btn-primary w-full justify-center" type="submit" disabled={saving || isOffline}>
            {isOffline ? 'Editing requires internet connection' : saving ? 'Saving...' : id ? 'Update Song' : 'Save Song'}
          </button>
        </aside>
      </form>
    </main>
  );
}
