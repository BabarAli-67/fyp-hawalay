import axiosInstance from './axiosInstance.js';
import {
  getCachedMessages,
  setCachedMessages,
  setCachedRooms,
} from '../utils/chatCache.js';

const prefetchInflight = new Map();

export function getChatRooms() {
  return axiosInstance.get('/api/chat/rooms');
}

export function getMessages(matchId) {
  return axiosInstance.get(`/api/chat/${matchId}/messages`);
}

/**
 * Warm message history before navigation (hover / focus on chat list row).
 */
export function prefetchChatMessages(matchId) {
  const id = String(matchId);
  if (!id) return Promise.resolve(null);
  if (getCachedMessages(id)) return Promise.resolve(null);
  if (prefetchInflight.has(id)) return prefetchInflight.get(id);

  const promise = getMessages(id)
    .then(({ data }) => {
      setCachedMessages(id, data);
      return data;
    })
    .catch(() => null)
    .finally(() => {
      prefetchInflight.delete(id);
    });

  prefetchInflight.set(id, promise);
  return promise;
}

export async function fetchAndCacheChatRooms() {
  const { data } = await getChatRooms();
  const rooms = Array.isArray(data?.rooms) ? data.rooms : [];
  setCachedRooms(rooms);
  return rooms;
}

export async function fetchAndCacheMessages(matchId) {
  const { data } = await getMessages(matchId);
  setCachedMessages(matchId, data);
  return data;
}
