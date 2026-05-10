import { X, Download, Share, PlusSquare } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    const checkStandalone = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator.standalone === true) ||
        document.referrer.includes('android-app://')
      );
    };

    if (checkStandalone()) {
      setIsStandalone(true);
      return;
    }

    // Check if already dismissed in this session or permanently
    if (sessionStorage.getItem('dismissInstallBanner') === 'true' || 
        localStorage.getItem('dismissInstallBannerPermanently') === 'true') {
      return;
    }

    // Detect iOS Safari
    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    
    if (isIOSDevice && isSafari) {
      setIsIOS(true);
      // Show after a small delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }

    // Handle standard PWA install prompt (Android / Desktop Chrome)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show after a small delay
      setTimeout(() => setIsVisible(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
      localStorage.setItem('dismissInstallBannerPermanently', 'true');
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    sessionStorage.setItem('dismissInstallBanner', 'true');
    setIsVisible(false);
  };

  if (!isVisible || isStandalone) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] z-[100] p-4 animate-slide-up print:hidden sm:bottom-6 sm:left-6 sm:right-auto sm:w-[420px]">
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-900/90 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-2xl">
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600"></div>

        <button
          onClick={handleDismiss}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-slate-800 hover:text-white transition-all active:scale-90"
          aria-label="Dismiss"
        >
          <X size={18} />
        </button>
        
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 size-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-2 shadow-xl ring-1 ring-white/10">
              <img src="/logo.png" alt="App Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white leading-tight tracking-tight">Install App</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Line Up Manager</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300 leading-relaxed">
              Install the app for <span className="text-white font-bold">offline access</span> and a better experience on your home screen.
            </p>
            
            {isIOS ? (
              <div className="space-y-4 rounded-2xl bg-blue-950/30 p-4 border border-blue-500/20">
                <div className="flex items-center gap-3 text-sm font-bold text-blue-200">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                    <Share size={16} />
                  </div>
                  <span>Tap the <span className="text-white">Share</span> button below</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-bold text-blue-200">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                    <PlusSquare size={16} />
                  </div>
                  <span>Select <span className="text-white">Add to Home Screen</span></span>
                </div>
              </div>
            ) : (
              <button
                onClick={handleInstallClick}
                className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-base font-black text-white shadow-[0_10px_25px_-5px_rgba(37,99,235,0.4)] transition-all hover:bg-blue-500 hover:translate-y-[-2px] active:translate-y-[0] active:scale-[0.98]"
              >
                <Download size={20} strokeWidth={3} />
                Install Now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
