import { Link } from 'react-router-dom';
import { ItemImage } from '../items/ItemImage.jsx';
import { formatCardDate } from '../../utils/mapItemForCard.js';

/**
 * Compact vertical marketplace card — image on top, metadata below, optional wishlist heart.
 */
export function RecentlyFoundCard({ item, isWishlisted = false, onToggleWishlist }) {
  const locationName = item.locationName?.trim() || '—';
  const detailPath = `/item/${item._id}`;

  function handleWishlistClick(event) {
    event.preventDefault();
    event.stopPropagation();
    onToggleWishlist?.(item._id);
  }

  return (
    <article className="group flex h-full w-full max-w-[200px] md:max-w-none flex-col overflow-hidden rounded-xl border border-outline-variant/20 bg-surface shadow-sm transition-shadow hover:shadow-md">
      <Link to={detailPath} className="flex h-full flex-col no-underline text-inherit active:scale-[0.99] transition-transform">
        <div className="relative aspect-[4/3] w-full shrink-0 bg-surface-container">
          <ItemImage
            itemId={item._id}
            hasImage={item.hasImage}
            className="h-full w-full object-cover"
            placeholderClassName="flex h-full w-full items-center justify-center"
            loading="lazy"
          />
          <button
            type="button"
            onClick={handleWishlistClick}
            aria-pressed={isWishlisted}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            className={`absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-colors ${
              isWishlisted
                ? 'bg-primary text-on-primary'
                : 'bg-surface/90 text-on-surface-variant hover:bg-surface'
            }`}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={isWishlisted ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              favorite
            </span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-0.5 p-sm">
          <h3 className="font-label-sm text-on-surface line-clamp-2 leading-snug">{item.title}</h3>
          <div className="flex min-w-0 items-center gap-0.5 text-outline">
            <span className="material-symbols-outlined shrink-0 text-[14px]">location_on</span>
            <span className="font-caption text-caption truncate" title={locationName}>
              {locationName}
            </span>
          </div>
          <p className="font-caption text-caption text-on-surface-variant">
            {formatCardDate(item.date)}
          </p>
        </div>
      </Link>
    </article>
  );
}

export function RecentlyFoundCardSkeleton() {
  return (
    <div
      className="w-[44vw] max-w-[168px] shrink-0 md:w-full md:max-w-none animate-pulse overflow-hidden rounded-xl border border-outline-variant/20 bg-surface"
      aria-hidden
    >
      <div className="aspect-[4/3] bg-surface-container" />
      <div className="space-y-2 p-sm">
        <div className="h-3.5 w-4/5 rounded bg-surface-container" />
        <div className="h-3 w-3/5 rounded bg-surface-container" />
        <div className="h-3 w-2/5 rounded bg-surface-container" />
      </div>
    </div>
  );
}
