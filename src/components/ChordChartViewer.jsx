import { useCallback, useEffect, useState } from 'react';

export const DEFAULT_CHORD_FONT_SIZE = 16;
export const MIN_CHORD_FONT_SIZE = 10;
export const MAX_CHORD_FONT_SIZE = 24;

const STORAGE_KEY = 'chordChartFontSize';
const FONT_SIZE_EVENT = 'chordChartFontSizeChange';
const MOBILE_FIT_FONT_SIZE = 12;

function normalizeFontSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size)) return DEFAULT_CHORD_FONT_SIZE;
  return Math.min(MAX_CHORD_FONT_SIZE, Math.max(MIN_CHORD_FONT_SIZE, Math.round(size)));
}

function readStoredFontSize() {
  if (typeof window === 'undefined') return DEFAULT_CHORD_FONT_SIZE;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeFontSize(saved) : DEFAULT_CHORD_FONT_SIZE;
  } catch {
    return DEFAULT_CHORD_FONT_SIZE;
  }
}

export default function ChordChartViewer({
  chordChart,
  emptyText = 'No chord chart added.',
  className = '',
  preClassName = '',
  showControls = true,
}) {
  const [fontSize, setFontSize] = useState(readStoredFontSize);

  const saveFontSize = useCallback((value) => {
    const nextSize = normalizeFontSize(value);
    setFontSize(nextSize);

    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(STORAGE_KEY, String(nextSize));
      window.dispatchEvent(new CustomEvent(FONT_SIZE_EVENT, { detail: nextSize }));
    } catch {
      // Local preference storage is best-effort; the chart still remains adjustable.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncFromStorage = (event) => {
      if (event.key && event.key !== STORAGE_KEY) return;
      setFontSize(readStoredFontSize());
    };

    const syncFromPage = (event) => {
      setFontSize(normalizeFontSize(event.detail));
    };

    window.addEventListener('storage', syncFromStorage);
    window.addEventListener(FONT_SIZE_EVENT, syncFromPage);

    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener(FONT_SIZE_EVENT, syncFromPage);
    };
  }, []);

  const chartText = String(chordChart || '').trimEnd() || emptyText;

  return (
    <div className={`chord-sheet-container ${className}`}>
      {showControls && (
        <div className="chord-controls">
          <div className="flex min-w-0 items-center gap-1 rounded-xl border border-slate-800/60 bg-slate-950/50 p-1.5 shadow-inner">
            <button
              className="min-h-11 flex-1 rounded-lg px-3 text-sm font-black text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="button"
              onClick={() => saveFontSize(fontSize - 1)}
              aria-label="Decrease chord chart font size"
            >
              A−
            </button>
            <button
              className="min-h-11 flex-1 rounded-lg px-3 text-sm font-black text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="button"
              onClick={() => saveFontSize(fontSize + 1)}
              aria-label="Increase chord chart font size"
            >
              A+
            </button>
          </div>
          <label className="chord-size-slider flex min-h-11 min-w-0 flex-1 basis-40 items-center gap-3 rounded-xl border border-slate-800/60 bg-slate-950/50 px-3 text-xs font-bold uppercase tracking-wider text-slate-400 shadow-inner sm:max-w-xs">
            <span className="shrink-0">Size</span>
            <input
              className="min-w-0 flex-1 accent-blue-500"
              type="range"
              min={MIN_CHORD_FONT_SIZE}
              max={MAX_CHORD_FONT_SIZE}
              value={fontSize}
              onChange={(event) => saveFontSize(event.target.value)}
              aria-label="Chord chart font size"
            />
            <span className="w-10 text-right text-slate-200">{fontSize}px</span>
          </label>
          <button
            className="btn-secondary !min-h-11 !px-3 !py-2 text-xs font-black uppercase tracking-wider"
            type="button"
            onClick={() => saveFontSize(MOBILE_FIT_FONT_SIZE)}
          >
            Fit to Mobile
          </button>
          <button
            className="btn-secondary !min-h-11 !px-3 !py-2 text-xs font-black uppercase tracking-wider"
            type="button"
            onClick={() => saveFontSize(DEFAULT_CHORD_FONT_SIZE)}
          >
            Reset
          </button>
        </div>
      )}
      <pre className={`chord-sheet ${preClassName}`}><code className="chord-sheet-text" style={{ fontSize: `${fontSize}px` }}>{chartText}</code></pre>
    </div>
  );
}
