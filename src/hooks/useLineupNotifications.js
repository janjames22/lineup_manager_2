import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from './useToast';
import { supabase, isSupabaseConfigured } from '../utils/supabase';
import {
  consumeLocalLineupCreation,
  createLineupNotification,
  createLineupNotificationFromPush,
  readNotificationSoundEnabled,
  readStoredLineupNotifications,
  storeNotificationSoundEnabled,
  storeLineupNotifications,
} from '../utils/lineupNotifications';
import { playNotificationSound } from '../utils/notificationAudio';
import {
  readPendingLineupPushNotifications,
  removePendingLineupPushNotifications,
  setLineupAppBadge,
} from '../utils/appBadge';

const LINEUP_NOTIFICATION_CHANNEL = 'lineup-notifications';
const IS_DEV = import.meta.env.DEV;

function debugLineupNotifications(message, details) {
  if (!IS_DEV) return;
  if (typeof details === 'undefined') {
    console.log(`[LineupNotifications] ${message}`);
    return;
  }
  console.log(`[LineupNotifications] ${message}`, details);
}

export default function useLineupNotifications() {
  const [notifications, setNotifications] = useState(readStoredLineupNotifications);
  const [bannerNotification, setBannerNotification] = useState(null);
  const [soundEnabled, setSoundEnabledState] = useState(readNotificationSoundEnabled);
  const channelRef = useRef(null);
  const showToastErrorRef = useRef(false);
  const showToastRef = useRef(() => {});
  const notifiedNotificationIdsRef = useRef(new Set(readStoredLineupNotifications().map((notification) => notification?.id).filter(Boolean)));
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
      debugLineupNotifications('notification list after update', next);
      storeLineupNotifications(next);
      notifiedNotificationIdsRef.current = new Set(next.map((notification) => notification?.id).filter(Boolean));
      return next;
    });
  }, []);

  const addNotification = useCallback((notification, options = {}) => {
    const {
      showBanner = true,
      showToastMessage = true,
      playSound = true,
    } = options;

    if (!notification?.id || !notification?.lineupId) return false;
    if (notifiedNotificationIdsRef.current.has(notification.id)) {
      debugLineupNotifications('notification skipped because id already exists', notification.id);
      return false;
    }

    notifiedNotificationIdsRef.current.add(notification.id);
    updateNotifications((current) => {
      const existingIds = new Set(current.map((item) => item.id).filter(Boolean));
      if (existingIds.has(notification.id)) return current;
      return [notification, ...current];
    });

    if (showBanner) setBannerNotification(notification);
    if (showToastMessage) showToastRef.current(notification.message || notification.title, 'info', 6000);

    if (playSound && soundEnabledRef.current) {
      playNotificationSound().catch((error) => {
        console.warn('[LineupNotifications] failed to play notification sound:', error);
        if (error?.name === 'NotAllowedError') {
          showToastRef.current('Tap once in the app to enable notification sounds.', 'info', 5000);
        }
      });
    }

    return true;
  }, [updateNotifications]);

  useEffect(() => {
    const unreadCount = notifications.filter((notification) => !notification.read).length;
    setLineupAppBadge(unreadCount).catch((error) => {
      debugLineupNotifications('app badge sync failed', error);
    });
  }, [notifications]);

  useEffect(() => {
    let cancelled = false;

    readPendingLineupPushNotifications().then(async (pendingNotifications) => {
      if (cancelled || !pendingNotifications.length) return;

      const importedIds = [];
      const importedNotifications = pendingNotifications
        .map((pendingNotification) => {
          const notification = createLineupNotificationFromPush(pendingNotification);
          if (notification) importedIds.push(pendingNotification.id);
          return notification;
        })
        .filter(Boolean);

      if (!importedNotifications.length) {
        await removePendingLineupPushNotifications(pendingNotifications.map((notification) => notification.id));
        return;
      }

      updateNotifications((current) => {
        const existingIds = new Set(current.map((notification) => notification.id).filter(Boolean));
        const nextImports = importedNotifications.filter((notification) => !existingIds.has(notification.id));

        if (!nextImports.length) return current;
        return [...nextImports, ...current];
      });

      await removePendingLineupPushNotifications(importedIds);
    }).catch((error) => {
      debugLineupNotifications('pending push notification import failed', error);
    });

    return () => {
      cancelled = true;
    };
  }, [updateNotifications]);

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

  const handleLineupChange = useCallback((lineupRow, eventType = 'UNKNOWN') => {
    debugLineupNotifications('handleLineupChange called', { eventType, lineupRow });

    if (!lineupRow || typeof lineupRow !== 'object') {
      console.warn('[LineupNotifications] Skipping notification because lineup row is missing or invalid.');
      return;
    }

    if (consumeLocalLineupCreation(lineupRow)) {
      debugLineupNotifications('skipping notification because this browser tab saved the lineup', lineupRow);
      return;
    }

    const notification = createLineupNotification(lineupRow, eventType);
    if (!notification?.lineupId) {
      console.warn('[LineupNotifications] Skipping notification because lineupId is missing.', lineupRow);
      return;
    }

    debugLineupNotifications('created notification', notification);
    addNotification(notification);
  }, [addNotification]);

  const receivePushNotification = useCallback((pushNotification = {}) => {
    const notification = createLineupNotificationFromPush(pushNotification);
    if (!notification) return false;

    debugLineupNotifications('foreground push notification received', notification);
    return addNotification(notification);
  }, [addNotification]);

  useEffect(() => {
    debugLineupNotifications('mounting subscription');

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
          debugLineupNotifications('realtime event received', payload);
          debugLineupNotifications('eventType', payload.eventType);
          debugLineupNotifications('new row', payload.new);
          debugLineupNotifications('old row', payload.old);

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            handleLineupChange(payload.new, payload.eventType);
            return;
          }

          debugLineupNotifications('realtime event ignored because it is not INSERT or UPDATE');
        }
      )
      .subscribe((status) => {
        debugLineupNotifications('subscription status', status);

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
      debugLineupNotifications('cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [handleLineupChange]);

  const dismissBannerNotification = useCallback(() => {
    setBannerNotification(null);
  }, []);

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read).length,
    markAllRead,
    markNotificationRead,
    clearNotification,
    bannerNotification,
    dismissBannerNotification,
    receivePushNotification,
    soundEnabled,
    setSoundEnabled,
  };
}
