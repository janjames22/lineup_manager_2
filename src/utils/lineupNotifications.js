const LOCAL_CREATED_LINEUPS_KEY = 'lineupManagerLocalCreatedLineups';
export const LINEUP_NOTIFICATIONS_KEY = 'lineupManagerNotifications';
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

export function getLineupNotificationMessage(lineup = {}) {
  const title = lineup.title || lineup.name || lineup.lineup_title || lineup.lineupTitle;
  return title ? `New lineup added: ${title}` : 'New lineup added';
}

export function createLineupNotification(lineup = {}) {
  const lineupId = lineup.id || crypto.randomUUID?.() || `lineup-${Date.now()}`;

  return {
    id: `lineup-${lineupId}-${Date.now()}`,
    lineupId,
    message: getLineupNotificationMessage(lineup),
    date: lineup.date || '',
    serviceTime: lineup.service_time || lineup.serviceTime || '',
    createdAt: new Date().toISOString(),
    read: false,
  };
}
