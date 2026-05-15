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
  const updatedAt = lineup.updated_at || lineup.updatedAt;
  if (!createdAt && !updatedAt) return '';

  return [
    updatedAt || '',
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
  const matchesLocalSave = (item) => (
    (signature && item.signature === signature)
    || (!signature && id && item.id === id)
    || (id && item.id === id && !item.signature)
  );
  const wasLocal = existing.some(matchesLocalSave);
  writeJson(
    LOCAL_CREATED_LINEUPS_KEY,
    existing.filter((item) => !matchesLocalSave(item)),
    window.sessionStorage
  );
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

export function createLineupNotification(lineup = {}, eventType = 'INSERT') {
  const lineupId = lineup.id;
  if (!lineupId) return null;
  const normalizedEventType = String(eventType || '').toUpperCase();
  const isUpdate = normalizedEventType === 'UPDATE' || normalizedEventType === 'LINEUP_UPDATED';
  const timestamp = lineup.updated_at || lineup.updatedAt || lineup.created_at || lineup.createdAt || new Date().toISOString();
  const safeTimestamp = String(timestamp).replace(/[^a-z0-9]/gi, '');
  const notificationId = lineup.notificationId
    || (isUpdate ? `lineup-updated-${lineupId}-${safeTimestamp}` : `lineup-created-${lineupId}-${safeTimestamp}`);

  return {
    id: notificationId,
    type: isUpdate ? 'lineup_updated' : 'lineup_created',
    title: isUpdate ? 'Line Up Updated' : 'New Line Up Available',
    lineupId,
    url: `/lineups/${lineupId}`,
    message: getLineupNotificationMessage(lineup),
    date: lineup.date || '',
    serviceTime: lineup.service_time || lineup.serviceTime || '',
    createdAt: timestamp,
    read: false,
  };
}

export function createLineupNotificationFromPush(pushNotification = {}) {
  const lineupId = pushNotification.lineupId || pushNotification.lineup_id;
  if (!lineupId) return null;

  return {
    id: pushNotification.notificationId || pushNotification.id || `push-lineup-${lineupId}-${Date.now()}`,
    type: pushNotification.type || 'lineup',
    title: pushNotification.title || 'Line Up Updated',
    lineupId,
    url: pushNotification.url || `/lineups/${lineupId}`,
    message: pushNotification.message || pushNotification.body || 'Tap to open lineup',
    date: pushNotification.date || '',
    serviceTime: pushNotification.serviceTime || pushNotification.service_time || '',
    createdAt: pushNotification.createdAt || pushNotification.timestamp || new Date().toISOString(),
    read: Boolean(pushNotification.read),
  };
}
