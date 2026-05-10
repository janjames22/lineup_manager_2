import { supabase, isSupabaseConfigured } from './supabase';
import { emptyMusicians } from './constants';
import { getOfflineSongs, saveSongsOffline, getOfflineLineups, saveLineupsOffline } from './offlineSync';

const SONGS_KEY = 'worshipSongs';
const LINEUPS_KEY = 'worshipLineups';
const SUPABASE_TIMEOUT_MS = 10000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_LYRICS_MONITOR_THEME = 'Dark Void';

const sampleSong = {
  id: 'song_sample_001',
  title: 'Ikaw Lamang',
  artist: 'Rommel Guevara',
  originalKey: 'C',
  selectedKey: 'C',
  tempo: '72',
  category: 'Worship',
  language: 'Filipino',
  chordChart: 'Intro:\nC  G  Am  F\n\nVerse 1:\n[Team-approved chord chart here]\n\nChorus:\nC  G  Am  F',
  lyricsMonitorTheme: DEFAULT_LYRICS_MONITOR_THEME,
  lyricsMonitor: [
    {
      section: 'Verse 1',
      text: '[Team-approved lyrics or cue text here]',
      vocalNotes: 'Vocals 1 lead. Vocals 2 and 3 enter softly.',
      repeatCount: '1',
    },
    {
      section: 'Chorus',
      text: '[Team-approved chorus cue here]',
      vocalNotes: 'All vocals sing together.',
      repeatCount: '2',
    },
  ],
  notes: 'Use soft intro, build up in chorus.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================
// Field Mapping Functions
// ============================================

function isValidUUID(id) {
  return typeof id === 'string' && UUID_PATTERN.test(id);
}

function toSafeString(value, fallback = '') {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function getDefaultSectionName(index = 0) {
  return `Section ${index + 1}`;
}

function normalizeLyricsMonitorSection(section, index = 0) {
  if (typeof section === 'string') {
    return {
      section: getDefaultSectionName(index),
      text: section,
      vocalNotes: '',
      repeatCount: '',
      theme: '',
    };
  }

  if (!section || typeof section !== 'object' || Array.isArray(section)) {
    return null;
  }

  const nextSectionName = toSafeString(section.section ?? section.name ?? section.title, '').trim() || getDefaultSectionName(index);
  const nextText = toSafeString(section.text ?? section.lyrics ?? section.content, '');
  const nextVocalNotes = toSafeString(section.vocalNotes ?? section.notes, '');
  const nextRepeatCount = toSafeString(section.repeatCount ?? section.repeat, '').trim();
  const nextTheme = toSafeString(section.theme, '');

  return {
    ...section,
    section: nextSectionName,
    text: nextText,
    vocalNotes: nextVocalNotes,
    repeatCount: nextRepeatCount,
    theme: nextTheme,
  };
}

export function normalizeLyricsMonitor(lyricsMonitor) {
  if (Array.isArray(lyricsMonitor)) {
    return lyricsMonitor
      .map((section, index) => normalizeLyricsMonitorSection(section, index))
      .filter(Boolean);
  }

  if (typeof lyricsMonitor === 'string') {
    const trimmed = lyricsMonitor.trim();
    if (!trimmed) return [];

    const parsed = safeParse(trimmed, null);
    if (parsed !== null) {
      return normalizeLyricsMonitor(parsed);
    }

    return [
      {
        section: getDefaultSectionName(0),
        text: trimmed,
        vocalNotes: '',
        repeatCount: '',
        theme: '',
      },
    ];
  }

  if (lyricsMonitor && typeof lyricsMonitor === 'object') {
    const normalizedSection = normalizeLyricsMonitorSection(lyricsMonitor, 0);
    return normalizedSection ? [normalizedSection] : [];
  }

  return [];
}

// Convert camelCase app fields to snake_case Supabase columns
function toSnakeCaseSong(song) {
  const normalizedLyricsMonitor = normalizeLyricsMonitor(song.lyricsMonitor);
  const payload = {
    title: toSafeString(song.title, '').trim(),
    artist: toSafeString(song.artist, ''),
    original_key: toSafeString(song.originalKey, 'C') || 'C',
    selected_key: toSafeString(song.selectedKey, song.originalKey || 'C') || toSafeString(song.originalKey, 'C') || 'C',
    tempo: toSafeString(song.tempo, ''),
    category: toSafeString(song.category, 'Worship') || 'Worship',
    language: toSafeString(song.language, ''),
    youtube_link: toSafeString(song.youtubeLink, ''),
    chord_chart: toSafeString(song.chordChart, ''),
    lyrics_monitor: JSON.stringify(normalizedLyricsMonitor),
    notes: toSafeString(song.notes, ''),
    created_at: song.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (isValidUUID(song.id)) {
    payload.id = song.id;
  }

  return payload;
}

function toSnakeCaseLineup(lineup) {
  const payload = {
    date: lineup.date || '',
    service_time: lineup.serviceTime || '9:00 AM',
    worship_leader: lineup.worshipLeader || '',
    songs: normalizeLineupSongs(lineup.songs || []),
    musicians: { ...emptyMusicians(), ...(lineup.musicians || {}) },
    general_notes: lineup.generalNotes || '',
    created_at: lineup.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (isValidUUID(lineup.id)) {
    payload.id = lineup.id;
  }

  return payload;
}

// Convert snake_case Supabase columns to camelCase app fields
function toCamelCaseSong(dbSong) {
  if (!dbSong) return null;
  const lyricsMonitor = typeof dbSong.lyrics_monitor === 'string'
    ? safeParse(dbSong.lyrics_monitor, [])
    : (dbSong.lyrics_monitor || []);

  return normalizeSong({
    id: dbSong.id,
    title: dbSong.title,
    artist: dbSong.artist,
    originalKey: dbSong.original_key,
    selectedKey: dbSong.selected_key || dbSong.original_key,
    tempo: dbSong.tempo,
    category: dbSong.category,
    language: dbSong.language,
    youtubeLink: dbSong.youtube_link,
    chordChart: dbSong.chord_chart,
    lyricsMonitor,
    notes: dbSong.notes,
    createdAt: dbSong.created_at,
    updatedAt: dbSong.updated_at,
  });
}

function toCamelCaseLineup(dbLineup) {
  if (!dbLineup) return null;
  const songs = typeof dbLineup.songs === 'string'
    ? safeParse(dbLineup.songs, [])
    : (dbLineup.songs || []);
  const musicians = typeof dbLineup.musicians === 'string'
    ? safeParse(dbLineup.musicians, {})
    : (dbLineup.musicians || {});

  return {
    id: dbLineup.id,
    date: dbLineup.date || '',
    serviceTime: dbLineup.service_time || '9:00 AM',
    worshipLeader: dbLineup.worship_leader || '',
    songs: normalizeLineupSongs(songs),
    musicians: musicians && typeof musicians === 'object' && !Array.isArray(musicians) ? musicians : {},
    generalNotes: dbLineup.general_notes || '',
    createdAt: dbLineup.created_at,
    updatedAt: dbLineup.updated_at,
  };
}

// ============================================
// LocalStorage Helper Functions
// ============================================

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function withTimeout(promise, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), SUPABASE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function uid(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function read(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    const value = safeParse(stored, fallback);
    if (!stored) localStorage.setItem(key, JSON.stringify(value));
    return value;
  } catch (error) {
    console.error(`Failed to read ${key} from localStorage:`, error);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event('worship-storage-change'));
  } catch (error) {
    console.error(`Failed to write ${key} to localStorage:`, error);
  }
  return value;
}

function getLocalSongs() {
  const songs = read(SONGS_KEY, [sampleSong]);
  return (Array.isArray(songs) ? songs : [])
    .map(normalizeSong)
    .sort((a, b) => a.title.localeCompare(b.title));
}

function saveLocalSong(song) {
  const nextSong = normalizeSong(song);
  const songs = getLocalSongs();
  const nextSongs = songs.some((item) => item.id === nextSong.id)
    ? songs.map((item) => (item.id === nextSong.id ? { ...item, ...nextSong, createdAt: item.createdAt } : item))
    : [nextSong, ...songs];
  write(SONGS_KEY, nextSongs);
  return nextSong;
}

function deleteLocalSong(id) {
  const songs = getLocalSongs();
  write(SONGS_KEY, songs.filter((song) => song.id !== id));
}

function getLocalLineups() {
  const lineups = read(LINEUPS_KEY, []);
  return (Array.isArray(lineups) ? lineups : [])
    .map(normalizeLineup)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function saveLocalLineup(lineup) {
  const nextLineup = normalizeLineup(lineup);
  const lineups = getLocalLineups();
  const nextLineups = lineups.some((item) => item.id === nextLineup.id)
    ? lineups.map((item) => (item.id === nextLineup.id ? { ...item, ...nextLineup, createdAt: item.createdAt } : item))
    : [nextLineup, ...lineups];
  write(LINEUPS_KEY, nextLineups);
  return nextLineup;
}

function deleteLocalLineup(id) {
  const lineups = getLocalLineups();
  write(LINEUPS_KEY, lineups.filter((lineup) => lineup.id !== id));
}

function getLineupSongId(song) {
  return song?.id || song?.songId || '';
}

function normalizeLineupSongs(songs) {
  if (!Array.isArray(songs)) return [];

  return songs.map((song, index) => {
    const id = getLineupSongId(song);
    return {
      ...song,
      id,
      songId: id,
      title: song.title || 'Untitled Song',
      artist: song.artist || '',
      originalKey: song.originalKey || song.selectedKey || 'C',
      selectedKey: song.selectedKey || song.originalKey || 'C',
      order: Number.isFinite(Number(song.order)) ? Number(song.order) : index + 1,
      orderIndex: Number.isFinite(Number(song.orderIndex)) ? Number(song.orderIndex) : index,
      notes: song.notes || '',
    };
  });
}

export function normalizeSong(song = {}) {
  return {
    id: song.id || uid('song'),
    title: toSafeString(song.title, '').trim() || 'Untitled Song',
    artist: toSafeString(song.artist, ''),
    originalKey: toSafeString(song.originalKey, 'C') || 'C',
    selectedKey: toSafeString(song.selectedKey, song.originalKey || 'C') || toSafeString(song.originalKey, 'C') || 'C',
    tempo: toSafeString(song.tempo, ''),
    category: toSafeString(song.category, 'Worship') || 'Worship',
    language: toSafeString(song.language, ''),
    youtubeLink: toSafeString(song.youtubeLink, ''),
    chordChart: toSafeString(song.chordChart, ''),
    lyricsMonitor: normalizeLyricsMonitor(song.lyricsMonitor),
    lyricsMonitorTheme: toSafeString(song.lyricsMonitorTheme, DEFAULT_LYRICS_MONITOR_THEME) || DEFAULT_LYRICS_MONITOR_THEME,
    notes: toSafeString(song.notes, ''),
    createdAt: song.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeLineup(lineup) {
  return {
    id: lineup.id || uid('lineup'),
    date: lineup.date || '',
    serviceTime: lineup.serviceTime || '9:00 AM',
    worshipLeader: lineup.worshipLeader || '',
    songs: normalizeLineupSongs(lineup.songs),
    musicians: { ...emptyMusicians(), ...(lineup.musicians || {}) },
    generalNotes: lineup.generalNotes || '',
    createdAt: lineup.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ============================================
// Songs API (Async with Supabase + LocalStorage Fallback)
// ============================================

export async function getSongs() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('App is offline, loading songs from offline cache');
    const offlineSongs = await getOfflineSongs();
    if (offlineSongs && offlineSongs.length > 0) return offlineSongs.map(normalizeSong);
    return getLocalSongs();
  }

  // Try Supabase first
  if (isSupabaseConfigured()) {
    console.log('Loading songs from Supabase...');
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('songs')
          .select('*')
          .order('title', { ascending: true }),
        'Supabase getSongs'
      );
      
      if (error) {
        console.error('Supabase getSongs error:', error.message);
      } else if (Array.isArray(data)) {
        console.log('Songs loaded from Supabase:', data.length);
        const camelSongs = data.map(toCamelCaseSong).filter(Boolean);
        saveSongsOffline(camelSongs).catch(console.error);
        return camelSongs;
      }
    } catch (err) {
      console.error('Supabase getSongs failed:', err);
    }
  } else {
    console.log('Supabase not configured, using localStorage fallback for getSongs');
  }
  
  // Fallback to localStorage
  return getLocalSongs();
}

export async function getSongById(id) {
  if (!id) return null;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const offlineSongs = await getOfflineSongs();
    const offlineMatch = offlineSongs?.find((song) => song?.id === id);
    if (offlineMatch) return normalizeSong(offlineMatch);
    const localMatch = getLocalSongs().find((song) => song.id === id);
    return localMatch ? normalizeSong(localMatch) : null;
  }

  // Try Supabase first
  if (isSupabaseConfigured() && isValidUUID(id)) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('songs')
          .select('*')
          .eq('id', id)
          .single(),
        'Supabase getSongById'
      );
      
      if (error) {
        console.error('Supabase getSongById error:', error.message);
      } else if (data) {
        return toCamelCaseSong(data);
      }
    } catch (err) {
      console.error('Supabase getSongById failed:', err);
    }
  }
  
  // Fallback to localStorage
  const localMatch = getLocalSongs().find((song) => song.id === id);
  return localMatch ? normalizeSong(localMatch) : null;
}

export async function saveSong(song) {
  const nextSong = normalizeSong(song);
  console.log('Saving song payload:', nextSong);
  
  // Try Supabase first
  if (isSupabaseConfigured()) {
    try {
      const snakeSong = toSnakeCaseSong(nextSong);
      console.log('Saving to Supabase with snake_case fields:', snakeSong);
      const hasSupabaseId = isValidUUID(nextSong.id);
      
      // Check if song exists only when the app id is already a Supabase UUID.
      const { data: existing } = hasSupabaseId
        ? await withTimeout(
            supabase
              .from('songs')
              .select('id')
              .eq('id', nextSong.id)
              .single(),
            'Supabase findSong'
          )
        : { data: null };
      
      let result;
      if (existing && hasSupabaseId) {
        // Update existing
        result = await withTimeout(
          supabase
            .from('songs')
            .update(snakeSong)
            .eq('id', nextSong.id)
            .select()
            .single(),
          'Supabase updateSong'
        );
      } else {
        // Insert new
        const insertPayload = { ...snakeSong };
        delete insertPayload.id;

        result = await withTimeout(
          supabase
            .from('songs')
            .insert(insertPayload)
            .select()
            .single(),
          'Supabase insertSong'
        );
      }
      
      if (result.error) {
        console.error('Supabase saveSong error:', result.error.message);
        // Don't fall through to localStorage - throw error to show in UI
        throw new Error(result.error.message);
      } else if (result.data) {
        console.log('Supabase saved song:', result.data);
        return toCamelCaseSong(result.data);
      }
    } catch (err) {
      console.error('Supabase saveSong failed:', err);
      // Re-throw to show in UI
      throw err;
    }
  } else {
    console.log('Supabase not configured, using localStorage fallback for saveSong');
  }
  
  // Fallback to localStorage
  return saveLocalSong(nextSong);
}

export async function deleteSong(id) {
  // Try Supabase first
  if (isSupabaseConfigured() && isValidUUID(id)) {
    try {
      const { error } = await withTimeout(
        supabase
          .from('songs')
          .delete()
          .eq('id', id),
        'Supabase deleteSong'
      );
      
      if (error) {
        console.error('Supabase deleteSong error:', error.message);
      }
    } catch (err) {
      console.error('Supabase deleteSong failed:', err);
    }
  }
  
  // Always fallback to localStorage as well
  deleteLocalSong(id);
  return true;
}

// ============================================
// Lineups API (Async with Supabase + LocalStorage Fallback)
// ============================================

export async function getLineups() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('App is offline, loading lineups from offline cache');
    const offlineLineups = await getOfflineLineups();
    if (offlineLineups && offlineLineups.length > 0) return offlineLineups;
    return getLocalLineups();
  }

  // Try Supabase first
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('lineups')
          .select('*')
          .order('date', { ascending: false }),
        'Supabase getLineups'
      );
      
      if (error) {
        console.error('Supabase getLineups error:', error.message);
      } else if (Array.isArray(data)) {
        console.log("Loaded lineups:", data);
        const camelLineups = data.map(toCamelCaseLineup).filter(Boolean);
        saveLineupsOffline(camelLineups).catch(console.error);
        return camelLineups;
      }
    } catch (err) {
      console.error('Supabase getLineups failed:', err);
    }
  }
  
  // Fallback to localStorage
  const localLineups = getLocalLineups();
  console.log("Loaded lineups:", localLineups);
  return localLineups;
}

export async function getLineupById(id) {
  if (!id) return null;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const offlineLineups = await getOfflineLineups();
    return offlineLineups?.find((lineup) => lineup.id === id) || getLocalLineups().find((lineup) => lineup.id === id) || null;
  }

  // Try Supabase first
  if (isSupabaseConfigured() && isValidUUID(id)) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('lineups')
          .select('*')
          .eq('id', id)
          .single(),
        'Supabase getLineupById'
      );
      
      if (error) {
        console.error('Supabase getLineupById error:', error.message);
      } else if (data) {
        return toCamelCaseLineup(data);
      }
    } catch (err) {
      console.error('Supabase getLineupById failed:', err);
    }
  }
  
  // Fallback to localStorage
  return getLocalLineups().find((lineup) => lineup.id === id) || null;
}

export async function saveLineup(lineup) {
  const nextLineup = normalizeLineup(lineup);
  
  // Try Supabase first
  if (isSupabaseConfigured()) {
    try {
      const payload = toSnakeCaseLineup(nextLineup);
      console.log("Saving lineup payload:", payload);
      const hasSupabaseId = isValidUUID(nextLineup.id);
      
      // Check if lineup exists only when the app id is already a Supabase UUID.
      const { data: existing } = hasSupabaseId
        ? await withTimeout(
            supabase
              .from('lineups')
              .select('id')
              .eq('id', nextLineup.id)
              .single(),
            'Supabase findLineup'
          )
        : { data: null };
      
      let result;
      if (existing && hasSupabaseId) {
        // Update existing
        result = await withTimeout(
          supabase
            .from('lineups')
            .update(payload)
            .eq('id', nextLineup.id)
            .select()
            .single(),
          'Supabase updateLineup'
        );
      } else {
        // Insert new
        const insertPayload = { ...payload };
        delete insertPayload.id;

        result = await withTimeout(
          supabase
            .from('lineups')
            .insert(insertPayload)
            .select()
            .single(),
          'Supabase insertLineup'
        );
      }
      
      if (result.error) {
        console.error("Save lineup error:", result.error);
        throw new Error(result.error.message);
      } else if (result.data) {
        console.log("Saved lineup result:", result.data);
        return toCamelCaseLineup(result.data);
      }
    } catch (err) {
      console.error("Save lineup error:", err);
      throw err;
    }
  }
  
  // Fallback to localStorage
  return saveLocalLineup(nextLineup);
}

export async function deleteLineup(id) {
  // Try Supabase first
  if (isSupabaseConfigured() && isValidUUID(id)) {
    try {
      const { error } = await withTimeout(
        supabase
          .from('lineups')
          .delete()
          .eq('id', id),
        'Supabase deleteLineup'
      );
      
      if (error) {
        console.error('Supabase deleteLineup error:', error.message);
      }
    } catch (err) {
      console.error('Supabase deleteLineup failed:', err);
    }
  }
  
  // Always fallback to localStorage as well
  deleteLocalLineup(id);
  return true;
}

export async function getUpcomingLineup() {
  const today = new Date().toISOString().slice(0, 10);
  const lineups = await getLineups();
  return lineups
    .filter((lineup) => lineup.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}
