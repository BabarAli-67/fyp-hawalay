import { useEffect, useRef } from 'react';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '';

let loadPromise = null;

function loadGooglePlacesScript() {
  if (!MAPS_API_KEY) {
    return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set'));
  }
  if (window.google?.maps?.places) {
    return Promise.resolve();
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('google-maps-places-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-places-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_API_KEY)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function isGooglePlacesAvailable() {
  return Boolean(MAPS_API_KEY);
}

/**
 * Attaches Google Places Autocomplete to a controlled text input (optional when API key is set).
 */
export function useGooglePlacesAutocomplete(inputRef, onPlaceSelect) {
  const onPlaceSelectRef = useRef(onPlaceSelect);
  onPlaceSelectRef.current = onPlaceSelect;

  useEffect(() => {
    const input = inputRef.current;
    if (!input || !MAPS_API_KEY) {
      return undefined;
    }

    let autocomplete = null;
    let cancelled = false;

    loadGooglePlacesScript()
      .then(() => {
        if (cancelled || !inputRef.current) return;
        autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ['formatted_address', 'geometry', 'name'],
        });
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const loc = place?.geometry?.location;
          if (!loc) return;
          const locationName = place.formatted_address || place.name || inputRef.current?.value || '';
          onPlaceSelectRef.current?.({
            locationName,
            coordinates: [loc.lng(), loc.lat()],
          });
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (autocomplete && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [inputRef]);
}
