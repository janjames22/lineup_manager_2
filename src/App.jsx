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

export default function App() {
  const registerSWResult = useRegisterSW({
    onRegistered(_r) { console.log('SW Registered'); },
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

  const closeUpdatePrompt = () => {
    setOfflineReady(false);
    setNeedUpdate(false);
  };

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 selection:bg-blue-500/30 pb-24 lg:pb-0">
      <Navbar />
      <InstallBanner />
      <ToastContainer />
      
      {needUpdate && (
        <UpdatePrompt 
          onUpdate={() => updateServiceWorker(true)} 
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

      <BottomNav />
    </div>
  );
}
