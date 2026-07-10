import axiosInstance from './axiosInstance.js';

/**
 * @param {string} itemId - Source item id (owner's report)
 */
export async function getMatchesForItem(itemId) {
  const { data } = await axiosInstance.get(`/api/matches/for-item/${itemId}`);
  return data;
}

/**
 * @param {number} [page=1]
 * @param {number} [limit=3]
 */
export async function getUserMatches(page = 1, limit = 3) {
  const { data } = await axiosInstance.get('/api/matches', {
    params: { page, limit },
  });
  return data;
}

export async function getMatchReturnStatus(matchId) {
  const { data } = await axiosInstance.get(`/api/matches/${matchId}/return-status`);
  return data;
}

export async function confirmMatchReturn(matchId) {
  const { data } = await axiosInstance.post(`/api/matches/${matchId}/confirm-return`);
  return data;
}
