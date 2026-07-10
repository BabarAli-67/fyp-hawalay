const STORAGE_PREFIX = 'hawalay_wishlist';

export const WISHLIST_CHANGED_EVENT = 'hawalay:wishlist-changed';

function storageKey(userId) {
  return `${STORAGE_PREFIX}:${userId}`;
}

/**
 * @param {string | undefined | null} userId
 * @returns {Set<string>}
 */
export function loadWishlistIds(userId) {
  if (!userId) return new Set();

  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((id) => String(id)));
  } catch {
    return new Set();
  }
}

/**
 * @param {string | undefined | null} userId
 * @param {string} itemId
 * @returns {boolean} Whether the item is now wishlisted
 */
export function toggleWishlistItem(userId, itemId) {
  if (!userId || !itemId) return false;

  const key = storageKey(userId);
  const ids = loadWishlistIds(userId);
  const id = String(itemId);

  if (ids.has(id)) {
    ids.delete(id);
  } else {
    ids.add(id);
  }

  localStorage.setItem(key, JSON.stringify([...ids]));
  window.dispatchEvent(new CustomEvent(WISHLIST_CHANGED_EVENT));
  return ids.has(id);
}

export function isItemWishlisted(wishlistIds, itemId) {
  return wishlistIds.has(String(itemId));
}
