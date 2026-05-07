import { Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import SongCard from '../components/SongCard';
import LoadingScreen from '../components/LoadingScreen';
import DownloadOfflineButton from '../components/DownloadOfflineButton';
import { KEYS } from '../utils/constants';
import { getSongs } from '../utils/storage';

export default function SongLibrary() {
  const [songs, setSongs] = useState([]);
  const [query, setQuery] = useState('');
  const [keyFilter, setKeyFilter] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSongs() {
      try {
        console.log('SongLibrary: Loading songs...');
        const data = await getSongs();
        console.log('SongLibrary: Songs loaded:', data);
        setSongs(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load songs:", error);
        setSongs([]);
      } finally {
        setLoading(false);
      }
    }
    loadSongs();
  }, []);

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
    <main className="page-shell">
      <PageHeader
        eyebrow="Song Library"
        title="Chord Charts"
        description="Search by title, key, category, or language."
        actions={
          <div className="flex items-center gap-2">
            <DownloadOfflineButton onDownload={async () => { await getSongs(); }} label="Sync Songs" />
            <Link className="btn-primary" to="/songs/new"><Plus size={18} aria-hidden="true" /> Add Song</Link>
          </div>
        }
      />

      <section className="panel mb-6">
        <div className="grid gap-3 md:grid-cols-[1.5fr_0.7fr_0.7fr_0.7fr]">
          <label className="relative block">
            <span className="sr-only">Search songs</span>
            <Search className="pointer-events-none absolute left-3 top-3 text-blue-400" size={18} aria-hidden="true" />
            <input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or artist" />
          </label>
          <select className="input" value={keyFilter} onChange={(event) => setKeyFilter(event.target.value)}>
            <option value="">All keys</option>
            {KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
          </select>
          <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="input" value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="">All languages</option>
            {languages.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </section>

      {filteredSongs.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredSongs.map((song) => <SongCard key={song.id} song={song} />)}
        </div>
      ) : (
        <EmptyState title="No songs found" message="Try a different search or add the first song for your team." action={<Link className="btn-primary" to="/songs/new">Add Song</Link>} />
      )}
    </main>
  );
}
