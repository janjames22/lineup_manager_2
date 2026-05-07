import { RefreshCw, X, Sparkles } from 'lucide-react';

export default function UpdatePrompt({ onUpdate, onDismiss }) {
  return (
    <div className="fixed inset-x-0 top-0 z-[150] p-4 animate-slide-down pointer-events-none">
      <div className="mx-auto max-w-xl pointer-events-auto overflow-hidden rounded-3xl border border-blue-500/30 bg-slate-900/90 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20"></div>
            <div className="relative grid size-12 place-items-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-900/40">
              <RefreshCw size={24} strokeWidth={2.5} className="animate-spin-slow" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="flex items-center gap-2 text-base font-black text-white tracking-tight">
              <Sparkles size={14} className="text-blue-400" />
              New Update Available
            </h3>
            <p className="truncate text-xs font-medium text-slate-400">
              Fresh features and improvements are ready.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onUpdate}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-500 active:scale-95"
            >
              Update
            </button>
            <button
              onClick={onDismiss}
              className="grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
