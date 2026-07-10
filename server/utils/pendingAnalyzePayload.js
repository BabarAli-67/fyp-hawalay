/**
 * Short-lived server-side stash of the full analyze-image payload between
 * analyze and item submit. The client receives a masked analyze response;
 * create-item uses the stashed original for embeddings and aiMetadata.
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
 * @param {object} payload
 */
function stashAnalyzePayload(userId, payload) {
  if (!userId || !payload || typeof payload !== 'object') return;
  pruneExpired();
  store.set(String(userId), {
    payload,
    createdAt: Date.now(),
  });
}

/**
 * @param {string} userId
 * @returns {object | null}
 */
function takeAnalyzePayload(userId) {
  if (!userId) return null;
  pruneExpired();
  const key = String(userId);
  const entry = store.get(key);
  store.delete(key);
  return entry?.payload ?? null;
}

module.exports = {
  stashAnalyzePayload,
  takeAnalyzePayload,
};
