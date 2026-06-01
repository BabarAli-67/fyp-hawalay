import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { fetchAndCacheChatRooms, prefetchChatMessages } from '../api/chatService.js';
import { PeerAvatar } from '../components/chat/PeerAvatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getCachedRooms } from '../utils/chatCache.js';

function formatMessageTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function previewText(room, currentUserId) {
  const last = room.lastMessage;
  if (!last?.content) {
    return 'No messages yet — say hi';
  }
  const prefix =
    last.senderId && String(last.senderId) === currentUserId ? 'You: ' : '';
  const text = String(last.content).trim();
  const combined = `${prefix}${text}`;
  return combined.length > 72 ? `${combined.slice(0, 69)}…` : combined;
}

function ChatRoomSkeleton() {
  return (
    <div
      className="animate-pulse flex gap-md items-center p-md bg-surface-container-lowest rounded-xl shadow-sm"
      role="status"
      aria-label="Loading chat"
    >
      <div className="w-12 h-12 rounded-full bg-surface-container shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 rounded bg-surface-container" />
        <div className="h-3 w-4/5 rounded bg-surface-container" />
      </div>
    </div>
  );
}

/**
 * Inbox of match chat rooms for the logged-in user.
 */
export default function ChatsPage() {
  const { user, socket } = useAuth();
  const currentUserId = user?._id ? String(user._id) : '';

  const [rooms, setRooms] = useState(() => getCachedRooms() ?? []);
  const [isLoading, setIsLoading] = useState(() => getCachedRooms() === null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const refreshTimerRef = useRef(null);

  const loadRooms = useCallback(async ({ background = false } = {}) => {
    if (!background && getCachedRooms() === null) {
      setIsLoading(true);
    } else if (background) {
      setIsRefreshing(true);
    }
    setLoadError(null);
    try {
      const rows = await fetchAndCacheChatRooms();
      setRooms(rows);
    } catch (err) {
      const message = err?.response?.data?.error || 'Could not load chats';
      if (!background || getCachedRooms() === null) {
        setLoadError(message);
        setRooms([]);
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      loadRooms({ background: true });
    }, 400);
  }, [loadRooms]);

  useEffect(() => {
    const hasCache = getCachedRooms() !== null;
    loadRooms({ background: hasCache });
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [loadRooms]);

  useEffect(() => {
    if (!socket) return undefined;

    socket.on('chat:message', scheduleRefresh);
    window.addEventListener('hawalay:refresh-chats', scheduleRefresh);
    window.addEventListener('hawalay:chat-notify', scheduleRefresh);
    window.addEventListener('hawalay:match-found', scheduleRefresh);

    return () => {
      socket.off('chat:message', scheduleRefresh);
      window.removeEventListener('hawalay:refresh-chats', scheduleRefresh);
      window.removeEventListener('hawalay:chat-notify', scheduleRefresh);
      window.removeEventListener('hawalay:match-found', scheduleRefresh);
    };
  }, [socket, scheduleRefresh]);

  return (
    <div className="bg-background text-on-background min-h-screen pb-24">
      <div className="px-margin-mobile max-w-2xl mx-auto">
        <section className="mb-lg mt-4">
          <div className="flex items-baseline justify-between gap-sm">
            <h2 className="font-h1 text-h1 text-on-surface mb-xs">Messages</h2>
            {isRefreshing ? (
              <span className="font-caption text-caption text-outline shrink-0" aria-live="polite">
                Updating…
              </span>
            ) : null}
          </div>
          <p className="font-body-md text-on-surface-variant">
            Chats with people you matched with on lost and found reports.
          </p>
        </section>

        {isLoading ? (
          <div className="space-y-md">
            <ChatRoomSkeleton />
            <ChatRoomSkeleton />
            <ChatRoomSkeleton />
          </div>
        ) : null}

        {!isLoading && loadError ? (
          <div
            className="rounded-xl border border-outline-variant/30 bg-error-container px-md py-md text-center"
            role="alert"
          >
            <p className="font-body-md text-on-error-container mb-sm">{loadError}</p>
            <button
              type="button"
              onClick={() => loadRooms()}
              className="font-label-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : null}

        {!isLoading && !loadError && rooms.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-md py-xl text-center">
            <span
              className="material-symbols-outlined text-[48px] text-on-surface-variant mb-sm block"
              data-icon="forum"
            >
              forum
            </span>
            <p className="font-h3 text-h3 text-on-surface mb-xs">No conversations yet</p>
            <p className="font-body-md text-on-surface-variant mb-md">
              When you get a match, your chat rooms will show up here.
            </p>
            <Link to="/notifications" className="font-label-sm text-primary hover:underline">
              Check match alerts
            </Link>
          </div>
        ) : null}

        {!isLoading && !loadError && rooms.length > 0 ? (
          <ul className="space-y-sm" aria-label="Chat rooms">
            {rooms.map((room) => {
              const peerName = room.otherUser?.name || 'User';
              const matchId = room.matchId;
              const itemHint =
                room.items?.source?.title && room.items?.matched?.title
                  ? `${room.items.source.title} · ${room.items.matched.title}`
                  : null;
              const timeLabel = formatMessageTime(
                room.lastMessage?.createdAt ?? room.createdAt,
              );

              return (
                <li key={String(matchId)}>
                  <Link
                    to={`/chat/${matchId}`}
                    className="flex gap-md items-center p-md bg-surface-container-lowest rounded-xl shadow-sm hover:bg-surface-container-low active:scale-[0.99] transition-all"
                    onMouseEnter={() => prefetchChatMessages(matchId)}
                    onFocus={() => prefetchChatMessages(matchId)}
                    onTouchStart={() => prefetchChatMessages(matchId)}
                  >
                    <PeerAvatar name={peerName} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-sm mb-0.5">
                        <h3 className="font-h3 text-h3 text-on-surface truncate">{peerName}</h3>
                        {timeLabel ? (
                          <span className="font-caption text-caption text-outline shrink-0">
                            {timeLabel}
                          </span>
                        ) : null}
                      </div>
                      {itemHint ? (
                        <p className="font-caption text-caption text-primary truncate mb-0.5">
                          {itemHint}
                        </p>
                      ) : null}
                      <p className="font-body-md text-body-md text-on-surface-variant truncate">
                        {previewText(room, currentUserId)}
                      </p>
                    </div>
                    <span
                      className="material-symbols-outlined text-outline-variant shrink-0"
                      aria-hidden
                    >
                      chevron_right
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
