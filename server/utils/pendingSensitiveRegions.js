/**
 * Short-lived server-side stash between analyze-image and item submit.
 * Sensitive OCR regions are stripped from the client analyze response but
 * persisted on the item at create time for future masking (Phase 3).
 */

const TTL_MS = 30 * 60 * 1000;
const store = new Map();

function pruneExpired() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (!entry || now - entry.createdAt > TTL_MS) {
      store.delete(key);
    }
  }
}

/**
 * @param {string} userId
 * @param {Array<object>} regions
 */
function stashSensitiveRegions(userId, regions) {
  if (!userId || !Array.isArray(regions) || regions.length === 0) return;
  pruneExpired();
  store.set(String(userId), {
    regions,
    createdAt: Date.now(),
  });
}

/**
 * @param {string} userId
 * @returns {Array<object> | null}
 */
function takeSensitiveRegions(userId) {
  if (!userId) return null;
  pruneExpired();
  const key = String(userId);
  const entry = store.get(key);
  store.delete(key);
  return entry?.regions ?? null;
}

module.exports = {
  stashSensitiveRegions,
  takeSensitiveRegions,
};
