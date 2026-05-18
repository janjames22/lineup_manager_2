import { BookOpen, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import SongCard from '../components/SongCard';
import LoadingScreen from '../components/LoadingScreen';
import DataRefreshStatus from '../components/DataRefreshStatus';
import { useOfflineItems } from '../hooks/useOfflineItems';
import { useSongs } from '../hooks/useSongs';
import { KEYS } from '../utils/constants';

export default function SongLibrary() {
  const [query, setQuery] = useState('');
  const [keyFilter, setKeyFilter] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('');
  const { error, lastUpdatedAt, loading, realtimeStatus, refreshing, songs } = useSongs();
  const offlineSongs = useOfflineItems('song');

  const categories = useMemo(() => [...new Set(songs.map((song) => song.category).filter(Boolean))], [songs]);
  const languages = useMemo(() => [...new Set(songs.map((song) => song.language).filter(Boolean))], [songs]);

  const filteredSongs = useMemo(() => {
    return songs.filter((song) => {
      const matchesQuery = `${song.title} ${song.artist}`.toLowerCase().includes(query.toLowerCase());
      const matchesKey = !keyFilter || song.originalKey === keyFilter || song.selectedKey === keyFilter;
      const matchesCategory = !category || song.category === category;
      const matchesLanguage = !language || song.language === language;
      return matchesQuery && matchesKey && matchesCategory && matchesLanguage;
    });
  }, [songs, query, keyFilter, category, language]);

  if (loading) return <LoadingScreen />;

  return (
    <main className="page-shell song-library-page">
      <PageHeader
        eyebrow="Song Library"
        title="Chord Charts"
        description="Search by title, key, category, or language."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <DataRefreshStatus lastUpdatedAt={lastUpdatedAt} refreshing={refreshing} status={realtimeStatus} />
            <Link className="btn-primary" to="/songs/new"><Plus size={18} aria-hidden="true" /> Add Song</Link>
          </div>
        }
      />

      {error && <p className="mb-4 text-sm font-semibold text-red-300">{error}</p>}

      <section className="panel mb-6 !p-4 sm:!p-5">
        <div className="grid w-full min-w-0 gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.7fr)]">
          <label className="relative block">
            <span className="sr-only">Search songs</span>
            <Search className="pointer-events-none absolute left-3 top-2.5 text-blue-400" size={18} aria-hidden="true" />
            <input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or artist" />
          </label>
          <div className="grid grid-cols-3 gap-2 md:contents">
            <select className="filter-pill w-full" value={keyFilter} onChange={(event) => setKeyFilter(event.target.value)}>
              <option value="">All keys</option>
              {KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
            </select>
            <select className="filter-pill w-full" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select className="filter-pill w-full" value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="">All languages</option>
              {languages.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          {(keyFilter || category || language) && (
            <button
              type="button"
              className="col-span-full w-full py-1 text-xs font-black text-slate-500 transition-colors hover:text-slate-300"
              onClick={() => { setKeyFilter(''); setCategory(''); setLanguage(''); }}
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {filteredSongs.length > 0 && (
        <p className="mb-4 text-xs font-bold text-slate-500">
          {filteredSongs.length} song{filteredSongs.length !== 1 ? 's' : ''}
          {(query || keyFilter || category || language) ? ' matching filters' : ' in library'}
        </p>
      )}

      {filteredSongs.length ? (
        <div className="grid w-full min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSongs.map((song) => <SongCard key={song.id} song={song} offline={offlineSongs} />)}
        </div>
      ) : (
        <EmptyState icon={BookOpen} title="No songs found" message="Try a different search or add the first song for your team." action={<Link className="btn-primary" to="/songs/new">Add Song</Link>} />
      )}
    </main>
  );
}
