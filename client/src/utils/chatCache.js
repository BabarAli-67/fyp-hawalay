/**
 * In-memory chat cache — instant UI on tab/conversation revisit; background refresh updates data.
 */

const roomsState = { loaded: false, rooms: [] };
const messagesByMatchId = new Map();

export function getCachedRooms() {
  return roomsState.loaded ? roomsState.rooms : null;
}

export function setCachedRooms(rooms) {
  roomsState.loaded = true;
  roomsState.rooms = Array.isArray(rooms) ? rooms : [];
}

export function patchCachedRoom(matchId, patch) {
  if (!roomsState.loaded) return;
  const id = String(matchId);
  roomsState.rooms = roomsState.rooms.map((room) =>
    String(room.matchId) === id ? { ...room, ...patch } : room,
  );
}

export function getCachedMessages(matchId) {
  return messagesByMatchId.get(String(matchId)) ?? null;
}

export function setCachedMessages(matchId, payload) {
  messagesByMatchId.set(String(matchId), {
    messages: Array.isArray(payload?.messages) ? payload.messages : [],
    participants: Array.isArray(payload?.participants) ? payload.participants : [],
    cachedAt: Date.now(),
  });
}

export function clearChatCache() {
  roomsState.loaded = false;
  roomsState.rooms = [];
  messagesByMatchId.clear();
}
