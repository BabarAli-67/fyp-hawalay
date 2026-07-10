import { useEffect, useState } from 'react';
import { reverseGeocodeShortLabel } from '../utils/reverseGeocode.js';
import { useUserLocation } from './useUserLocation.js';

/**
 * Short location label for the dashboard header (browser geolocation + Nominatim).
 */
export function useDashboardLocation() {
  const { coords, status } = useUserLocation({ enabled: true });
  const [label, setLabel] = useState(null);

  useEffect(() => {
    if (!coords) return undefined;

    let cancelled = false;
    reverseGeocodeShortLabel([coords.lng, coords.lat])
      .then((text) => {
        if (!cancelled) setLabel(text);
      })
      .catch(() => {
        if (!cancelled) setLabel(null);
      });

    return () => {
      cancelled = true;
    };
  }, [coords]);

  return { label, status };
}
