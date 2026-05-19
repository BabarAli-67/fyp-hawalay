/**
 * Resolve coordinates to a human-readable place name via OpenStreetMap Nominatim (free).
 * Used after geolocation on the report form.
 */
export async function reverseGeocodeCoordinates([lng, lat]) {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'json');
    url.searchParams.set('zoom', '18');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (typeof data?.display_name === 'string' && data.display_name.trim()) {
      return data.display_name.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export function formatCoordinatesLabel([lng, lat]) {
  return `Current location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}
