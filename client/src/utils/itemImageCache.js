import axiosInstance from '../api/axiosInstance.js';

const objectUrlByItemId = new Map();
const inflightByItemId = new Map();

/**
 * Shared blob URL cache for item thumbnails (JWT cannot be sent via plain img src).
 */
export function getCachedItemImageUrl(itemId) {
  return objectUrlByItemId.get(itemId) ?? null;
}

export function fetchItemImageUrl(itemId) {
  const cached = objectUrlByItemId.get(itemId);
  if (cached) return Promise.resolve(cached);

  const inflight = inflightByItemId.get(itemId);
  if (inflight) return inflight;

  const promise = axiosInstance
    .get(`/api/items/${itemId}/image`, { responseType: 'blob' })
    .then((res) => {
      const url = URL.createObjectURL(res.data);
      objectUrlByItemId.set(itemId, url);
      return url;
    })
    .finally(() => {
      inflightByItemId.delete(itemId);
    });

  inflightByItemId.set(itemId, promise);
  return promise;
}
