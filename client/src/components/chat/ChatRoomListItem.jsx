import { Link } from 'react-router-dom';
import { PeerAvatar } from './PeerAvatar.jsx';
import {
  BADGE_STYLES,
  buildChatBadge,
  formatInboxTime,
  getRoomUnreadCount,
  previewText,
} from '../../utils/chatRoomDisplay.js';

export function ChatRoomListItem({ room, currentUserId, onPrefetch }) {
  const peer = room.otherUser || {};
  const peerName = peer.name || 'User';
  const matchId = room.matchId;
  const badge = buildChatBadge(room, currentUserId);
  const unreadCount = getRoomUnreadCount(room);
  const timeLabel = formatInboxTime(room.lastMessage?.createdAt ?? room.createdAt);
  const messagePreview = previewText(room, currentUserId);
  const isUnread = unreadCount > 0;

  return (
    <Link
      to={`/chat/${matchId}`}
      className={`flex gap-sm items-center py-2.5 px-3 rounded-xl border transition-all active:scale-[0.99] ${
        isUnread
          ? 'bg-surface-container-lowest border-primary/20 shadow-sm hover:bg-surface-container-low'
          : 'bg-surface-container-lowest border-outline-variant/20 shadow-sm hover:bg-surface-container-low'
      }`}
      onMouseEnter={() => onPrefetch?.(matchId)}
      onFocus={() => onPrefetch?.(matchId)}
      onTouchStart={() => onPrefetch?.(matchId)}
    >
      <div className="relative shrink-0">
        <PeerAvatar
          name={peerName}
          userId={peer._id}
          avatarUrl={peer.avatarUrl}
          size="md"
        />
        {isUnread ? (
          <span
            className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-surface-container-lowest"
            aria-hidden
          />
        ) : null}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-sm mb-0.5">
          <h3
            className={`font-h3 text-h3 truncate leading-tight ${
              isUnread ? 'text-on-surface' : 'text-on-surface'
            }`}
          >
            {peerName}
          </h3>
          {timeLabel ? (
            <span
              className={`font-caption text-caption shrink-0 ${
                isUnread ? 'text-primary font-medium' : 'text-outline'
              }`}
            >
              {timeLabel}
            </span>
          ) : null}
        </div>

        <span
          className={`inline-block max-w-full truncate px-sm py-px rounded-md font-label-sm uppercase tracking-wide mb-0.5 ${BADGE_STYLES[badge.variant]}`}
        >
          {badge.label}
        </span>

        <p
          className={`font-body-md text-body-md truncate leading-snug ${
            isUnread ? 'text-on-surface font-medium' : 'text-on-surface-variant'
          }`}
        >
          {messagePreview}
        </p>
      </div>

      {unreadCount > 0 ? (
        <span
          className="shrink-0 min-w-[24px] h-6 px-1.5 rounded-full bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center self-center"
          aria-label={`${unreadCount} unread messages`}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : (
        <span
          className="material-symbols-outlined text-outline-variant shrink-0 self-center text-[20px]"
          aria-hidden
        >
          chevron_right
        </span>
      )}
    </Link>
  );
}

export function ChatRoomListSkeleton() {
  return (
    <div
      className="animate-pulse flex gap-sm items-center py-2.5 px-3 bg-surface-container-lowest rounded-xl border border-outline-variant/20"
      role="status"
      aria-label="Loading chat"
    >
      <div className="w-12 h-12 rounded-full bg-surface-container shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="flex justify-between gap-sm">
          <div className="h-4 w-1/3 rounded bg-surface-container" />
          <div className="h-3 w-12 rounded bg-surface-container" />
        </div>
        <div className="h-5 w-2/5 rounded-md bg-surface-container" />
        <div className="h-3 w-4/5 rounded bg-surface-container" />
      </div>
    </div>
  );
}
