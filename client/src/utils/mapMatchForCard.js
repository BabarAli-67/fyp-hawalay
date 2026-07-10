import { parseGeoCoordinates } from './geoDistance.js';

function formatMatchDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Normalize API match row for MatchCard. */
export function mapMatchForCard(row) {
  const item = row.item || {};
  const coordinates = parseGeoCoordinates(item.location);
  return {
    _id: row.matchId,
    itemId: item._id,
    hasImage: Boolean(item.imageFileId),
    similarityScore: Number(row.score) || 0,
    title: item.title || 'Untitled item',
    category: item.category || '',
    locationName: item.locationName || 'Location unknown',
    location: item.location,
    coordinates,
    date: formatMatchDate(item.date || row.createdAt),
    createdAt: row.createdAt || item.date || null,
  };
}
