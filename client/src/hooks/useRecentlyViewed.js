import { useCallback, useEffect, useState } from 'react';
import { loadRecentlyViewed, RECENTLY_VIEWED_CHANGED_EVENT } from '../utils/recentlyViewed.js';

/**
 * Recently viewed items for the signed-in user (localStorage-backed).
 */
export function useRecentlyViewed(userId) {
  const [items, setItems] = useState(() => loadRecentlyViewed(userId));

  const refresh = useCallback(() => {
    setItems(loadRecentlyViewed(userId));
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return undefined;

    const onChange = () => refresh();
    window.addEventListener(RECENTLY_VIEWED_CHANGED_EVENT, onChange);
    window.addEventListener('focus', onChange);
    window.addEventListener('storage', onChange);

    return () => {
      window.removeEventListener(RECENTLY_VIEWED_CHANGED_EVENT, onChange);
      window.removeEventListener('focus', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [userId, refresh]);

  return items;
}
