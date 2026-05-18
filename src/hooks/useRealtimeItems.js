import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../utils/supabase';
import { useSyncStatus } from './useSyncStatus';

const POLL_INTERVAL_MS = 20000;
const REALTIME_CONNECT_TIMEOUT_MS = 5000;

function dedupeById(items) {
  const map = new Map();
  for (const item of items) {
    if (!item?.id) continue;
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

function updateItemsFromRealtime(currentItems, payload, mapRow, sortItems) {
  const eventType = payload?.eventType;
  const nextRow = payload?.new;
  const oldRow = payload?.old;
  const changedId = nextRow?.id || oldRow?.id;

  if (!changedId) return currentItems;

  if (eventType === 'DELETE') {
    return sortItems(dedupeById(currentItems.filter((item) => item.id !== changedId)));
  }

  const mappedItem = mapRow(nextRow);
  if (!mappedItem?.id) return currentItems;

  const hasExisting = currentItems.some((item) => item.id === mappedItem.id);
  const nextItems = hasExisting
    ? currentItems.map((item) => (item.id === mappedItem.id ? mappedItem : item))
    : [mappedItem, ...currentItems];

  return sortItems(dedupeById(nextItems));
}

export function useRealtimeItems({
  channelName,
  loadItems,
  mapRow,
  sortItems,
  table,
  onRealtimeChange,
}) {
  const { isOnline } = useSyncStatus();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState(isSupabaseConfigured() ? 'connecting' : 'local');
  const pollTimerRef = useRef(null);
  const connectTimerRef = useRef(null);
  const mountedRef = useRef(false);
  const subscribedRef = useRef(false);

  const clearPollTimer = useCallback(() => {
    if (!pollTimerRef.current) return;
    window.clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
  }, []);

  const refresh = useCallback(async ({ quiet = false, source = 'manual' } = {}) => {
    if (!quiet) setRefreshing(true);
    try {
      const data = await loadItems();
      if (!mountedRef.current) return [];
      const nextItems = sortItems(dedupeById(Array.isArray(data) ? data : []));
      setItems(nextItems);
      setError('');
      if (source !== 'initial') setLastUpdatedAt(new Date());
      return nextItems;
    } catch (refreshError) {
      console.error(`[Realtime] Failed to load ${table}:`, refreshError);
      if (mountedRef.current) {
        setError(`Unable to refresh ${table}.`);
      }
      return [];
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [loadItems, sortItems, table]);

  const startPollingFallback = useCallback(() => {
    if (!isSupabaseConfigured() || pollTimerRef.current || !isOnline) return;
    setRealtimeStatus('polling');
    pollTimerRef.current = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      void refresh({ quiet: true, source: 'poll' });
    }, POLL_INTERVAL_MS);
  }, [isOnline, refresh]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh({ quiet: true, source: 'initial' });
    return () => {
      mountedRef.current = false;
      clearPollTimer();
      if (connectTimerRef.current) {
        window.clearTimeout(connectTimerRef.current);
        connectTimerRef.current = null;
      }
    };
  }, [clearPollTimer, refresh]);

  useEffect(() => {
    if (!isOnline) {
      clearPollTimer();
      setRealtimeStatus('offline');
      return undefined;
    }

    if (!isSupabaseConfigured()) {
      setRealtimeStatus('local');
      return undefined;
    }

    subscribedRef.current = false;
    setRealtimeStatus('connecting');
    let active = true;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          setItems((currentItems) => updateItemsFromRealtime(currentItems, payload, mapRow, sortItems));
          setLastUpdatedAt(new Date());
          setRealtimeStatus('updated');
          if (onRealtimeChange) onRealtimeChange(payload.new || payload.old || {}, payload.eventType);
          window.setTimeout(() => {
            if (mountedRef.current && subscribedRef.current) setRealtimeStatus('subscribed');
          }, 1800);
        }
      )
      .subscribe((status) => {
        if (!mountedRef.current || !active) return;

        if (status === 'SUBSCRIBED') {
          subscribedRef.current = true;
          setRealtimeStatus('subscribed');
          clearPollTimer();
          if (connectTimerRef.current) {
            window.clearTimeout(connectTimerRef.current);
            connectTimerRef.current = null;
          }
          return;
        }

        if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          subscribedRef.current = false;
          startPollingFallback();
        }
      });

    connectTimerRef.current = window.setTimeout(() => {
      if (!subscribedRef.current) startPollingFallback();
    }, REALTIME_CONNECT_TIMEOUT_MS);

    return () => {
      active = false;
      if (connectTimerRef.current) {
        window.clearTimeout(connectTimerRef.current);
        connectTimerRef.current = null;
      }
      clearPollTimer();
      subscribedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [channelName, clearPollTimer, isOnline, mapRow, onRealtimeChange, sortItems, startPollingFallback, table]);

  return {
    items,
    loading,
    error,
    refreshing,
    realtimeStatus,
    lastUpdatedAt,
    refresh,
  };
}
