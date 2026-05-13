/* global __APP_BUILD_VERSION__ */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
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
import useLineupNotifications from './hooks/useLineupNotifications';
import ShareAppQrModal from './components/ShareAppQrModal';
import { unlockNotificationAudio } from './utils/notificationAudio';

const UPDATE_CHECK_TIMEOUT_MS = 5000;
const FOREGROUND_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const UPDATE_ACTIVATION_TIMEOUT_MS = 2000;
const UPDATE_RELOAD_MARKER_KEY = 'pwa-update-reload-reason';
const CURRENT_BUILD_VERSION = typeof __APP_BUILD_VERSION__ === 'string' ? __APP_BUILD_VERSION__ : 'dev';
const VERSION_URL = '/version.json';
const UPDATE_CACHE_PREFIXES = [
  'lineup-manager-app-shell-',
  'lineup-manager-assets-',
  'lineup-manager-precache-',
  'lineup-manager-runtime-',
  'workbox-precache',
  'workbox-runtime',
];

function logPwa(message, details) {
  if (typeof details === 'undefined') {
    console.log(`[PWA] ${message}`);
    return;
  }

  console.log(`[PWA] ${message}`, details);
}

async function fetchAppVersionInfo() {
  const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`Version check failed with ${response.status}`);
  }

  return response.json();
}

async function clearAppCachesForUpdate() {
  if (typeof caches === 'undefined') return [];
  const cacheNames = await caches.keys();
  const cachesToDelete = cacheNames.filter((cacheName) => (
    UPDATE_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix))
  ));
  await Promise.all(cachesToDelete.map((cacheName) => caches.delete(cacheName)));
  return cachesToDelete;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const registrationRef = useRef(null);
  const lastUpdateCheckAtRef = useRef(0);
  const waitingWorkerLoggedRef = useRef(false);
  const reloadTriggeredRef = useRef(false);
  const [swRegistration, setSwRegistration] = useState(null);
  const [manualNeedUpdate, setManualNeedUpdate] = useState(false);
  const [checkingForUpdate, setCheckingForUpdate] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [availableVersionInfo, setAvailableVersionInfo] = useState(null);
  const [shareQrOpen, setShareQrOpen] = useState(false);
  const { showToast } = useToast();
  const {
    notifications: lineupNotifications,
    unreadCount: unreadLineupNotifications,
    markAllRead: markLineupNotificationsRead,
    markNotificationRead: markSingleLineupNotificationRead,
    clearNotification: clearLineupNotification,
    soundEnabled: lineupNotificationSoundEnabled,
    setSoundEnabled: setLineupNotificationSoundEnabled,
  } = useLineupNotifications();

  const refreshAvailableVersionInfo = useCallback(async () => {
    const versionInfo = await fetchAppVersionInfo();
    setAvailableVersionInfo(versionInfo);
    logPwa('version info fetched', {
      currentBuildVersion: CURRENT_BUILD_VERSION,
      availableVersion: versionInfo.version,
      serviceWorkerVersion: versionInfo.serviceWorkerVersion,
      buildTime: versionInfo.buildTime,
    });
    return versionInfo;
  }, []);

  const markWaitingWorkerAvailable = () => {
    setManualNeedUpdate(true);
    refreshAvailableVersionInfo().catch((error) => {
      console.warn('[PWA] version info could not be fetched for update prompt', error);
    });
    if (!waitingWorkerLoggedRef.current) {
      logPwa('new service worker waiting');
      waitingWorkerLoggedRef.current = true;
    }
  };

  const attachWorkerLifecycleLogs = (registration, worker) => {
    if (!worker || worker.__lineupManagerObserved) return;
    worker.__lineupManagerObserved = true;

    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') {
        logPwa('update found', { state: worker.state });
        if (registration.waiting) markWaitingWorkerAvailable();
      }
    });
  };

  const registerSWResult = useRegisterSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      registrationRef.current = registration;
      setSwRegistration(registration || null);
      logPwa('service worker registered', { swUrl, scope: registration?.scope });

      if (!registration) return;
      registration.update().catch((error) => {
        console.error('[PWA] initial service worker update check failed', error);
      });
      if (registration.waiting) markWaitingWorkerAvailable();
      attachWorkerLifecycleLogs(registration, registration.installing);

      registration.addEventListener('updatefound', () => {
        logPwa('update found');
        attachWorkerLifecycleLogs(registration, registration.installing);
      });
    },
    onRegisterError(error) { console.error('[PWA] SW registration error', error); },
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

  useEffect(() => {
    if (!needUpdate) return;
    setManualNeedUpdate(true);
    refreshAvailableVersionInfo().catch((error) => {
      console.warn('[PWA] version info could not be fetched for update state', error);
    });
    if (!waitingWorkerLoggedRef.current) {
      logPwa('new service worker waiting');
      waitingWorkerLoggedRef.current = true;
    }
  }, [needUpdate, refreshAvailableVersionInfo]);

  useEffect(() => {
    const reloadReason = sessionStorage.getItem(UPDATE_RELOAD_MARKER_KEY);
    if (reloadReason) {
      logPwa('page reloaded with latest bundle', { reason: reloadReason });
      sessionStorage.removeItem(UPDATE_RELOAD_MARKER_KEY);
      showToast('Updated to the latest Line Up Manager build.', 'success', 4500);
    }
    return undefined;
  }, [showToast]);

  useEffect(() => {
    refreshAvailableVersionInfo().catch((error) => {
      console.warn('[PWA] initial version info fetch failed', error);
    });
    return undefined;
  }, [refreshAvailableVersionInfo]);

  useEffect(() => {
    const unlockAudio = () => {
      unlockNotificationAudio();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;

    const handleServiceWorkerMessage = (event) => {
      if (!['LINEUP_NOTIFICATION_CLICK', 'OPEN_LINEUP_FROM_NOTIFICATION'].includes(event.data?.type)) return;

      try {
        const targetUrl = new URL(event.data.url || '/lineups', window.location.origin);
        if (targetUrl.origin !== window.location.origin) return;
        const matchingNotification = lineupNotifications.find((notification) => (
          !notification.read
          && (
            notification.id === event.data.notificationId
            || notification.lineupId === event.data.lineupId
          )
        ));
        if (matchingNotification) markSingleLineupNotificationRead(matchingNotification.id);
        navigate(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
      } catch (error) {
        console.error('[PushNotifications] notification click message could not be handled:', error);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [lineupNotifications, markSingleLineupNotificationRead, navigate]);

  const reloadAppForUpdate = (reason) => {
    if (reloadTriggeredRef.current) return;
    reloadTriggeredRef.current = true;
    logPwa('page reloaded with latest bundle', { reason });
    sessionStorage.setItem(UPDATE_RELOAD_MARKER_KEY, reason);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('appUpdate', Date.now().toString());
    window.location.replace(nextUrl.toString());
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
        console.error('[PWA] service worker update check failed', error);
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
      logPwa('update found');
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

    if (promptVisible) {
      showToast('Update is ready. Tap Update Now to load the latest build.', 'info', 4500);
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
      const versionInfo = await refreshAvailableVersionInfo().catch((error) => {
        console.warn('[PWA] manual version check failed', error);
        return null;
      });
      const waitingWorkerPromise = waitForWaitingWorker(registration);
      await registration.update();
      const hasWaitingWorker = await waitingWorkerPromise;

      if (hasWaitingWorker || registration.waiting) {
        markWaitingWorkerAvailable();
        return;
      }

      showToast(
        versionInfo?.version
          ? `You are already on the latest available build: ${versionInfo.version}.`
          : 'You already have the latest available build.',
        'info',
        4500
      );
    } catch (error) {
      console.error('Manual update check failed:', error);
      showToast('Unable to check for updates right now.', 'error');
    } finally {
      setCheckingForUpdate(false);
    }
  };

  const handleAcceptUpdate = async () => {
    if (applyingUpdate) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showToast('Offline mode. Connect to the internet before applying an update.', 'info', 4500);
      return;
    }

    setApplyingUpdate(true);
    logPwa('activating new service worker');
    showToast('Applying update and refreshing the app...', 'info', 3000);

    const registration = registrationRef.current || await navigator.serviceWorker?.getRegistration?.('/');
    if (registration) {
      registrationRef.current = registration;
      await registration.update().catch((error) => {
        console.warn('[PWA] update check during activation failed', error);
      });
    }
    const waitingWorker = registration?.waiting;

    if (!waitingWorker) {
      logPwa('no waiting service worker; refreshing active build');
      closeUpdatePrompt();
      const deletedCaches = await clearAppCachesForUpdate().catch((error) => {
        console.warn('[PWA] cache cleanup before reload failed', error);
        return [];
      });
      logPwa('caches cleared before update reload', { deletedCaches });
      reloadAppForUpdate('update-prompt-refresh');
      return;
    }

    logPwa('new service worker waiting', true);
    closeUpdatePrompt();

    const handleControllerChange = () => {
      logPwa('page controller changed');
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
      logPwa('SKIP_WAITING sent');
    } catch (error) {
      console.error('Failed to message waiting service worker:', error);
      window.clearTimeout(fallbackTimer);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      showToast('Unable to apply the update automatically. Reloading now.', 'error');
      reloadAppForUpdate('postmessage-error');
    } finally {
      setApplyingUpdate(false);
    }
  };

  const closeUpdatePrompt = () => {
    setOfflineReady(false);
    setNeedUpdate(false);
    setManualNeedUpdate(false);
    setApplyingUpdate(false);
  };

  return (
    <div className={`min-h-dvh w-full max-w-full overflow-x-hidden bg-slate-950 text-slate-100 selection:bg-blue-500/30 ${showAppChrome ? 'pb-24 lg:pb-0' : ''}`}>
      {showAppChrome && (
        <Navbar
          onShareApp={() => setShareQrOpen(true)}
          notifications={lineupNotifications}
          unreadNotificationCount={unreadLineupNotifications}
          onMarkNotificationsRead={markLineupNotificationsRead}
          onMarkNotificationRead={markSingleLineupNotificationRead}
          onClearNotification={clearLineupNotification}
          notificationSoundEnabled={lineupNotificationSoundEnabled}
          onNotificationSoundEnabledChange={setLineupNotificationSoundEnabled}
        />
      )}
      {showAppChrome && <InstallBanner />}
      <ToastContainer />
      <ShareAppQrModal open={shareQrOpen} onClose={() => setShareQrOpen(false)} />
      
      {promptVisible && (
        <UpdatePrompt 
          onUpdate={handleAcceptUpdate} 
          onDismiss={closeUpdatePrompt} 
          updating={applyingUpdate}
          versionInfo={availableVersionInfo}
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
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Build {availableVersionInfo?.version || CURRENT_BUILD_VERSION}
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={checkForUpdates}
              disabled={checkingForUpdate || applyingUpdate}
            >
              {checkingForUpdate ? 'Checking...' : 'Check for updates'}
            </button>
          </div>
        </footer>
      )}

      {showAppChrome && <BottomNav unreadNotificationCount={unreadLineupNotifications} />}
    </div>
  );
}
