import { ChevronLeft, ChevronRight, Maximize, Palette } from 'lucide-react';
import { useState } from 'react';

const themes = [
  {
    name: 'Dark Void',
    classes: 'bg-slate-950 text-white',
    labelClasses: 'text-amber-300',
    notesClasses: 'text-blue-200',
    repeatClasses: 'text-slate-300',
    glowClasses: 'bg-transparent',
  },
  {
    name: 'Deep Sea',
    classes: 'bg-gradient-to-br from-slate-900 to-blue-950 text-white',
    labelClasses: 'text-cyan-300',
    notesClasses: 'text-sky-200',
    repeatClasses: 'text-slate-200',
    glowClasses: 'bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_38%)]',
  },
  {
    name: 'Sunset',
    classes: 'bg-gradient-to-br from-slate-900 via-purple-950 to-rose-950 text-white',
    labelClasses: 'text-rose-300',
    notesClasses: 'text-orange-100',
    repeatClasses: 'text-rose-100',
    glowClasses: 'bg-[radial-gradient(circle_at_top,rgba(251,113,133,0.18),transparent_40%)]',
  },
  {
    name: 'Forest',
    classes: 'bg-gradient-to-br from-slate-900 to-emerald-950 text-white',
    labelClasses: 'text-emerald-300',
    notesClasses: 'text-lime-100',
    repeatClasses: 'text-emerald-100',
    glowClasses: 'bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.16),transparent_40%)]',
  },
  {
    name: 'Pink',
    classes: 'bg-gradient-to-br from-slate-950 via-rose-950 to-fuchsia-950 text-white',
    labelClasses: 'text-pink-300',
    notesClasses: 'text-pink-100',
    repeatClasses: 'text-rose-100',
    glowClasses: 'bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.24),transparent_42%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.16),transparent_34%)]',
  }
];

export default function LyricsMonitor({ title, keyName, sections, index, onIndexChange, backAction }) {
  const safeSections = sections?.length ? sections : [{ section: 'No Sections', text: 'No lyrics monitor text or cues added yet.', vocalNotes: '', repeatCount: '' }];
  const currentIndex = Math.min(index, safeSections.length - 1);
  const current = safeSections[currentIndex];
  const [themeIndex, setThemeIndex] = useState(0);
  const activeTheme = themes[themeIndex];

  const go = (delta) => onIndexChange(Math.max(0, Math.min(safeSections.length - 1, currentIndex + delta)));
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };
  const toggleTheme = () => setThemeIndex((prev) => (prev + 1) % themes.length);

  return (
    <main className={`flex min-h-dvh w-full max-w-full min-w-0 flex-col overflow-x-hidden transition-colors duration-700 ease-in-out ${activeTheme.classes}`}>
      <div
        className="flex w-full min-w-0 flex-col gap-3 border-b border-white/10 px-3 pb-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 print:hidden"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="min-w-0">
          <p className={`text-sm font-medium tracking-wider opacity-90 ${activeTheme.labelClasses}`}>{keyName ? `KEY: ${keyName}` : 'LYRICS MONITOR'}</p>
          <h1 className="break-words text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <select className="input col-span-2 max-w-full bg-white/10 border-white/20 text-white transition-colors focus:bg-white/20 sm:max-w-xs [&>option]:text-slate-900" value={currentIndex} onChange={(event) => onIndexChange(Number(event.target.value))}>
            {safeSections.map((section, sectionIndex) => (
              <option key={`${section.section}-${sectionIndex}`} value={sectionIndex}>
                {section.section || `Section ${sectionIndex + 1}`}
              </option>
            ))}
          </select>
          <button className="btn-dark w-full sm:w-auto" type="button" onClick={toggleTheme} title="Change Theme">
            <Palette size={18} aria-hidden="true" /> Theme
          </button>
          <button className="btn-dark w-full sm:w-auto" type="button" onClick={toggleFullscreen} title="Fullscreen">
            <Maximize size={18} aria-hidden="true" /> Fullscreen
          </button>
          {backAction}
        </div>
      </div>

      <section className="relative grid min-w-0 flex-1 place-items-center overflow-hidden px-3 py-8 text-center sm:px-4 sm:py-10">
        <div className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${activeTheme.glowClasses}`} aria-hidden="true" />
        <div key={currentIndex} className="relative z-10 w-full max-w-6xl min-w-0 animate-fade-in">
          <p className={`mb-6 break-words text-lg font-bold uppercase tracking-wider opacity-90 drop-shadow-md sm:mb-8 sm:text-xl sm:tracking-[0.2em] ${activeTheme.labelClasses}`}>{current.section}</p>
          <pre className="max-w-full whitespace-pre-wrap break-words font-sans text-[clamp(1.75rem,9vw,3rem)] font-bold leading-[1.25] text-white drop-shadow-lg md:text-5xl lg:text-[4rem] lg:leading-[1.3]">{current.text || 'No cue text for this section.'}</pre>
          {current.vocalNotes && <p className={`mt-8 break-words text-xl font-medium drop-shadow-md sm:mt-12 sm:text-2xl ${activeTheme.notesClasses}`}>{current.vocalNotes}</p>}
          {current.repeatCount && <p className={`mt-4 break-words text-lg font-medium drop-shadow-md sm:text-xl ${activeTheme.repeatClasses}`}>Repeat: {current.repeatCount}</p>}
        </div>
      </section>

      <div
        className="flex items-center justify-between gap-2 border-t border-white/10 px-4 pt-4 sm:px-6 print:hidden"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <button className="btn-dark !px-3 sm:!px-5" type="button" onClick={() => go(-1)} disabled={currentIndex === 0}>
          <ChevronLeft size={20} aria-hidden="true" /> Previous
        </button>
        <span className="shrink-0 text-sm text-slate-300">
          {currentIndex + 1} / {safeSections.length}
        </span>
        <button className="btn-dark !px-3 sm:!px-5" type="button" onClick={() => go(1)} disabled={currentIndex === safeSections.length - 1}>
          Next <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
    </main>
  );
}
