import { mapItemForCard } from './mapItemForCard.js';

const MAX_RECENT_ITEMS = 10;
const STORAGE_PREFIX = 'hawalay_recently_viewed';
export const RECENTLY_VIEWED_CHANGED_EVENT = 'hawalay:recently-viewed-changed';

function storageKey(userId) {
  return `${STORAGE_PREFIX}:${userId}`;
}

/**
 * @param {string | undefined | null} userId
 * @returns {Array<ReturnType<typeof mapItemForCard> & { viewedAt: number }>}
 */
export function loadRecentlyViewed(userId) {
  if (!userId) return [];

  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Record an item the user opened on the detail page (deduped, most-recent first).
 * @param {string | undefined | null} userId
 * @param {object} item Raw item from GET /api/items/:id
 */
export function recordRecentlyViewed(userId, item) {
  if (!userId || !item?._id) return;

  const snapshot = {
    ...mapItemForCard(item),
    viewedAt: Date.now(),
  };

  const existing = loadRecentlyViewed(userId).filter((entry) => entry._id !== snapshot._id);
  const next = [snapshot, ...existing].slice(0, MAX_RECENT_ITEMS);

  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(RECENTLY_VIEWED_CHANGED_EVENT));
  } catch {
    // Quota or private mode — non-fatal
  }
}
