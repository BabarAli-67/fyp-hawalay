import axiosInstance from './axiosInstance.js';

export function getChatRooms() {
  return axiosInstance.get('/api/chat/rooms');
}

export function getMessages(matchId) {
  return axiosInstance.get(`/api/chat/${matchId}/messages`);
}
