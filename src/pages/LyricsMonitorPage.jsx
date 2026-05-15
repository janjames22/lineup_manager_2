import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import LyricsMonitor from '../components/LyricsMonitor';
import LoadingScreen from '../components/LoadingScreen';
import { getLineupById, getSongById, getSongs } from '../utils/storage';

export default function LyricsMonitorPage() {
  const { id, songId } = useParams();
  const [lineup, setLineup] = useState(null);
  const [song, setSong] = useState(null);
  const [songsMap, setSongsMap] = useState({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        if (songId) {
          const songData = await getSongById(songId);
          setSong(songData);
        } else if (id) {
          const lineupData = await getLineupById(id);
          setLineup(lineupData);
          // Also load all songs for the lineup
          if (lineupData?.songs?.length) {
            const allSongs = await getSongs();
            const map = {};
            (Array.isArray(allSongs) ? allSongs : []).forEach(s => map[s.id] = s);
            setSongsMap(map);
          }
        }
      } catch (error) {
        console.error("Failed to load songs:", error);
        setSong(null);
        setLineup(null);
        setSongsMap({});
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, songId]);

  const monitorData = useMemo(() => {
    if (loading) return null;

    if (songId) {
      return {
        title: song?.title || 'Song Monitor',
        keyName: song?.selectedKey || song?.originalKey || '',
        sections: song?.lyricsMonitor || [],
        backTo: song ? `/songs/${song.id}` : '/songs',
      };
    }

    const sections = lineup?.songs.flatMap((lineupSong) => {
      const embeddedSong = lineupSong.song || (lineupSong.lyricsMonitor?.length ? lineupSong : null);
      const linkedSong = songsMap[lineupSong.id || lineupSong.songId] || embeddedSong;
      const cues = linkedSong?.lyricsMonitor?.length ? linkedSong.lyricsMonitor : [{ section: 'Song Cue', text: lineupSong.notes || 'No cue text added.', vocalNotes: '', repeatCount: '' }];
      return cues.map((cue) => ({
        ...cue,
        section: `${lineupSong.title} - ${cue.section}`,
        songTitle: lineupSong.title,
        keyName: lineupSong.selectedKey,
      }));
    }) || [];
    const current = sections[index] || sections[0];
    return {
      title: current?.songTitle || 'Sunday Lineup Monitor',
      keyName: current?.keyName || lineup?.serviceTime || '',
      sections,
      backTo: lineup ? `/lineups/${lineup.id}` : '/lineups',
    };
  }, [songId, index, lineup, song, songsMap, loading]);

  if (loading) return <LoadingScreen />;
  if (!monitorData) {
    return (
      <main className="page-shell">
        <p className="text-slate-400">Unable to load monitor data.</p>
        <Link className="btn-primary mt-4" to="/">Back to Dashboard</Link>
      </main>
    );
  }

  return (
    <LyricsMonitor
      title={monitorData.title}
      keyName={monitorData.keyName}
      sections={monitorData.sections}
      index={index}
      onIndexChange={setIndex}
      backAction={<Link className="btn-dark w-full sm:w-auto" to={monitorData.backTo}><ArrowLeft size={18} aria-hidden="true" /> Back</Link>}
    />
  );
}
