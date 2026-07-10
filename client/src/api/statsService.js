import axiosInstance from './axiosInstance.js';

export function getCommunityStats() {
  return axiosInstance.get('/api/stats/community');
}
