import { supabase, isSupabaseConfigured } from './supabase';
import { emptyMusicians } from './constants';
import {
  getOfflineLineupById,
  getOfflineLineups,
  getOfflineSongById,
  getOfflineSongs,
} from './offlineSync';
import { markLineupCreatedLocally } from './lineupNotifications';
import { sendLineupPushNotification } from './pushNotifications';

const SONGS_KEY = 'worshipSongs';
const LINEUPS_KEY = 'worshipLineups';
const LIVE_SONGS_CACHE_KEY = 'worshipSongsLiveCache';
const LIVE_LINEUPS_CACHE_KEY = 'worshipLineupsLiveCache';
const ACTIVE_CHURCH_KEY = 'activeChurchId';
const SUPABASE_TIMEOUT_MS = 10000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_LYRICS_MONITOR_THEME = 'Dark Void';
const IS_DEV = import.meta.env.DEV;

let _activeChurchId = localStorage.getItem(ACTIVE_CHURCH_KEY) || null;
export function setActiveChurch(id) {
  _activeChurchId = id;
  if (id) localStorage.setItem(ACTIVE_CHURCH_KEY, id);
  else localStorage.removeItem(ACTIVE_CHURCH_KEY);
}
export function getActiveChurchId() { return _activeChurchId; }

export function clearChurchData() {
  localStorage.removeItem(SONGS_KEY);
  localStorage.removeItem(LINEUPS_KEY);
  localStorage.removeItem(LIVE_SONGS_CACHE_KEY);
  localStorage.removeItem(LIVE_LINEUPS_CACHE_KEY);
  localStorage.removeItem(ACTIVE_CHURCH_KEY);
  _activeChurchId = null;
}

function debugStorage(message, details) {
  if (!IS_DEV) return;
  if (typeof details === 'undefined') {
    console.log(message);
    return;
  }
  console.log(message, details);
}

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
export function toSnakeCaseSong(song) {
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

export function toSnakeCaseLineup(lineup) {
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
export function toCamelCaseSong(dbSong) {
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

export function toCamelCaseLineup(dbLineup) {
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

async function withTimeout(queryFn, label) {
  const controller = new AbortController();
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`${label} timed out`));
    }, SUPABASE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([queryFn(controller.signal), timeout]);
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
    return safeParse(stored, fallback);
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

function readLiveCache(key, fallback = []) {
  const items = read(key, fallback);
  return Array.isArray(items) ? items : fallback;
}

function writeLiveCache(key, value) {
  return write(key, Array.isArray(value) ? value : []);
}

function getLiveCachedSongs() {
  return readLiveCache(LIVE_SONGS_CACHE_KEY, [])
    .map(normalizeSong)
    .sort((a, b) => a.title.localeCompare(b.title));
}

function saveLiveSongsCache(songs) {
  return writeLiveCache(
    LIVE_SONGS_CACHE_KEY,
    (Array.isArray(songs) ? songs : []).map(normalizeSong)
  );
}

function getLiveCachedLineups() {
  return readLiveCache(LIVE_LINEUPS_CACHE_KEY, [])
    .map(normalizeLineup)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function saveLiveLineupsCache(lineups) {
  return writeLiveCache(
    LIVE_LINEUPS_CACHE_KEY,
    (Array.isArray(lineups) ? lineups : []).map(normalizeLineup)
  );
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
    updatedAt: song.updatedAt || new Date().toISOString(),
  };
}

export function normalizeLineup(lineup = {}) {
  return {
    id: lineup.id || uid('lineup'),
    date: lineup.date || '',
    serviceTime: lineup.serviceTime || '9:00 AM',
    worshipLeader: lineup.worshipLeader || '',
    songs: normalizeLineupSongs(lineup.songs),
    musicians: { ...emptyMusicians(), ...(lineup.musicians || {}) },
    generalNotes: lineup.generalNotes || '',
    createdAt: lineup.createdAt || new Date().toISOString(),
    updatedAt: lineup.updatedAt || new Date().toISOString(),
  };
}

// ============================================
// Songs API (Async with Supabase + LocalStorage Fallback)
// ============================================

export async function getSongs() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    debugStorage('App is offline, loading explicitly saved songs from offline cache');
    const offlineSongs = await getOfflineSongs();
    if (offlineSongs && offlineSongs.length > 0) {
      return offlineSongs.map(normalizeSong).sort((a, b) => a.title.localeCompare(b.title));
    }
    if (!isSupabaseConfigured()) return getLocalSongs();
    return [];
  }

  // Try Supabase first
  if (isSupabaseConfigured()) {
    debugStorage('Loading songs from Supabase...');
    try {
      const { data, error } = await withTimeout(
        (signal) => supabase.from('songs').select('*').order('title', { ascending: true }).abortSignal(signal),
        'Supabase getSongs'
      );

      if (error) {
        console.error('Supabase getSongs error:', error.message);
        const cachedSongs = getLiveCachedSongs();
        if (cachedSongs.length) return cachedSongs;
      } else if (Array.isArray(data)) {
        debugStorage('Songs loaded from Supabase:', data.length);
        const camelSongs = data.map(toCamelCaseSong).filter(Boolean);
        saveLiveSongsCache(camelSongs);
        return camelSongs;
      }
    } catch (err) {
      console.error('Supabase getSongs failed:', err);
      const cachedSongs = getLiveCachedSongs();
      if (cachedSongs.length) return cachedSongs;
    }
  } else {
    debugStorage('Supabase not configured, using localStorage fallback for getSongs');
  }

  // Fallback to localStorage
  return getLocalSongs();
}

export async function getSongById(id) {
  if (!id) return null;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const offlineMatch = await getOfflineSongById(id);
    if (offlineMatch) return normalizeSong(offlineMatch);
    const liveCacheMatch = getLiveCachedSongs().find((song) => song.id === id);
    if (liveCacheMatch) return normalizeSong(liveCacheMatch);
    if (isSupabaseConfigured()) return null;
    const localMatch = getLocalSongs().find((song) => song.id === id);
    return localMatch ? normalizeSong(localMatch) : null;
  }

  // BUG-011: warn when Supabase is configured but the id is not a UUID —
  // prevents silent fallthrough that can mask data integrity issues.
  if (isSupabaseConfigured() && !isValidUUID(id)) {
    console.warn('[Storage] getSongById received a non-UUID id; skipping Supabase and falling back to localStorage.', id);
  }

  // Try Supabase first
  if (isSupabaseConfigured() && isValidUUID(id)) {
    try {
      const { data, error } = await withTimeout(
        (signal) => supabase.from('songs').select('*').eq('id', id).abortSignal(signal).single(),
        'Supabase getSongById'
      );
      
      if (error) {
        console.error('Supabase getSongById error:', error.message);
      } else if (data) {
        return toCamelCaseSong(data);
      }
    } catch (err) {
      console.error('Supabase getSongById failed:', err);
      const cachedMatch = getLiveCachedSongs().find((song) => song.id === id);
      if (cachedMatch) return normalizeSong(cachedMatch);
    }
  }
  
  // Fallback to localStorage
  const localMatch = getLocalSongs().find((song) => song.id === id);
  return localMatch ? normalizeSong(localMatch) : null;
}

export async function saveSong(song) {
  const nextSong = normalizeSong(song);
  debugStorage('Saving song payload:', nextSong);

  // Try Supabase first
  if (isSupabaseConfigured()) {
    try {
      const snakeSong = toSnakeCaseSong(nextSong);
      const church_id = getActiveChurchId();
      if (church_id) snakeSong.church_id = church_id;
      debugStorage('Saving to Supabase with snake_case fields:', snakeSong);
      const hasSupabaseId = isValidUUID(nextSong.id);

      let result;
      if (hasSupabaseId) {
        // Upsert on id — eliminates the TOCTOU race between a select and update.
        result = await withTimeout(
          (signal) => supabase.from('songs').upsert(snakeSong, { onConflict: 'id' }).select().abortSignal(signal).single(),
          'Supabase saveSong'
        );
      } else {
        const insertPayload = { ...snakeSong };
        delete insertPayload.id;
        result = await withTimeout(
          (signal) => supabase.from('songs').insert(insertPayload).select().abortSignal(signal).single(),
          'Supabase insertSong'
        );
      }
      
      if (result.error) {
        console.error('Supabase saveSong error:', result.error.message);
        throw new Error(result.error.message);
      } else if (result.data) {
        debugStorage('Supabase saved song:', result.data);
        const savedSong = toCamelCaseSong(result.data);
        const cachedSongs = getLiveCachedSongs();
        const nextCache = cachedSongs.some((item) => item.id === savedSong.id)
          ? cachedSongs.map((item) => (item.id === savedSong.id ? savedSong : item))
          : [savedSong, ...cachedSongs];
        saveLiveSongsCache(nextCache);
        return savedSong;
      }
    } catch (err) {
      console.error('Supabase saveSong failed:', err);
      throw err;
    }
  } else {
    debugStorage('Supabase not configured, using localStorage fallback for saveSong');
  }
  
  // Fallback to localStorage
  return saveLocalSong(nextSong);
}

export async function deleteSong(id) {
  // BUG-009: propagate Supabase errors so local cache is not cleared when the
  // server delete fails (which would cause the record to reappear on next sync).
  if (isSupabaseConfigured() && isValidUUID(id)) {
    const { error } = await withTimeout(
      (signal) => supabase.from('songs').delete().eq('id', id).abortSignal(signal),
      'Supabase deleteSong'
    ).catch((err) => ({ error: err }));

    if (error) {
      console.error('Supabase deleteSong failed:', error.message || error);
      throw error instanceof Error ? error : new Error(error.message || 'Failed to delete song.');
    }
  }

  deleteLocalSong(id);
  saveLiveSongsCache(getLiveCachedSongs().filter((song) => song.id !== id));
  return true;
}

// ============================================
// Lineups API (Async with Supabase + LocalStorage Fallback)
// ============================================

export async function getLineups() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    debugStorage('App is offline, loading explicitly saved lineups from offline cache');
    const offlineLineups = await getOfflineLineups();
    if (offlineLineups && offlineLineups.length > 0) {
      return offlineLineups.map(normalizeLineup).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
    if (!isSupabaseConfigured()) return getLocalLineups();
    return [];
  }

  // Try Supabase first
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await withTimeout(
        (signal) => supabase.from('lineups').select('*').order('date', { ascending: false }).abortSignal(signal),
        'Supabase getLineups'
      );

      if (error) {
        console.error('Supabase getLineups error:', error.message);
        const cachedLineups = getLiveCachedLineups();
        if (cachedLineups.length) return cachedLineups;
      } else if (Array.isArray(data)) {
        debugStorage('Loaded lineups from Supabase:', data.length);
        const camelLineups = data.map(toCamelCaseLineup).filter(Boolean);
        saveLiveLineupsCache(camelLineups);
        return camelLineups;
      }
    } catch (err) {
      console.error('Supabase getLineups failed:', err);
      const cachedLineups = getLiveCachedLineups();
      if (cachedLineups.length) return cachedLineups;
    }
  }

  // Fallback to localStorage
  const localLineups = getLocalLineups();
  debugStorage('Loaded lineups from localStorage:', localLineups.length);
  return localLineups;
}

export async function getLineupById(id) {
  if (!id) return null;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const offlineMatch = await getOfflineLineupById(id);
    if (offlineMatch) return normalizeLineup(offlineMatch);
    const liveCacheMatch = getLiveCachedLineups().find((lineup) => lineup.id === id);
    if (liveCacheMatch) return normalizeLineup(liveCacheMatch);
    if (isSupabaseConfigured()) return null;
    const localMatch = getLocalLineups().find((lineup) => lineup.id === id);
    return localMatch ? normalizeLineup(localMatch) : null;
  }

  // Try Supabase first
  if (isSupabaseConfigured() && isValidUUID(id)) {
    try {
      const { data, error } = await withTimeout(
        (signal) => supabase.from('lineups').select('*').eq('id', id).abortSignal(signal).single(),
        'Supabase getLineupById'
      );
      
      if (error) {
        console.error('Supabase getLineupById error:', error.message);
      } else if (data) {
        const lineup = toCamelCaseLineup(data);
        const cachedLineups = getLiveCachedLineups();
        const nextCache = cachedLineups.some((item) => item.id === lineup.id)
          ? cachedLineups.map((item) => (item.id === lineup.id ? lineup : item))
          : [lineup, ...cachedLineups];
        saveLiveLineupsCache(nextCache);
        return lineup;
      }
    } catch (err) {
      console.error('Supabase getLineupById failed:', err);
      const cachedMatch = getLiveCachedLineups().find((lineup) => lineup.id === id);
      if (cachedMatch) return normalizeLineup(cachedMatch);
    }
  }
  
  // Fallback to localStorage
  const localMatch = getLocalLineups().find((lineup) => lineup.id === id);
  return localMatch || null;
}

export async function saveLineup(lineup, { notify = true } = {}) {
  const nextLineup = normalizeLineup(lineup);
  
  // Try Supabase first
  if (isSupabaseConfigured()) {
    try {
      const payload = toSnakeCaseLineup(nextLineup);
      const church_id = getActiveChurchId();
      if (church_id) payload.church_id = church_id;
      debugStorage('Saving lineup payload:', payload);
      const hasSupabaseId = isValidUUID(nextLineup.id);
      const isUpdate = hasSupabaseId;

      let result;
      if (hasSupabaseId) {
        // Upsert on id — eliminates the TOCTOU race between a select and update.
        result = await withTimeout(
          (signal) => supabase.from('lineups').upsert(payload, { onConflict: 'id' }).select().abortSignal(signal).single(),
          'Supabase saveLineup'
        );
      } else {
        // BUG-008: do NOT call markLineupCreatedLocally here — the real UUID is unknown
        // until the server responds. The post-insert call below uses the confirmed UUID.
        const insertPayload = { ...payload };
        delete insertPayload.id;
        result = await withTimeout(
          (signal) => supabase.from('lineups').insert(insertPayload).select().abortSignal(signal).single(),
          'Supabase insertLineup'
        );
      }
      
      if (result.error) {
        console.error("Save lineup error:", result.error);
        throw new Error(result.error.message);
      } else if (result.data) {
        debugStorage("Saved lineup result:", result.data);
        const savedLineup = toCamelCaseLineup(result.data);
        const cachedLineups = getLiveCachedLineups();
        const nextCache = cachedLineups.some((item) => item.id === savedLineup.id)
          ? cachedLineups.map((item) => (item.id === savedLineup.id ? savedLineup : item))
          : [savedLineup, ...cachedLineups];
        saveLiveLineupsCache(nextCache);
        if (result.data.id) {
          markLineupCreatedLocally(savedLineup);
        }

        if (notify && result.data.id) {
          try {
            const pushResult = await sendLineupPushNotification(savedLineup, {
              eventType: isUpdate ? 'UPDATE' : 'INSERT',
            });
            return { ...savedLineup, pushResult };
          } catch (error) {
            console.error('[LineupNotifications] failed to send web push notification:', error);
            return {
              ...savedLineup,
              pushError: error?.message || 'Lineup saved, but push notification failed.',
            };
          }
        }

        return savedLineup;
      }
    } catch (err) {
      console.error("Save lineup error:", err);
      throw err;
    }
  }
  
  // Fallback to localStorage
  debugStorage('[LineupNotifications] saveLineup is using localStorage fallback because Supabase is not configured.');
  return saveLocalLineup(nextLineup);
}

export async function deleteLineup(id) {
  // BUG-009: propagate Supabase errors so local cache is not cleared when the
  // server delete fails (which would cause the record to reappear on next sync).
  if (isSupabaseConfigured() && isValidUUID(id)) {
    const { error } = await withTimeout(
      (signal) => supabase.from('lineups').delete().eq('id', id).abortSignal(signal),
      'Supabase deleteLineup'
    ).catch((err) => ({ error: err }));

    if (error) {
      console.error('Supabase deleteLineup failed:', error.message || error);
      throw error instanceof Error ? error : new Error(error.message || 'Failed to delete lineup.');
    }
  }

  deleteLocalLineup(id);
  saveLiveLineupsCache(getLiveCachedLineups().filter((lineup) => lineup.id !== id));
  return true;
}

export async function getUpcomingLineup() {
  const today = new Date().toISOString().slice(0, 10);
  const lineups = await getLineups();
  return lineups
    .filter((lineup) => lineup.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

export async function createOfflineLineupPayload(lineup) {
  const normalizedLineup = normalizeLineup(lineup);
  const uniqueSongIds = [
    ...new Set(normalizedLineup.songs.map((song) => song.id || song.songId).filter(Boolean)),
  ];

  const songsById = {};
  await Promise.all(uniqueSongIds.map(async (songId) => {
    const song = await getSongById(songId).catch((error) => {
      console.error(`Failed to load song ${songId} for offline lineup payload:`, error);
      return null;
    });
    if (song) songsById[songId] = normalizeSong(song);
  }));

  return {
    ...normalizedLineup,
    songs: normalizedLineup.songs.map((lineupSong) => {
      const songId = lineupSong.id || lineupSong.songId;
      const fullSong = songsById[songId] || null;
      return {
        ...lineupSong,
        song: fullSong,
        artist: lineupSong.artist || fullSong?.artist || '',
        originalKey: lineupSong.originalKey || fullSong?.originalKey || 'C',
        selectedKey: lineupSong.selectedKey || fullSong?.selectedKey || fullSong?.originalKey || 'C',
        chordChart: fullSong?.chordChart || lineupSong.chordChart || '',
        lyricsMonitor: fullSong?.lyricsMonitor || lineupSong.lyricsMonitor || [],
        youtubeLink: fullSong?.youtubeLink || lineupSong.youtubeLink || '',
      };
    }),
  };
}
