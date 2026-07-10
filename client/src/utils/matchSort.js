import { distanceKm, parseGeoCoordinates } from './geoDistance.js';

export const MATCH_FILTERS = [
  { id: 'all', label: 'All Matches' },
  { id: 'accuracy', label: 'Highest Accuracy' },
  { id: 'recent', label: 'Recent' },
  { id: 'near', label: 'Near Me' },
];

function matchTimestamp(match) {
  const raw = match.createdAt;
  if (!raw) return 0;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : 0;
}

function matchCoordinates(match) {
  if (match.coordinates) {
    return match.coordinates;
  }
  return parseGeoCoordinates(match.location);
}

/** @param {Array} matches @param {'all'|'accuracy'|'recent'|'near'} filter @param {{ lat: number, lng: number }|null} userCoords */
export function sortMatches(matches, filter, userCoords = null) {
  const rows = [...matches];

  if (filter === 'all') {
    return rows;
  }

  if (filter === 'recent') {
    return rows.sort((a, b) => {
      const diff = matchTimestamp(b) - matchTimestamp(a);
      if (diff !== 0) return diff;
      return String(a._id).localeCompare(String(b._id));
    });
  }

  if (filter === 'near') {
    if (!userCoords) {
      return rows.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
    }

    return rows
      .map((match) => {
        const itemCoords = matchCoordinates(match);
        const km = itemCoords ? distanceKm(userCoords, itemCoords) : null;
        return { match, km: km ?? Number.POSITIVE_INFINITY };
      })
      .sort((a, b) => a.km - b.km)
      .map(({ match, km }) => ({
        ...match,
        distanceKm: Number.isFinite(km) ? km : null,
      }));
  }

  if (filter === 'accuracy') {
    return rows.sort((a, b) => {
      const diff = (b.similarityScore || 0) - (a.similarityScore || 0);
      if (diff !== 0) return diff;
      return String(a._id).localeCompare(String(b._id));
    });
  }

  return rows;
}
