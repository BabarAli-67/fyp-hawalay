/**
 * Allowed browser origins for CORS (comma-separated CLIENT_URL / CLIENT_URLS).
 * Trailing slashes are stripped so https://app.vercel.app matches env exactly.
 */
function normalizeOrigin(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\/$/, '');
  return trimmed.length > 0 ? trimmed : null;
}

function parseAllowedOrigins() {
  const parts = [];
  for (const key of ['CLIENT_URL', 'CLIENT_URLS']) {
    const raw = process.env[key];
    if (!raw) continue;
    for (const segment of raw.split(',')) {
      const origin = normalizeOrigin(segment);
      if (origin) parts.push(origin);
    }
  }
  return [...new Set(parts)];
}

function isOriginAllowed(origin, allowed) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  if (allowed.includes(normalized)) return true;

  // Optional: allow Vercel preview deployments (*.vercel.app)
  if (process.env.CORS_ALLOW_VERCEL_PREVIEWS === 'true') {
    try {
      const { hostname, protocol } = new URL(normalized);
      if (protocol === 'https:' && hostname.endsWith('.vercel.app')) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

module.exports = { parseAllowedOrigins, isOriginAllowed, normalizeOrigin };
