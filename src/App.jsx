import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import InstallBanner from './components/InstallBanner';
import Dashboard from './pages/Dashboard';
import SongLibrary from './pages/SongLibrary';
import SongForm from './pages/SongForm';
import SongDetail from './pages/SongDetail';
import LineupList from './pages/LineupList';
import LineupForm from './pages/LineupForm';
import LineupView from './pages/LineupView';
import LyricsMonitorPage from './pages/LyricsMonitorPage';
import PrintExportView from './pages/PrintExportView';

import { useRegisterSW } from 'virtual:pwa-register/react';
import UpdatePrompt from './components/UpdatePrompt';
import BottomNav from './components/BottomNav';
import ToastContainer from './components/ToastContainer';
import { useToast } from './hooks/useToast';
import ShareAppQrModal from './components/ShareAppQrModal';
import { supabase, isSupabaseConfigured } from './utils/supabase';
import {
  consumeLocalLineupCreation,
  createLineupNotification,
  readStoredLineupNotifications,
  storeLineupNotifications,
} from './utils/lineupNotifications';

const UPDATE_CHECK_TIMEOUT_MS = 5000;
const FOREGROUND_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const UPDATE_ACTIVATION_TIMEOUT_MS = 4000;
const IS_DEV = import.meta.env.DEV;
const UPDATE_RELOAD_MARKER_KEY = 'pwa-update-reload-reason';
const LINEUP_NOTIFICATION_CHANNEL = 'lineup-notifications';

function devLog(...args) {
  if (IS_DEV) console.log(...args);
}

export default function App() {
  const location = useLocation();
  const registrationRef = useRef(null);
  const lastUpdateCheckAtRef = useRef(0);
  const lineupNotificationChannelRef = useRef(null);
  const lineupNotificationErrorToastShownRef = useRef(false);
  const waitingWorkerLoggedRef = useRef(false);
  const reloadTriggeredRef = useRef(false);
  const [swRegistration, setSwRegistration] = useState(null);
  const [manualNeedUpdate, setManualNeedUpdate] = useState(false);
  const [checkingForUpdate, setCheckingForUpdate] = useState(false);
  const [shareQrOpen, setShareQrOpen] = useState(false);
  const [lineupNotifications, setLineupNotifications] = useState(readStoredLineupNotifications);
  const { showToast } = useToast();

  const markWaitingWorkerAvailable = () => {
    setManualNeedUpdate(true);
    if (!waitingWorkerLoggedRef.current) {
      devLog('waiting worker available');
      waitingWorkerLoggedRef.current = true;
    }
  };

  const attachWorkerLifecycleLogs = (registration, worker) => {
    if (!worker || worker.__lineupManagerObserved) return;
    worker.__lineupManagerObserved = true;

    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') {
        devLog('new worker installed');
        if (registration.waiting) markWaitingWorkerAvailable();
      }
    });
  };

  const registerSWResult = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      registrationRef.current = registration;
      setSwRegistration(registration || null);
      devLog('service worker registered', { swUrl, scope: registration?.scope });

      if (!registration) return;
      if (registration.waiting) markWaitingWorkerAvailable();
      attachWorkerLifecycleLogs(registration, registration.installing);

      registration.addEventListener('updatefound', () => {
        devLog('update found');
        attachWorkerLifecycleLogs(registration, registration.installing);
      });
    },
    onRegisterError(error) { console.error('SW registration error', error); },
  });

  // Safe destructuring with type guards
  const [_offlineReady, setOfflineReady] = Array.isArray(registerSWResult?.offlineReady) 
    ? registerSWResult.offlineReady 
    : [false, () => {}];
    
  const [needUpdate, setNeedUpdate] = Array.isArray(registerSWResult?.needUpdate) 
    ? registerSWResult.needUpdate 
    : [false, () => {}];
    
  const promptVisible = needUpdate || manualNeedUpdate;
  const isLyricsMonitorRoute = /^\/lyrics-monitor\/[^/]+$/.test(location.pathname) || /^\/lineups\/[^/]+\/monitor$/.test(location.pathname);
  const isPrintRoute = /^\/lineups\/[^/]+\/print$/.test(location.pathname);
  const showAppChrome = !isLyricsMonitorRoute && !isPrintRoute;
  const unreadLineupNotifications = lineupNotifications.filter((notification) => !notification.read).length;

  const updateLineupNotifications = useCallback((updater) => {
    setLineupNotifications((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      console.log('Lineup notification state update:', {
        previousCount: current.length,
        nextCount: next.length,
        unreadCount: next.filter((notification) => !notification.read).length,
        notifications: next,
      });
      storeLineupNotifications(next);
      return next;
    });
  }, []);

  const markLineupNotificationsRead = useCallback(() => {
    updateLineupNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  }, [updateLineupNotifications]);

  const clearLineupNotification = useCallback((notificationId) => {
    updateLineupNotifications((current) => current.filter((notification) => notification.id !== notificationId));
  }, [updateLineupNotifications]);

  useEffect(() => {
    if (!needUpdate) return;
    setManualNeedUpdate(true);
    if (!waitingWorkerLoggedRef.current) {
      devLog('waiting worker available');
      waitingWorkerLoggedRef.current = true;
    }
  }, [needUpdate]);

  useEffect(() => {
    if (!IS_DEV) return undefined;
    const reloadReason = sessionStorage.getItem(UPDATE_RELOAD_MARKER_KEY);
    if (reloadReason) {
      devLog('page reloaded', { reason: reloadReason });
      sessionStorage.removeItem(UPDATE_RELOAD_MARKER_KEY);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      console.warn('Lineup notifications disabled: existing Supabase client is not configured.');
      return undefined;
    }

    if (lineupNotificationChannelRef.current) {
      console.warn('Lineup notification channel already exists; removing stale channel before subscribing again.');
      supabase.removeChannel(lineupNotificationChannelRef.current);
      lineupNotificationChannelRef.current = null;
    }

    console.log('Creating Supabase Realtime lineup notification channel:', {
      channel: LINEUP_NOTIFICATION_CHANNEL,
      schema: 'public',
      table: 'lineups',
      event: 'INSERT',
    });

    let isCleaningUp = false;
    const channel = supabase
      .channel(LINEUP_NOTIFICATION_CHANNEL)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lineups',
        },
        (payload) => {
          console.log('Lineup Realtime payload.new:', payload.new);

          if (consumeLocalLineupCreation(payload.new)) {
            console.log('Lineup Realtime payload ignored because it was created by this browser tab:', payload.new);
            return;
          }

          const notification = createLineupNotification(payload.new);
          console.log('Lineup notification object created:', notification);
          updateLineupNotifications((current) => {
            if (current.some((item) => item.lineupId === notification.lineupId)) {
              console.log('Lineup notification state update skipped; duplicate lineup notification:', notification);
              return current;
            }

            const nextNotifications = [notification, ...current];
            console.log('Lineup notification queued from Realtime payload:', notification);
            return nextNotifications;
          });
          console.log('Showing lineup notification toast:', notification.message);
          showToast(notification.message, 'info', 6000);
        }
      )
      .subscribe((status) => {
        console.log('Lineup notification channel status:', status);

        if (isCleaningUp && status === 'CLOSED') {
          console.log('Lineup notification channel closed during cleanup.');
          return;
        }

        if (status === 'SUBSCRIBED') {
          console.log('Lineup notification channel subscribed to public.lineups INSERT events.');
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error('Lineup notification channel is not receiving events. Confirm Supabase Realtime is enabled for public.lineups.', { status });
          if (!lineupNotificationErrorToastShownRef.current) {
            lineupNotificationErrorToastShownRef.current = true;
            showToast('Lineup notifications are not connected. Check Supabase Realtime for lineups.', 'error', 7000);
          }
        }
      });
    lineupNotificationChannelRef.current = channel;

    return () => {
      isCleaningUp = true;
      console.log('Cleaning up Supabase Realtime lineup notification channel.');
      supabase.removeChannel(channel);
      if (lineupNotificationChannelRef.current === channel) {
        lineupNotificationChannelRef.current = null;
      }
    };
  }, [showToast, updateLineupNotifications]);

  const reloadAppForUpdate = (reason) => {
    if (reloadTriggeredRef.current) return;
    reloadTriggeredRef.current = true;
    if (IS_DEV) devLog('page reloaded', { reason });
    sessionStorage.setItem(UPDATE_RELOAD_MARKER_KEY, reason);
    window.location.reload();
  };

  useEffect(() => {
    if (!swRegistration) return undefined;

    const maybeCheckForUpdates = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      const now = Date.now();
      if (now - lastUpdateCheckAtRef.current < FOREGROUND_UPDATE_CHECK_INTERVAL_MS) return;
      lastUpdateCheckAtRef.current = now;
      swRegistration.update().catch((error) => {
        if (IS_DEV) console.error('service worker update check failed', error);
      });
    };

    window.addEventListener('focus', maybeCheckForUpdates);
    document.addEventListener('visibilitychange', maybeCheckForUpdates);

    return () => {
      window.removeEventListener('focus', maybeCheckForUpdates);
      document.removeEventListener('visibilitychange', maybeCheckForUpdates);
    };
  }, [swRegistration]);

  const waitForWaitingWorker = (registration) => new Promise((resolve) => {
    if (!registration) {
      resolve(false);
      return;
    }

    if (registration.waiting) {
      resolve(true);
      return;
    }

    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      registration.removeEventListener('updatefound', handleUpdateFound);
      if (registration.installing) registration.installing.removeEventListener('statechange', handleStateChange);
    };

    const resolveWith = (value) => {
      cleanup();
      resolve(value);
    };

    const handleStateChange = () => {
      if (registration.waiting) resolveWith(true);
    };

    const handleUpdateFound = () => {
      devLog('update found');
      attachWorkerLifecycleLogs(registration, registration.installing);
      registration.installing?.addEventListener('statechange', handleStateChange);
    };

    registration.addEventListener('updatefound', handleUpdateFound);
    registration.installing?.addEventListener('statechange', handleStateChange);
    timeoutId = window.setTimeout(() => resolveWith(!!registration.waiting), UPDATE_CHECK_TIMEOUT_MS);
  });

  const checkForUpdates = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showToast('Offline mode. Connect to the internet to check for updates.', 'info');
      return;
    }

    const registration = registrationRef.current;
    if (!registration) {
      showToast('Update service is still starting. Please try again.', 'error');
      return;
    }

    if (registration.waiting) {
      markWaitingWorkerAvailable();
      return;
    }

    setCheckingForUpdate(true);
    lastUpdateCheckAtRef.current = Date.now();

    try {
      const waitingWorkerPromise = waitForWaitingWorker(registration);
      await registration.update();
      const hasWaitingWorker = await waitingWorkerPromise;

      if (hasWaitingWorker || registration.waiting) {
        markWaitingWorkerAvailable();
        return;
      }

      showToast('You already have the latest version.', 'info');
    } catch (error) {
      console.error('Manual update check failed:', error);
      showToast('Unable to check for updates right now.', 'error');
    } finally {
      setCheckingForUpdate(false);
    }
  };

  const handleAcceptUpdate = () => {
    devLog('update button clicked');

    const registration = registrationRef.current;
    const waitingWorker = registration?.waiting;

    if (!waitingWorker) {
      devLog('waiting service worker found', false);
      showToast('No update is waiting right now. Please check again.', 'info');
      closeUpdatePrompt();
      return;
    }

    devLog('waiting service worker found', true);
    closeUpdatePrompt();

    const handleControllerChange = () => {
      devLog('controller changed');
      window.clearTimeout(fallbackTimer);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      reloadAppForUpdate('controllerchange');
    };

    const fallbackTimer = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      reloadAppForUpdate('timeout');
    }, UPDATE_ACTIVATION_TIMEOUT_MS);

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    try {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      devLog('SKIP_WAITING sent');
    } catch (error) {
      console.error('Failed to message waiting service worker:', error);
      window.clearTimeout(fallbackTimer);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      showToast('Unable to apply the update automatically. Reloading now.', 'error');
      reloadAppForUpdate('postmessage-error');
    }
  };

  const closeUpdatePrompt = () => {
    setOfflineReady(false);
    setNeedUpdate(false);
    setManualNeedUpdate(false);
  };

  return (
    <div className={`min-h-dvh w-full max-w-full overflow-x-hidden bg-slate-950 text-slate-100 selection:bg-blue-500/30 ${showAppChrome ? 'pb-24 lg:pb-0' : ''}`}>
      {showAppChrome && (
        <Navbar
          onShareApp={() => setShareQrOpen(true)}
          notifications={lineupNotifications}
          unreadNotificationCount={unreadLineupNotifications}
          onMarkNotificationsRead={markLineupNotificationsRead}
          onClearNotification={clearLineupNotification}
        />
      )}
      {showAppChrome && <InstallBanner />}
      <ToastContainer />
      <ShareAppQrModal open={shareQrOpen} onClose={() => setShareQrOpen(false)} />
      
      {promptVisible && (
        <UpdatePrompt 
          onUpdate={handleAcceptUpdate} 
          onDismiss={closeUpdatePrompt} 
        />
      )}
      
      <div className="mx-auto w-full max-w-7xl min-w-0">
        <Routes>
          <Route path="/" element={<Dashboard onShareApp={() => setShareQrOpen(true)} />} />
          <Route path="/songs" element={<SongLibrary />} />
          <Route path="/songs/new" element={<SongForm />} />
          <Route path="/songs/add" element={<Navigate to="/songs/new" replace />} />
          <Route path="/songs/:id" element={<SongDetail />} />
          <Route path="/songs/:id/edit" element={<SongForm />} />
          <Route path="/lyrics-monitor/:songId" element={<LyricsMonitorPage />} />
          <Route path="/lineups" element={<LineupList />} />
          <Route path="/lineups/new" element={<LineupForm />} />
          <Route path="/lineups/:id" element={<LineupView />} />
          <Route path="/lineups/:id/edit" element={<LineupForm />} />
          <Route path="/lineups/:id/monitor" element={<LyricsMonitorPage />} />
          <Route path="/lineups/:id/print" element={<PrintExportView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {showAppChrome && (
        <footer className="border-t border-slate-800/50 bg-slate-900/60 px-4 pt-4 pb-[calc(6.75rem+env(safe-area-inset-bottom,0px))] print:hidden sm:px-6 sm:py-4 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black text-white tracking-tight">About & Updates</p>
              <p className="text-xs font-medium text-slate-400">Installed app not showing fresh changes yet? Check for updates here.</p>
            </div>
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={checkForUpdates}
              disabled={checkingForUpdate}
            >
              {checkingForUpdate ? 'Checking...' : 'Check for updates'}
            </button>
          </div>
        </footer>
      )}

      {showAppChrome && <BottomNav />}
    </div>
  );
}
