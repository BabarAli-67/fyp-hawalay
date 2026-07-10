/**
 * Unread chat room count from REST inbox data (not socket events).
 */

export function isRoomUnread(room, userId) {
  if (!room || !userId) return false;
  if (typeof room.unreadCount === 'number') return room.unreadCount > 0;
  if (typeof room.unread === 'boolean') return room.unread;

  const uid = String(userId);
  const last = room.lastMessage;
  if (!last?.content) return false;

  const senderId = last.senderId != null ? String(last.senderId) : '';
  if (!senderId || senderId === uid) return false;

  const readBy = Array.isArray(last.readBy) ? last.readBy.map((id) => String(id)) : [];
  return !readBy.includes(uid);
}

export function countUnreadChatRooms(rooms, userId) {
  if (!Array.isArray(rooms) || !userId) return 0;
  return rooms.filter((room) => isRoomUnread(room, userId)).length;
}
