import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-slate-950">
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-pulse-glow rounded-3xl bg-blue-500/20"></div>
        <div className="relative flex size-24 items-center justify-center rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10">
          <img src="/logo.png" alt="Line Up Manager" className="size-16 object-contain" />
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-xl font-black text-white tracking-tight">Line Up Manager</h1>
        <div className="flex items-center gap-2 text-blue-400">
          <Loader2 className="animate-spin" size={18} />
          <span className="text-xs font-black uppercase tracking-widest">Preparing Workspace...</span>
        </div>
      </div>

      <div className="absolute bottom-12 text-[10px] font-black uppercase tracking-widest text-slate-600">
        CCFBC Official App
      </div>
    </div>
  );
}
