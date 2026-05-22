import { useEffect, useState } from 'react';
import axiosInstance from '../api/axiosInstance.js';
import { isApiAvatarUrl, resolveAvatarUrl } from '../utils/userAvatar.js';

const SIZE_STYLES = {
  sm: {
    wrap: 'w-10 h-10',
    text: 'text-[11px]',
  },
  lg: {
    wrap: 'w-32 h-32',
    text: 'text-2xl',
  },
};

export function getInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function hasAvatarUrl(url) {
  return typeof url === 'string' && url.trim().length > 0;
}

/**
 * Profile / navbar avatar — image when available, otherwise name initials.
 * API avatars are loaded with auth (img tags cannot send Bearer tokens).
 */
export function UserAvatar({ user, size = 'sm', className = '' }) {
  const initials = getInitials(user?.name);
  const rawUrl = user?.avatarUrl?.trim();
  const [imageFailed, setImageFailed] = useState(false);
  const [blobSrc, setBlobSrc] = useState(null);
  const styles = SIZE_STYLES[size] ?? SIZE_STYLES.sm;

  const wrapClass =
    `${styles.wrap} shrink-0 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container overflow-hidden ${className}`.trim();

  useEffect(() => {
    setImageFailed(false);
    setBlobSrc(null);

    if (!hasAvatarUrl(rawUrl)) return undefined;

    if (!isApiAvatarUrl(rawUrl)) {
      setBlobSrc(resolveAvatarUrl(rawUrl));
      return undefined;
    }

    let cancelled = false;
    let objectUrl;

    const versionMatch = rawUrl.match(/[?&]v=(\d+)/);
    const params = versionMatch ? { v: versionMatch[1] } : {};

    axiosInstance
      .get('/api/users/me/avatar', {
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
  }, [rawUrl, user?._id, user?.updatedAt]);

  const displaySrc = blobSrc;

  if (!hasAvatarUrl(rawUrl) || !displaySrc || imageFailed) {
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
        src={displaySrc}
        loading="lazy"
        decoding="async"
        onError={() => setImageFailed(true)}
      />
    </span>
  );
}
