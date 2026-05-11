import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from './useToast';
import { supabase, isSupabaseConfigured } from '../utils/supabase';
import {
  consumeLocalLineupCreation,
  createLineupNotification,
  readNotificationSoundEnabled,
  readStoredLineupNotifications,
  storeNotificationSoundEnabled,
  storeLineupNotifications,
} from '../utils/lineupNotifications';
import { playNotificationSound } from '../utils/notificationAudio';

const LINEUP_NOTIFICATION_CHANNEL = 'lineup-notifications';

export default function useLineupNotifications() {
  const [notifications, setNotifications] = useState(readStoredLineupNotifications);
  const [soundEnabled, setSoundEnabledState] = useState(readNotificationSoundEnabled);
  const channelRef = useRef(null);
  const showToastErrorRef = useRef(false);
  const showToastRef = useRef(() => {});
  const notifiedLineupIdsRef = useRef(new Set(readStoredLineupNotifications().map((notification) => notification?.lineupId).filter(Boolean)));
  const soundEnabledRef = useRef(soundEnabled);
  const { showToast } = useToast();

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    storeNotificationSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  const updateNotifications = useCallback((updater) => {
    setNotifications((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      console.log('[LineupNotifications] notification list after update:', next);
      storeLineupNotifications(next);
      notifiedLineupIdsRef.current = new Set(next.map((notification) => notification?.lineupId).filter(Boolean));
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    updateNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  }, [updateNotifications]);

  const markNotificationRead = useCallback((notificationId) => {
    updateNotifications((current) => current.map((notification) => (
      notification.id === notificationId ? { ...notification, read: true } : notification
    )));
  }, [updateNotifications]);

  const clearNotification = useCallback((notificationId) => {
    updateNotifications((current) => current.filter((notification) => notification.id !== notificationId));
  }, [updateNotifications]);

  const setSoundEnabled = useCallback((enabled) => {
    setSoundEnabledState(Boolean(enabled));
  }, []);

  const handleNewLineup = useCallback((lineupRow, eventType = 'UNKNOWN') => {
    console.log('[LineupNotifications] handleNewLineup called:', { eventType, lineupRow });

    if (!lineupRow || typeof lineupRow !== 'object') {
      console.warn('[LineupNotifications] Skipping notification because lineup row is missing or invalid.');
      return;
    }

    if (consumeLocalLineupCreation(lineupRow)) {
      console.log('[LineupNotifications] Skipping notification because this browser tab created the lineup:', lineupRow);
      return;
    }

    const notification = createLineupNotification(lineupRow);
    if (!notification?.lineupId) {
      console.warn('[LineupNotifications] Skipping notification because lineupId is missing.', lineupRow);
      return;
    }

    if (notifiedLineupIdsRef.current.has(notification.lineupId)) {
      console.log('[LineupNotifications] notification list update skipped because lineupId already exists:', notification.lineupId);
      return;
    }

    console.log('[LineupNotifications] created notification:', notification);
    notifiedLineupIdsRef.current.add(notification.lineupId);

    updateNotifications((current) => {
      return [notification, ...current];
    });

    console.log('[LineupNotifications] triggering toast for notification:', notification.message);
    showToastRef.current(notification.message, 'info', 6000);

    if (soundEnabledRef.current) {
      playNotificationSound().catch((error) => {
        console.warn('[LineupNotifications] failed to play notification sound:', error);
      });
    }
  }, [updateNotifications]);

  useEffect(() => {
    console.log('[LineupNotifications] Mounting subscription');

    if (!isSupabaseConfigured()) {
      console.warn('[LineupNotifications] Existing Supabase client is not configured. Subscription was not created.');
      return undefined;
    }

    if (channelRef.current) {
      console.warn('[LineupNotifications] Subscription already mounted. Reusing existing channel.');
      return undefined;
    }

    const channel = supabase
      .channel(LINEUP_NOTIFICATION_CHANNEL)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lineups',
        },
        (payload) => {
          console.log('[LineupNotifications] realtime event received:', payload);
          console.log('[LineupNotifications] eventType:', payload.eventType);
          console.log('[LineupNotifications] new row:', payload.new);
          console.log('[LineupNotifications] old row:', payload.old);

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            handleNewLineup(payload.new, payload.eventType);
            return;
          }

          console.log('[LineupNotifications] realtime event ignored because it is not INSERT or UPDATE.');
        }
      )
      .subscribe((status) => {
        console.log(`[LineupNotifications] subscription status: ${status}`);

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[LineupNotifications] Realtime channel is not healthy. Check Supabase client env and Realtime delivery.', { status });
          if (!showToastErrorRef.current) {
            showToastErrorRef.current = true;
            showToastRef.current('Lineup notifications are not connected. Check Realtime delivery.', 'error', 7000);
          }
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[LineupNotifications] Cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [handleNewLineup]);

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read).length,
    markAllRead,
    markNotificationRead,
    clearNotification,
    soundEnabled,
    setSoundEnabled,
  };
}
