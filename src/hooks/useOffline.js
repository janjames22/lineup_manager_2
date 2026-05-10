import { useSyncStatus } from './useSyncStatus';

export function useOffline() {
  const { isOnline } = useSyncStatus();
  return !isOnline;
}
