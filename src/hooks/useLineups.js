import { useRealtimeItems } from './useRealtimeItems';
import { getLineups, toCamelCaseLineup } from '../utils/storage';
import { useLineupRealtimeChange } from '../contexts/LineupRealtimeContext';

function sortLineups(lineups) {
  return [...lineups].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export function useLineups() {
  const onLineupChange = useLineupRealtimeChange();
  const result = useRealtimeItems({
    channelName: 'lineups-realtime',
    loadItems: getLineups,
    mapRow: toCamelCaseLineup,
    sortItems: sortLineups,
    table: 'lineups',
    onRealtimeChange: onLineupChange ?? undefined,
  });

  return {
    ...result,
    lineups: result.items,
  };
}
