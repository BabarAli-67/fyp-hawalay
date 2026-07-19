/**
 * Session cache for list responses (stale-while-revalidate).
 * Keyed per screen + filter combination; survives in-app navigation,
 * resets when the app reloads or the TTL expires.
 */

const CACHE_TTL_MS = 5 * 60 * 1000;

export function browseCacheKey({ reportType, category, searchQuery }) {
  return `hawalay:browse:${reportType || 'all'}|${category || 'all'}|${(searchQuery || '').trim().toLowerCase()}`;
}

export function matchesCacheKey(scopedReportId) {
  return `hawalay:matches:${scopedReportId || 'all'}`;
}

export function readListCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return null;
    if (Date.now() - (parsed.at || 0) > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.items;
  } catch {
    return null;
  }
}

export function writeListCache(key, items) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), items }));
  } catch {
    // Storage full or unavailable — cache is best-effort only.
  }
}

/** Drop all browse/matches session caches (e.g. after deleting a report). */
export function invalidateListCaches() {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('hawalay:browse:') || key.startsWith('hawalay:matches:'))) {
        keys.push(key);
      }
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // sessionStorage unavailable
  }
}
