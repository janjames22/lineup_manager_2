import { useEffect, useSyncExternalStore } from 'react';

const BACK_ONLINE_DELAY_MS = 900;
const SYNC_COMPLETE_DELAY_MS = 2200;

const listeners = new Set();

let hasBoundNetworkListeners = false;
let retryTimer = null;
let settledTimer = null;
// BUG-029: use a queue so concurrent requestSync calls don't overwrite each other
let syncQueue = [];
let syncInFlight = false;

let state = {
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  status: typeof navigator === 'undefined' || navigator.onLine ? 'online' : 'offline',
  syncKey: null,
  hasPendingSync: false,
};

function emitChange() {
  listeners.forEach((listener) => listener());
}

function setState(nextState) {
  state = { ...state, ...nextState };
  emitChange();
}

function clearTimers() {
  if (retryTimer) {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }

  if (settledTimer) {
    window.clearTimeout(settledTimer);
    settledTimer = null;
  }
}

function scheduleResetToOnline() {
  clearTimers();
  settledTimer = window.setTimeout(() => {
    setState({
      isOnline: true,
      status: 'online',
      syncKey: null,
      hasPendingSync: false,
    });
  }, SYNC_COMPLETE_DELAY_MS);
}

function isOfflineFailure(error) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('internet') ||
    message.includes('offline')
  );
}

async function runSyncRequest() {
  if (!syncQueue.length) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setState({ isOnline: false, status: 'offline', hasPendingSync: true });
    return;
  }
  if (syncInFlight) return;

  syncInFlight = true;
  clearTimers();
  const current = syncQueue[0];
  setState({
    isOnline: true,
    status: 'syncing',
    syncKey: current.key,
    hasPendingSync: true,
  });

  try {
    await current.action();
    syncQueue.shift();
    syncInFlight = false;

    if (syncQueue.length) {
      void runSyncRequest();
      return;
    }

    setState({
      isOnline: true,
      status: 'synced',
      hasPendingSync: false,
    });
    scheduleResetToOnline();
  } catch (error) {
    syncInFlight = false;

    if (isOfflineFailure(error)) {
      setState({
        isOnline: false,
        status: 'offline',
        hasPendingSync: true,
      });
      return;
    }

    syncQueue.shift();

    if (syncQueue.length) {
      void runSyncRequest();
      return;
    }

    setState({
      isOnline: true,
      status: 'sync_error',
      hasPendingSync: false,
    });
  }
}

function handleOnline() {
  clearTimers();
  setState({
    isOnline: true,
    status: 'back_online',
  });

  if (syncQueue.length) {
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      void runSyncRequest();
    }, BACK_ONLINE_DELAY_MS);
    return;
  }

  settledTimer = window.setTimeout(() => {
    setState({
      isOnline: true,
      status: 'online',
      syncKey: null,
      hasPendingSync: false,
    });
  }, BACK_ONLINE_DELAY_MS);
}

function handleOffline() {
  clearTimers();
  syncInFlight = false;
  setState({
    isOnline: false,
    status: 'offline',
    hasPendingSync: syncQueue.length > 0,
  });
}

function bindNetworkListeners() {
  if (hasBoundNetworkListeners || typeof window === 'undefined') return;
  hasBoundNetworkListeners = true;
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}

function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

export function requestSync(syncKey, action) {
  syncQueue.push({
    key: syncKey,
    action,
  });

  setState({
    syncKey,
    hasPendingSync: true,
  });

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setState({
      isOnline: false,
      status: 'offline',
    });
    return;
  }

  void runSyncRequest();
}

export function useSyncStatus() {
  useEffect(() => {
    bindNetworkListeners();
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
