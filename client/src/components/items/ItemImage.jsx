import { useEffect, useState } from 'react';
import { fetchItemImageUrl, getCachedItemImageUrl } from '../../utils/itemImageCache.js';

const PLACEHOLDER_ICON_SIZES = {
  sm: 'text-[48px]',
  md: 'text-[64px]',
};

/**
 * Item photo from GridFS — loaded with JWT (plain img src cannot send Authorization).
 */
export function ItemImage({
  itemId,
  hasImage = true,
  className = 'w-full h-full object-cover',
  placeholderClassName = 'absolute inset-0 flex items-center justify-center',
  iconSize = 'sm',
  loading = 'lazy',
}) {
  const [blobSrc, setBlobSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);

    if (!itemId || !hasImage) {
      setBlobSrc(null);
      return undefined;
    }

    const cached = getCachedItemImageUrl(itemId);
    if (cached) {
      setBlobSrc(cached);
      return undefined;
    }

    setBlobSrc(null);
    let cancelled = false;

    fetchItemImageUrl(itemId)
      .then((url) => {
        if (!cancelled) setBlobSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [itemId, hasImage]);

  const iconClass = PLACEHOLDER_ICON_SIZES[iconSize] ?? PLACEHOLDER_ICON_SIZES.sm;

  if (!itemId || !hasImage || !blobSrc || failed) {
    return (
      <div className={placeholderClassName} aria-hidden>
        <span className={`material-symbols-outlined text-outline-variant ${iconClass}`}>image</span>
      </div>
    );
  }

  return (
    <img
      alt=""
      className={className}
      src={blobSrc}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
