import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance.js';
import { RecentlyFoundCard, RecentlyFoundCardSkeleton } from './RecentlyFoundCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { mapItemForCard } from '../../utils/mapItemForCard.js';
import {
  isItemWishlisted,
  loadWishlistIds,
  toggleWishlistItem,
  WISHLIST_CHANGED_EVENT,
} from '../../utils/wishlist.js';

const RECENTLY_FOUND_LIMIT = 3;

/**
 * Latest found community reports — vertical card grid (carousel on mobile).
 */
export function RecentlyFoundSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?._id ? String(user._id) : '';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [wishlistIds, setWishlistIds] = useState(() => loadWishlistIds(userId));

  const refreshWishlist = useCallback(() => {
    setWishlistIds(loadWishlistIds(userId));
  }, [userId]);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  useEffect(() => {
    if (!userId) return undefined;

    const onWishlistChange = () => refreshWishlist();
    window.addEventListener(WISHLIST_CHANGED_EVENT, onWishlistChange);
    return () => window.removeEventListener(WISHLIST_CHANGED_EVENT, onWishlistChange);
  }, [userId, refreshWishlist]);

  const loadRecent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axiosInstance.get('/api/items', {
        params: {
          status: 'active',
          reportType: 'found',
          page: 1,
          limit: RECENTLY_FOUND_LIMIT,
        },
      });
      setItems((data.items ?? []).map(mapItemForCard).slice(0, RECENTLY_FOUND_LIMIT));
    } catch {
      setItems([]);
      setError('Could not load recently found items.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent, reloadKey]);

  function handleToggleWishlist(itemId) {
    if (!userId) return;
    toggleWishlistItem(userId, itemId);
    refreshWishlist();
  }

  const cardProps = (item) => ({
    item,
    isWishlisted: isItemWishlisted(wishlistIds, item._id),
    onToggleWishlist: handleToggleWishlist,
  });

  const visibleItems = items.slice(0, RECENTLY_FOUND_LIMIT);

  return (
    <section className="w-full" aria-labelledby="recently-found-heading">
      <div className="flex items-baseline justify-between gap-sm mb-md md:mb-lg">
        <h2 id="recently-found-heading" className="font-h3 text-h3 text-on-surface">
          Recently Found
        </h2>
        {!loading && !error && visibleItems.length > 0 ? (
          <Link to="/matches" className="font-label-sm text-primary hover:underline shrink-0">
            View all
          </Link>
        ) : null}
      </div>

      {loading ? (
        <ul className="flex gap-sm overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1 md:grid md:overflow-visible md:grid-cols-3 lg:grid-cols-4 md:gap-md lg:gap-lg">
          {[1, 2, 3].map((key) => (
            <li
              key={key}
              className="w-[44vw] max-w-[168px] shrink-0 snap-start md:w-auto md:max-w-none md:min-w-0"
            >
              <RecentlyFoundCardSkeleton />
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && error ? (
        <div className="rounded-xl border border-outline-variant/25 bg-surface-container-low px-md py-lg text-center">
          <p className="font-body-md text-on-surface-variant mb-sm">{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="font-label-sm text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      ) : null}

      {!loading && !error && visibleItems.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/25 bg-surface-container-low px-md py-lg text-center">
          <p className="font-body-md text-on-surface-variant mb-sm">
            No found items to show yet.
          </p>
          <button
            type="button"
            onClick={() => navigate('/matches')}
            className="font-label-sm text-primary hover:underline"
          >
            Browse community
          </button>
        </div>
      ) : null}

      {!loading && !error && visibleItems.length > 0 ? (
        <ul className="flex gap-sm overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1 md:grid md:overflow-visible md:grid-cols-3 lg:grid-cols-4 md:gap-md lg:gap-lg">
          {visibleItems.map((item) => (
            <li
              key={item._id}
              className="w-[44vw] max-w-[168px] shrink-0 snap-start md:w-auto md:max-w-none md:min-w-0"
            >
              <RecentlyFoundCard {...cardProps(item)} />
            </li>
          ))}
        </ul>
      ) : null}

      {loading ? (
        <div className="sr-only" aria-live="polite">
          Loading recently found items
        </div>
      ) : null}
    </section>
  );
}
