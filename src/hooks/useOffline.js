import { useEffect, useState } from 'react';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';
import { useSyncStatus } from './useSyncStatus';

function useNativeOffline() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    Network.getStatus().then(status => setIsOffline(!status.connected));

    let handle;
    Network.addListener('networkStatusChange', status => {
      setIsOffline(!status.connected);
    }).then(h => { handle = h; });

    return () => { handle?.remove(); };
  }, []);

  return isOffline;
}

function useWebOffline() {
  const { isOnline } = useSyncStatus();
  return !isOnline;
}

export function useOffline() {
  const nativeOffline = useNativeOffline();
  const webOffline = useWebOffline();
  return Capacitor.isNativePlatform() ? nativeOffline : webOffline;
}
