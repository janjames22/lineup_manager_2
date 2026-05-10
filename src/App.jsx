import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
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

const UPDATE_CHECK_TIMEOUT_MS = 5000;
const FOREGROUND_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const IS_DEV = import.meta.env.DEV;

function devLog(...args) {
  if (IS_DEV) console.log(...args);
}

export default function App() {
  const registrationRef = useRef(null);
  const lastUpdateCheckAtRef = useRef(0);
  const waitingWorkerLoggedRef = useRef(false);
  const [swRegistration, setSwRegistration] = useState(null);
  const [manualNeedUpdate, setManualNeedUpdate] = useState(false);
  const [checkingForUpdate, setCheckingForUpdate] = useState(false);
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
    
  const updateServiceWorker = typeof registerSWResult?.updateServiceWorker === 'function'
    ? registerSWResult.updateServiceWorker
    : () => {};

  const promptVisible = needUpdate || manualNeedUpdate;

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
    if (sessionStorage.getItem('pwa-update-applied') === '1') {
      devLog('app reloaded');
      sessionStorage.removeItem('pwa-update-applied');
    }
    return undefined;
  }, []);

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
    if (IS_DEV) {
      devLog('update accepted');
      sessionStorage.setItem('pwa-update-applied', '1');
    }
    updateServiceWorker(true);
  };

  const closeUpdatePrompt = () => {
    setOfflineReady(false);
    setNeedUpdate(false);
    setManualNeedUpdate(false);
  };

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 selection:bg-blue-500/30 pb-24 lg:pb-0">
      <Navbar />
      <InstallBanner />
      <ToastContainer />
      
      {promptVisible && (
        <UpdatePrompt 
          onUpdate={handleAcceptUpdate} 
          onDismiss={closeUpdatePrompt} 
        />
      )}
      
      <div className="mx-auto max-w-7xl">
        <Routes>
          <Route path="/" element={<Dashboard />} />
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

      <footer className="border-t border-slate-800/50 bg-slate-900/60 px-4 pt-4 pb-[calc(6.75rem+env(safe-area-inset-bottom,0px))] print:hidden sm:px-6 sm:py-4 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
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

      <BottomNav />
    </div>
  );
}
