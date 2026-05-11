const LOCAL_CREATED_LINEUPS_KEY = 'lineupManagerLocalCreatedLineups';
export const LINEUP_NOTIFICATIONS_KEY = 'lineupManagerNotifications';
export const LINEUP_NOTIFICATION_SOUND_ENABLED_KEY = 'lineupNotificationSoundEnabled';
const LOCAL_CREATED_TTL_MS = 5 * 60 * 1000;
const MAX_NOTIFICATION_COUNT = 20;

function readJson(key, fallback, storage = null) {
  if (typeof window === 'undefined') return fallback;

  try {
    const targetStorage = storage || window.localStorage;
    const value = targetStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value, storage = null) {
  if (typeof window === 'undefined') return;
  const targetStorage = storage || window.localStorage;
  targetStorage.setItem(key, JSON.stringify(value));
}

function pruneLocalCreatedLineups(items) {
  const now = Date.now();
  return items.filter((item) => (item?.id || item?.signature) && now - Number(item.createdAt || 0) < LOCAL_CREATED_TTL_MS);
}

function getLineupId(lineupOrId) {
  return typeof lineupOrId === 'string' ? lineupOrId : lineupOrId?.id;
}

function getLineupSignature(lineup = {}) {
  const createdAt = lineup.created_at || lineup.createdAt;
  if (!createdAt) return '';

  return [
    createdAt,
    lineup.date || '',
    lineup.service_time || lineup.serviceTime || '',
    lineup.worship_leader || lineup.worshipLeader || '',
  ].join('|');
}

export function markLineupCreatedLocally(lineupOrId) {
  const id = getLineupId(lineupOrId);
  const signature = typeof lineupOrId === 'object' ? getLineupSignature(lineupOrId) : '';
  if (!id && !signature) return;

  const existing = pruneLocalCreatedLineups(readJson(LOCAL_CREATED_LINEUPS_KEY, [], window.sessionStorage));
  writeJson(LOCAL_CREATED_LINEUPS_KEY, [{ id, signature, createdAt: Date.now() }, ...existing], window.sessionStorage);
}

export function consumeLocalLineupCreation(lineupOrId) {
  const id = getLineupId(lineupOrId);
  const signature = typeof lineupOrId === 'object' ? getLineupSignature(lineupOrId) : '';
  if (!id && !signature) return false;

  const existing = pruneLocalCreatedLineups(readJson(LOCAL_CREATED_LINEUPS_KEY, [], window.sessionStorage));
  const wasLocal = existing.some((item) => (id && item.id === id) || (signature && item.signature === signature));
  writeJson(LOCAL_CREATED_LINEUPS_KEY, existing.filter((item) => item.id !== id && item.signature !== signature), window.sessionStorage);
  return wasLocal;
}

export function readStoredLineupNotifications() {
  const notifications = readJson(LINEUP_NOTIFICATIONS_KEY, []);
  return Array.isArray(notifications) ? notifications.slice(0, MAX_NOTIFICATION_COUNT) : [];
}

export function storeLineupNotifications(notifications) {
  writeJson(LINEUP_NOTIFICATIONS_KEY, notifications.slice(0, MAX_NOTIFICATION_COUNT));
}

export function readNotificationSoundEnabled() {
  if (typeof window === 'undefined') return true;

  const storedValue = window.localStorage.getItem(LINEUP_NOTIFICATION_SOUND_ENABLED_KEY);
  return storedValue == null ? true : storedValue === 'true';
}

export function storeNotificationSoundEnabled(enabled) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LINEUP_NOTIFICATION_SOUND_ENABLED_KEY, enabled ? 'true' : 'false');
}

function getLineupDisplayName(lineup = {}) {
  return lineup.title || lineup.name || lineup.lineup_title || lineup.lineupTitle || '';
}

export function getLineupNotificationMessage(lineup = {}) {
  const title = getLineupDisplayName(lineup);
  const date = lineup.date || '';
  const serviceTime = lineup.service_time || lineup.serviceTime || '';
  const schedule = [date, serviceTime].filter(Boolean).join(' · ');

  if (title && schedule) return `${title} · ${schedule}`;
  if (title) return title;
  if (schedule) return schedule;
  return 'Tap to open lineup';
}

export function createLineupNotification(lineup = {}) {
  const lineupId = lineup.id;
  if (!lineupId) return null;

  return {
    id: `lineup-${lineupId}-${Date.now()}`,
    type: 'lineup_created',
    title: 'New lineup added',
    lineupId,
    message: getLineupNotificationMessage(lineup),
    date: lineup.date || '',
    serviceTime: lineup.service_time || lineup.serviceTime || '',
    createdAt: new Date().toISOString(),
    read: false,
  };
}
