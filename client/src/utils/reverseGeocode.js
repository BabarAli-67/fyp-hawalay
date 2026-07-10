export function shortLabelFromNominatim(data) {
  if (!data || typeof data !== 'object') return null;

  const addr = data.address;
  if (addr && typeof addr === 'object') {
    const locality =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.suburb ||
      addr.county;
    const country = addr.country;
    if (locality && country) return `${locality}, ${country}`;
    if (country) return country;
    if (locality) return locality;
  }

  const parts = String(data.display_name || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[parts.length - 1]}`;
  }
  return parts[0] || null;
}

/**
 * Resolve coordinates to a short place label (e.g. "Lahore, Pakistan").
 */
export async function reverseGeocodeShortLabel([lng, lat]) {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'json');
    url.searchParams.set('zoom', '10');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return shortLabelFromNominatim(data);
  } catch {
    return null;
  }
}

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
