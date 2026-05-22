const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export function isApiAvatarUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes('/api/users/me/avatar');
}

export function resolveAvatarUrl(avatarUrl) {
  if (!avatarUrl || typeof avatarUrl !== 'string') return null;
  const trimmed = avatarUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return API_BASE ? `${API_BASE}${path}` : path;
}
