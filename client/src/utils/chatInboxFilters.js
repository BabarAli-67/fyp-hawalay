import { getRoomUnreadCount, previewText } from './chatRoomDisplay.js';

export const INBOX_TABS = {
  ALL: 'all',
  UNREAD: 'unread',
};

export const INBOX_SORT = {
  RECENT: 'recent',
  UNREAD_FIRST: 'unread_first',
};

export const INBOX_TYPE_FILTER = {
  ALL: 'all',
  LOST: 'lost',
  FOUND: 'found',
};

function roomTimestamp(room) {
  const value = room?.lastMessage?.createdAt ?? room?.createdAt;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function matchesSearch(room, query, currentUserId) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    room?.otherUser?.name,
    room?.myItem?.title,
    room?.myItem?.brand,
    room?.peerItem?.title,
    room?.peerItem?.brand,
    room?.items?.source?.title,
    room?.items?.source?.brand,
    room?.items?.matched?.title,
    room?.items?.matched?.brand,
    previewText(room, currentUserId),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(q);
}

function matchesTypeFilter(room, typeFilter) {
  if (typeFilter === INBOX_TYPE_FILTER.ALL) return true;
  const myType = room?.myItem?.reportType;
  const peerType = room?.peerItem?.reportType;
  if (typeFilter === INBOX_TYPE_FILTER.LOST) {
    return myType === 'lost' || peerType === 'lost';
  }
  if (typeFilter === INBOX_TYPE_FILTER.FOUND) {
    return myType === 'found' || peerType === 'found';
  }
  return true;
}

export function filterInboxRooms(rooms, { tab, searchQuery, typeFilter, sort, currentUserId }) {
  if (!Array.isArray(rooms)) return [];

  let rows = rooms.filter((room) => matchesSearch(room, searchQuery, currentUserId));
  rows = rows.filter((room) => matchesTypeFilter(room, typeFilter));

  if (tab === INBOX_TABS.UNREAD) {
    rows = rows.filter((room) => getRoomUnreadCount(room) > 0);
  }

  if (sort === INBOX_SORT.UNREAD_FIRST) {
    rows = [...rows].sort((a, b) => {
      const unreadDiff = getRoomUnreadCount(b) - getRoomUnreadCount(a);
      if (unreadDiff !== 0) return unreadDiff;
      return roomTimestamp(b) - roomTimestamp(a);
    });
  } else {
    rows = [...rows].sort((a, b) => roomTimestamp(b) - roomTimestamp(a));
  }

  return rows;
}

export function countInboxUnread(rooms) {
  if (!Array.isArray(rooms)) return 0;
  return rooms.reduce((sum, room) => sum + getRoomUnreadCount(room), 0);
}
