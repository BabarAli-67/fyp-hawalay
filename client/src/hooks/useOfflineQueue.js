import { useEffect, useState } from 'react';

/**
 * Tracks browser online/offline for {@link ../components/ui/OfflineBanner.jsx}.
 * (Queue sync can be added here later for the MERN offline flow.)
 */
export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true),
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}
