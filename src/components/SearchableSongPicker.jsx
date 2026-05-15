import { Check, Music2, Search, X } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MAX_RESULTS = 8;
const LISTBOX_GAP = 8;
const VIEWPORT_PADDING = 12;
const LISTBOX_MAX_HEIGHT = 288;
const LISTBOX_MIN_HEIGHT = 112;

function getSongKey(song) {
  return song?.selectedKey || song?.originalKey || '';
}

function getSongLabel(song) {
  if (!song) return '';
  const key = getSongKey(song);
  return key ? `${song.title} - ${key}` : song.title;
}

function normalizeSearch(value) {
  return String(value || '').trim().toLowerCase();
}

export default function SearchableSongPicker({
  disabled = false,
  emptyMessage = 'No songs available.',
  noResultsMessage = 'No songs match that title.',
  onChange,
  placeholder = 'Search song title',
  songs = [],
  value = '',
}) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listboxRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [floatingStyle, setFloatingStyle] = useState(null);
  const deferredQuery = useDeferredValue(query);

  const selectedSong = useMemo(
    () => songs.find((song) => song.id === value) || null,
    [songs, value]
  );

  const filteredSongs = useMemo(() => {
    const searchTerm = normalizeSearch(deferredQuery);
    const matches = searchTerm
      ? songs.filter((song) => normalizeSearch(song.title).includes(searchTerm))
      : songs;

    return matches.slice(0, MAX_RESULTS);
  }, [deferredQuery, songs]);

  const displayValue = open ? query : getSongLabel(selectedSong);
  const isSearching = Boolean(normalizeSearch(deferredQuery));
  const emptyStateMessage = isSearching ? noResultsMessage : emptyMessage;

  const updateFloatingPosition = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;

    const rect = input.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const viewportTop = visualViewport?.offsetTop || 0;
    const viewportLeft = visualViewport?.offsetLeft || 0;
    const viewportWidth = visualViewport?.width || document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = visualViewport?.height || window.innerHeight;
    const visibleTop = viewportTop + VIEWPORT_PADDING;
    const visibleBottom = viewportTop + viewportHeight - VIEWPORT_PADDING;
    const visibleLeft = viewportLeft + VIEWPORT_PADDING;
    const visibleRight = viewportLeft + viewportWidth - VIEWPORT_PADDING;
    const spaceBelow = Math.max(0, visibleBottom - rect.bottom - LISTBOX_GAP);
    const spaceAbove = Math.max(0, rect.top - visibleTop - LISTBOX_GAP);
    const placeAbove = spaceBelow < LISTBOX_MIN_HEIGHT && spaceAbove > spaceBelow;
    const availableHeight = Math.max(LISTBOX_MIN_HEIGHT, placeAbove ? spaceAbove : spaceBelow);
    const maxHeight = Math.min(LISTBOX_MAX_HEIGHT, availableHeight);
    const width = Math.min(rect.width, Math.max(0, visibleRight - visibleLeft));
    const left = Math.min(Math.max(rect.left, visibleLeft), Math.max(visibleLeft, visibleRight - width));
    const top = placeAbove
      ? Math.max(visibleTop, rect.top - LISTBOX_GAP - maxHeight)
      : Math.min(rect.bottom + LISTBOX_GAP, visibleBottom - maxHeight);

    setFloatingStyle({
      left,
      maxHeight,
      top: Math.max(visibleTop, top),
      width,
    });
  }, []);

  useEffect(() => {
    if (value) return;
    setQuery('');
  }, [value]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [deferredQuery, songs.length]);

  useLayoutEffect(() => {
    if (!open || disabled) {
      setFloatingStyle(null);
      return;
    }

    updateFloatingPosition();
  }, [deferredQuery, disabled, filteredSongs.length, open, updateFloatingPosition]);

  useEffect(() => {
    if (!open || disabled) return undefined;

    const visualViewport = window.visualViewport;

    window.addEventListener('resize', updateFloatingPosition);
    window.addEventListener('scroll', updateFloatingPosition, true);
    visualViewport?.addEventListener('resize', updateFloatingPosition);
    visualViewport?.addEventListener('scroll', updateFloatingPosition);

    return () => {
      window.removeEventListener('resize', updateFloatingPosition);
      window.removeEventListener('scroll', updateFloatingPosition, true);
      visualViewport?.removeEventListener('resize', updateFloatingPosition);
      visualViewport?.removeEventListener('scroll', updateFloatingPosition);
    };
  }, [disabled, open, updateFloatingPosition]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      if (listboxRef.current?.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const selectSong = (song) => {
    if (!song) return;
    onChange(song.id);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const clearSelection = () => {
    onChange('');
    setQuery('');
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleInputChange = (event) => {
    const nextQuery = event.target.value;
    if (value) onChange('');
    setQuery(nextQuery);
    setOpen(true);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((index) => Math.min(index + 1, Math.max(filteredSongs.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Enter' && open && filteredSongs[highlightedIndex]) {
      event.preventDefault();
      selectSong(filteredSongs[highlightedIndex]);
      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  const listbox = open && !disabled && floatingStyle && typeof document !== 'undefined'
    ? createPortal(
      <div
        className="fixed z-[1000] overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/95 shadow-2xl shadow-slate-950/70 ring-1 ring-white/10 backdrop-blur-xl"
        id={listboxId}
        ref={listboxRef}
        role="listbox"
        style={{
          left: `${floatingStyle.left}px`,
          maxHeight: `${floatingStyle.maxHeight}px`,
          top: `${floatingStyle.top}px`,
          width: `${floatingStyle.width}px`,
        }}
      >
        {filteredSongs.length ? (
          <div className="overflow-y-auto py-1 [-webkit-overflow-scrolling:touch]" style={{ maxHeight: `${floatingStyle.maxHeight}px` }}>
            {filteredSongs.map((song, index) => {
              const key = getSongKey(song);
              const selected = song.id === value;
              const highlighted = index === highlightedIndex;

              return (
                <button
                  aria-selected={selected}
                  className={`flex w-full min-w-0 items-center gap-3 px-3 py-3 text-left transition-colors ${
                    highlighted ? 'bg-blue-500/15 text-white' : 'text-slate-200 hover:bg-slate-900'
                  }`}
                  id={`${listboxId}-${song.id}`}
                  key={song.id}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSong(song)}
                  role="option"
                  type="button"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-300 ring-1 ring-blue-400/20">
                    <Music2 size={16} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-wrap-anywhere block text-sm font-black leading-tight">{song.title}</span>
                    {song.artist && <span className="text-wrap-anywhere mt-0.5 block text-xs font-semibold text-slate-400">{song.artist}</span>}
                  </span>
                  {key && (
                    <span className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-black text-amber-200">
                      {key}
                    </span>
                  )}
                  {selected && <Check size={16} className="shrink-0 text-blue-300" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-wrap-anywhere px-4 py-5 text-sm font-semibold text-slate-300">
            {emptyStateMessage}
          </div>
        )}
      </div>,
      document.body
    )
    : null;

  return (
    <div className="relative w-full min-w-0" ref={rootRef}>
      <div className="group relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-300 transition-colors group-focus-within:text-blue-200" size={18} aria-hidden="true" />
        <input
          ref={inputRef}
          aria-activedescendant={open && filteredSongs[highlightedIndex] ? `${listboxId}-${filteredSongs[highlightedIndex].id}` : undefined}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          className="input pr-11 pl-10"
          disabled={disabled}
          onChange={handleInputChange}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          type="text"
          value={displayValue}
        />
        {(value || query) && !disabled && (
          <button
            aria-label="Clear selected song"
            className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
            onClick={clearSelection}
            type="button"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {listbox}
    </div>
  );
}
