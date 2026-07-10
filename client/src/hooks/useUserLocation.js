import { useCallback, useEffect, useState } from 'react';

/**
 * One-shot browser geolocation for "Near Me" sorting.
 */
export function useUserLocation({ enabled = false } = {}) {
  const [coords, setCoords] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('error');
      setError('Location is not supported on this device.');
      return;
    }

    setStatus('loading');
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStatus('ready');
      },
      (err) => {
        setStatus('error');
        setCoords(null);
        setError(err?.message || 'Could not access your location.');
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    if (enabled && status === 'idle') {
      requestLocation();
    }
  }, [enabled, requestLocation, status]);

  return { coords, status, error, requestLocation };
}
