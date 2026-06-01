import { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance.js';
import { getInitials } from '../UserAvatar.jsx';
import { isApiAvatarUrl, resolveAvatarUrl } from '../../utils/userAvatar.js';

const SIZE_STYLES = {
  sm: { wrap: 'w-10 h-10', text: 'text-[11px]' },
  md: { wrap: 'w-12 h-12', text: 'text-sm' },
  lg: { wrap: 'w-14 h-14', text: 'text-base' },
};

function hasAvatarUrl(url) {
  return typeof url === 'string' && url.trim().length > 0;
}

/**
 * Chat peer avatar — loads GridFS image when avatarUrl is set, otherwise initials.
 */
export function PeerAvatar({ name, userId, avatarUrl, size = 'md', className = '' }) {
  const initials = getInitials(name);
  const styles = SIZE_STYLES[size] ?? SIZE_STYLES.md;
  const [imageFailed, setImageFailed] = useState(false);
  const [blobSrc, setBlobSrc] = useState(null);

  const wrapClass =
    `${styles.wrap} shrink-0 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container overflow-hidden ${className}`.trim();

  useEffect(() => {
    setImageFailed(false);
    setBlobSrc(null);

    if (!hasAvatarUrl(avatarUrl)) return undefined;

    if (!isApiAvatarUrl(avatarUrl)) {
      setBlobSrc(resolveAvatarUrl(avatarUrl));
      return undefined;
    }

    if (!userId) return undefined;

    let cancelled = false;
    let objectUrl;

    const versionMatch = avatarUrl.match(/[?&]v=(\d+)/);
    const params = versionMatch ? { v: versionMatch[1] } : {};

    axiosInstance
      .get(`/api/users/${userId}/avatar`, {
        responseType: 'blob',
        params,
      })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setBlobSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setBlobSrc(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [avatarUrl, userId]);

  if (!hasAvatarUrl(avatarUrl) || !blobSrc || imageFailed) {
    return (
      <span className={wrapClass} aria-hidden>
        <span className={`font-bold leading-none tracking-tight select-none uppercase ${styles.text}`}>
          {initials}
        </span>
      </span>
    );
  }

  return (
    <span className={wrapClass}>
      <img
        alt=""
        className="w-full h-full object-cover"
        src={blobSrc}
        loading="lazy"
        decoding="async"
        onError={() => setImageFailed(true)}
      />
    </span>
  );
}
