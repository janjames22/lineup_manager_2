import { describe, it, expect, vi } from 'vitest';

// Mock modules that need env vars or browser APIs so pure utilities can load
vi.mock('../utils/supabase', () => ({ supabase: null, isSupabaseConfigured: () => false }));
vi.mock('../utils/offlineSync', () => ({
  getOfflineLineupById: vi.fn(),
  getOfflineLineups: vi.fn(),
  getOfflineSongById: vi.fn(),
  getOfflineSongs: vi.fn(),
}));
vi.mock('../utils/pushNotifications', () => ({ sendLineupPushNotification: vi.fn() }));
// Keep the real lineupNotifications but mock markLineupCreatedLocally so
// storage.js can import it without touching window.sessionStorage at import time.
vi.mock('../utils/lineupNotifications', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, markLineupCreatedLocally: vi.fn() };
});

const {
  normalizeLyricsMonitor,
  toCamelCaseSong,
  toSnakeCaseSong,
  toCamelCaseLineup,
  toSnakeCaseLineup,
} = await import('../utils/storage.js');

const {
  createLineupNotification,
  createLineupNotificationFromPush,
} = await import('../utils/lineupNotifications.js');

// ─── normalizeLyricsMonitor ───────────────────────────────────────────────

describe('normalizeLyricsMonitor', () => {
  it('returns [] for null/undefined/empty array', () => {
    expect(normalizeLyricsMonitor(null)).toEqual([]);
    expect(normalizeLyricsMonitor(undefined)).toEqual([]);
    expect(normalizeLyricsMonitor([])).toEqual([]);
  });

  it('normalises a valid section array', () => {
    const result = normalizeLyricsMonitor([
      { section: 'Verse 1', text: 'Hello', vocalNotes: '', repeatCount: '', theme: '' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe('Verse 1');
    expect(result[0].text).toBe('Hello');
  });

  it('filters out null/invalid entries', () => {
    const result = normalizeLyricsMonitor([null, undefined, { section: 'Chorus', text: 'Hi' }]);
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe('Chorus');
  });

  it('parses a JSON string into sections', () => {
    const json = JSON.stringify([
      { section: 'Bridge', text: 'Words', vocalNotes: '', repeatCount: '', theme: '' },
    ]);
    const result = normalizeLyricsMonitor(json);
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe('Bridge');
  });

  it('wraps a bare plain-text string in a single section', () => {
    const result = normalizeLyricsMonitor('Some plain lyrics');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Some plain lyrics');
  });

  it('returns [] for blank string', () => {
    expect(normalizeLyricsMonitor('')).toEqual([]);
    expect(normalizeLyricsMonitor('   ')).toEqual([]);
  });
});

// ─── toCamelCaseSong / toSnakeCaseSong round-trip ─────────────────────────

describe('song snake_case ↔ camelCase conversion', () => {
  const dbRow = {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Amazing Grace',
    artist: 'John Newton',
    original_key: 'G',
    selected_key: 'A',
    tempo: '72',
    category: 'Hymn',
    language: 'English',
    youtube_link: 'https://youtube.com/watch?v=abc',
    chord_chart: 'G  D  Em  C',
    lyrics_monitor: JSON.stringify([
      { section: 'Verse 1', text: 'Amazing grace', vocalNotes: '', repeatCount: '', theme: '' },
    ]),
    notes: 'Play slowly',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  };

  it('maps snake_case DB columns to camelCase app fields', () => {
    const song = toCamelCaseSong(dbRow);
    expect(song.id).toBe(dbRow.id);
    expect(song.originalKey).toBe('G');
    expect(song.selectedKey).toBe('A');
    expect(song.youtubeLink).toBe('https://youtube.com/watch?v=abc');
    expect(song.chordChart).toBe('G  D  Em  C');
    expect(song.lyricsMonitor).toHaveLength(1);
    expect(song.lyricsMonitor[0].section).toBe('Verse 1');
  });

  it('maps camelCase app fields to snake_case Supabase columns', () => {
    const song = toCamelCaseSong(dbRow);
    const payload = toSnakeCaseSong(song);
    expect(payload.original_key).toBe('G');
    expect(payload.selected_key).toBe('A');
    expect(payload.youtube_link).toBe('https://youtube.com/watch?v=abc');
    expect(payload.chord_chart).toBe('G  D  Em  C');
    expect(typeof payload.lyrics_monitor).toBe('string');
    expect(JSON.parse(payload.lyrics_monitor)[0].section).toBe('Verse 1');
  });

  it('falls back selected_key to original_key when absent', () => {
    const song = toCamelCaseSong({ ...dbRow, selected_key: null });
    expect(song.selectedKey).toBe('G');
  });

  it('returns null for null input', () => {
    expect(toCamelCaseSong(null)).toBeNull();
  });
});

// ─── toCamelCaseLineup / toSnakeCaseLineup round-trip ─────────────────────

describe('lineup snake_case ↔ camelCase conversion', () => {
  const dbRow = {
    id: '22222222-2222-2222-2222-222222222222',
    date: '2024-06-15',
    service_time: '9:00 AM',
    worship_leader: 'Jane Doe',
    songs: JSON.stringify([{ id: 'abc', title: 'Song A', selectedKey: 'C' }]),
    musicians: JSON.stringify({ piano: 'Alice', guitar: 'Bob' }),
    general_notes: 'Bring extra cables',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  };

  it('maps snake_case DB columns to camelCase app fields', () => {
    const lineup = toCamelCaseLineup(dbRow);
    expect(lineup.id).toBe(dbRow.id);
    expect(lineup.serviceTime).toBe('9:00 AM');
    expect(lineup.worshipLeader).toBe('Jane Doe');
    expect(lineup.generalNotes).toBe('Bring extra cables');
    expect(Array.isArray(lineup.songs)).toBe(true);
  });

  it('maps camelCase app fields to snake_case Supabase columns', () => {
    const lineup = toCamelCaseLineup(dbRow);
    const payload = toSnakeCaseLineup(lineup);
    expect(payload.service_time).toBe('9:00 AM');
    expect(payload.worship_leader).toBe('Jane Doe');
    expect(payload.general_notes).toBe('Bring extra cables');
    expect(Array.isArray(payload.songs)).toBe(true);
  });

  it('returns null for null input', () => {
    expect(toCamelCaseLineup(null)).toBeNull();
  });
});

// ─── createLineupNotification (notification ID construction) ──────────────

describe('createLineupNotification', () => {
  it('returns null when lineupId is missing', () => {
    expect(createLineupNotification({})).toBeNull();
    expect(createLineupNotification({ id: '' })).toBeNull();
  });

  it('produces lineup_created type for INSERT', () => {
    const n = createLineupNotification({ id: 'abc', date: '2024-06-15', updated_at: '2024-06-15T10:00:00Z' }, 'INSERT');
    expect(n.type).toBe('lineup_created');
    expect(n.lineupId).toBe('abc');
    expect(n.id).toContain('lineup-created-abc');
    expect(n.read).toBe(false);
  });

  it('produces lineup_updated type for UPDATE', () => {
    const n = createLineupNotification({ id: 'abc', updated_at: '2024-06-15T11:00:00Z' }, 'UPDATE');
    expect(n.type).toBe('lineup_updated');
    expect(n.id).toContain('lineup-updated-abc');
  });

  it('uses a supplied notificationId verbatim', () => {
    const n = createLineupNotification({ id: 'abc', notificationId: 'custom-id', updated_at: '2024-06-15T10:00:00Z' }, 'INSERT');
    expect(n.id).toBe('custom-id');
  });
});

// ─── createLineupNotificationFromPush ─────────────────────────────────────

describe('createLineupNotificationFromPush', () => {
  it('returns null when lineupId is absent', () => {
    expect(createLineupNotificationFromPush({})).toBeNull();
    expect(createLineupNotificationFromPush({ type: 'lineup' })).toBeNull();
  });

  it('builds a notification from a push payload', () => {
    const n = createLineupNotificationFromPush({
      lineupId: 'xyz',
      notificationId: 'push-xyz-123',
      type: 'lineup_created',
      title: 'New lineup',
      body: 'Sunday 9AM',
      url: '/lineups/xyz',
    });
    expect(n.id).toBe('push-xyz-123');
    expect(n.lineupId).toBe('xyz');
    expect(n.type).toBe('lineup_created');
    expect(n.read).toBe(false);
  });

  it('falls back gracefully when optional fields are absent', () => {
    const n = createLineupNotificationFromPush({ lineupId: 'abc' });
    expect(n.lineupId).toBe('abc');
    expect(n.url).toBe('/lineups/abc');
    expect(typeof n.id).toBe('string');
    expect(n.id.length).toBeGreaterThan(0);
  });
});
