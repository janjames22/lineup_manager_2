import { ChevronLeft, ChevronRight, Maximize, Palette } from 'lucide-react';
import { useState } from 'react';

const themes = [
  { name: 'Dark Void', classes: 'bg-slate-950 text-white' },
  { name: 'Deep Sea', classes: 'bg-gradient-to-br from-slate-900 to-blue-950 text-white' },
  { name: 'Sunset', classes: 'bg-gradient-to-br from-slate-900 via-purple-950 to-rose-950 text-white' },
  { name: 'Forest', classes: 'bg-gradient-to-br from-slate-900 to-emerald-950 text-white' }
];

export default function LyricsMonitor({ title, keyName, sections, index, onIndexChange, backAction }) {
  const safeSections = sections?.length ? sections : [{ section: 'No Sections', text: 'No lyrics monitor text or cues added yet.', vocalNotes: '', repeatCount: '' }];
  const currentIndex = Math.min(index, safeSections.length - 1);
  const current = safeSections[currentIndex];
  const [themeIndex, setThemeIndex] = useState(0);

  const go = (delta) => onIndexChange(Math.max(0, Math.min(safeSections.length - 1, currentIndex + delta)));
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };
  const toggleTheme = () => setThemeIndex((prev) => (prev + 1) % themes.length);

  return (
    <main className={`flex min-h-dvh flex-col transition-colors duration-700 ease-in-out ${themes[themeIndex].classes}`}>
      <div 
        className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 print:hidden"
        style={{ paddingTop: 'env(safe-area-inset-top, 1rem)' }}
      >
        <div>
          <p className="text-sm font-medium tracking-wider text-amber-300 opacity-90">{keyName ? `KEY: ${keyName}` : 'LYRICS MONITOR'}</p>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input max-w-xs bg-white/10 border-white/20 text-white [&>option]:text-slate-900 focus:bg-white/20 transition-colors" value={currentIndex} onChange={(event) => onIndexChange(Number(event.target.value))}>
            {safeSections.map((section, sectionIndex) => (
              <option key={`${section.section}-${sectionIndex}`} value={sectionIndex}>
                {section.section || `Section ${sectionIndex + 1}`}
              </option>
            ))}
          </select>
          <button className="btn-dark" type="button" onClick={toggleTheme} title="Change Theme">
            <Palette size={18} aria-hidden="true" /> Theme
          </button>
          <button className="btn-dark" type="button" onClick={toggleFullscreen} title="Fullscreen">
            <Maximize size={18} aria-hidden="true" /> Fullscreen
          </button>
          {backAction}
        </div>
      </div>

      <section className="grid flex-1 place-items-center px-4 py-10 text-center relative overflow-hidden">
        <div key={currentIndex} className="w-full max-w-6xl animate-fade-in relative z-10">
          <p className="mb-8 text-xl font-bold tracking-[0.2em] uppercase text-amber-300 opacity-90 drop-shadow-md">{current.section}</p>
          <pre className="whitespace-pre-wrap font-sans text-[2rem] md:text-5xl lg:text-[4rem] font-bold leading-[1.3] text-white drop-shadow-lg">{current.text || 'No cue text for this section.'}</pre>
          {current.vocalNotes && <p className="mt-12 text-2xl font-medium text-blue-200 drop-shadow-md">{current.vocalNotes}</p>}
          {current.repeatCount && <p className="mt-4 text-xl font-medium text-slate-300 drop-shadow-md">Repeat: {current.repeatCount}</p>}
        </div>
      </section>

      <div 
        className="flex items-center justify-between border-t border-white/10 px-4 py-4 sm:px-6 print:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 1rem)' }}
      >
        <button className="btn-dark" type="button" onClick={() => go(-1)} disabled={currentIndex === 0}>
          <ChevronLeft size={20} aria-hidden="true" /> Previous
        </button>
        <span className="text-sm text-slate-300">
          {currentIndex + 1} / {safeSections.length}
        </span>
        <button className="btn-dark" type="button" onClick={() => go(1)} disabled={currentIndex === safeSections.length - 1}>
          Next <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
    </main>
  );
}
