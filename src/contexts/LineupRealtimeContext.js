import { createContext, useContext } from 'react';

export const LineupRealtimeContext = createContext(null);

export function useLineupRealtimeChange() {
  return useContext(LineupRealtimeContext);
}
