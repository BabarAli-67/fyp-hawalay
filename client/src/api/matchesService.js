import axiosInstance from './axiosInstance.js';

/**
 * @param {string} itemId - Source item id (owner's report)
 */
export async function getMatchesForItem(itemId) {
  const { data } = await axiosInstance.get(`/api/matches/for-item/${itemId}`);
  return data;
}
