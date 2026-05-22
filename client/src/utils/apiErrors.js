const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** User-facing message for failed API calls (CORS, wrong VITE_API_URL, server down). */
export function getApiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const serverMsg = err?.response?.data?.error;
  if (typeof serverMsg === 'string' && serverMsg.trim()) {
    return serverMsg;
  }

  if (!API_BASE && import.meta.env.PROD) {
    return 'API URL is not configured. Set VITE_API_URL in Vercel environment variables and redeploy.';
  }

  if (err?.message === 'Network Error' || err?.code === 'ERR_NETWORK') {
    return (
      'Cannot reach the API server. Check that VITE_API_URL on Vercel points to your Render URL (https), ' +
      'and CLIENT_URL on Render matches this site URL exactly (no trailing slash).'
    );
  }

  if (typeof err?.message === 'string' && err.message.trim()) {
    return err.message;
  }

  return fallback;
}
