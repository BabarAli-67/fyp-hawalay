import axiosInstance from './axiosInstance.js';

/**
 * @param {number} [page=1]
 * @param {number} [limit=20]
 */
export async function getNotifications(page = 1, limit = 20) {
  const { data } = await axiosInstance.get('/api/notifications', {
    params: { page, limit },
  });
  return data;
}

/**
 * @param {string} notificationId
 */
export async function markAsRead(notificationId) {
  const { data } = await axiosInstance.patch(`/api/notifications/${notificationId}/read`);
  return data;
}

export async function markAllRead() {
  const { data } = await axiosInstance.patch('/api/notifications/read-all');
  return data;
}
